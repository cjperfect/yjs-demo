import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import type { YjsConnection, YjsPersistence } from "./types";
import { handleYjsMessage, sendInitialSync } from "./sync-handler";

/**
 * 单个 Yjs 协同房间
 *
 * 一个房间对应一个 Y.Doc，承载：
 * - 文档的 CRDT 状态
 * - 在线客户端的 Awareness（光标、用户信息）
 * - update 广播与持久化
 *
 * 生命周期：
 *   YjsRoomManager.getOrCreateRoom(docId) → load() → addConnection(conn) → ...
 *   → 最后一个 conn 断开 → flushSave() → 释放 Y.Doc
 */
export class YjsRoom {
  readonly ydoc: Y.Doc;
  readonly awareness: awarenessProtocol.Awareness;
  private readonly connections = new Set<YjsConnection>();
  private saveTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly handleDocUpdate: (update: Uint8Array, origin: unknown) => void;

  constructor(
    readonly docId: string,
    private readonly persistence: YjsPersistence,
    private readonly saveDebounceMs: number = 2000,
    /** 房间内最后一个连接断开时触发，由 RoomManager 用于延迟销毁 */
    private readonly onEmpty?: (docId: string) => void,
  ) {
    this.ydoc = new Y.Doc();
    this.awareness = new awarenessProtocol.Awareness(this.ydoc);

    // 绑定 update handler（用箭头函数避免 this 丢失）
    this.handleDocUpdate = (update, origin) => {
      this.broadcastUpdate(update, origin);
      this.scheduleSave();
    };
    this.ydoc.on("update", this.handleDocUpdate);

    // awareness 变化时广播
    this.awareness.on("update", this.handleAwarenessUpdate);
  }

  /** 从持久化层加载已有 state */
  async load(): Promise<void> {
    const state = await this.persistence.loadState(this.docId);
    if (state && state.byteLength > 0) {
      Y.applyUpdate(this.ydoc, state);
    }
  }

  /** 客户端连接加入房间 */
  addConnection(conn: YjsConnection): void {
    this.connections.add(conn);

    conn.onMessage((data) => {
      handleYjsMessage(this.ydoc, this.awareness, conn, data);
    });

    conn.onClose(() => {
      this.removeConnection(conn);
      // 客户端断开后从 awareness 中清除其状态
      awarenessProtocol.removeAwarenessStates(this.awareness, [conn.clientId], null);
    });

    // 发送初始同步消息
    sendInitialSync(this.ydoc, this.awareness, conn);
  }

  /** 客户端断开 */
  removeConnection(conn: YjsConnection): void {
    this.connections.delete(conn);
    if (this.connections.size === 0) {
      void this.flushSave();
      // 通知 manager：房间已空，可延迟销毁
      this.onEmpty?.(this.docId);
    }
  }

  /** 当前连接数 */
  get connectionCount(): number {
    return this.connections.size;
  }

  /** 立即销毁房间（释放 Y.Doc 资源，先 flush 再 destroy） */
  async dispose(): Promise<void> {
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    await this.flushSave();
    this.ydoc.off("update", this.handleDocUpdate);
    this.awareness.off("update", this.handleAwarenessUpdate);
    this.ydoc.destroy();
  }

  /** 广播 update 给房间内除 origin 外的所有客户端 */
  private broadcastUpdate(update: Uint8Array, origin: unknown): void {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 0); // MESSAGE_SYNC
    syncProtocol.writeUpdate(encoder, update);
    const message = encoding.toUint8Array(encoder);

    for (const conn of this.connections) {
      if (conn !== origin) {
        conn.send(message);
      }
    }
  }

  /** awareness 变化时广播 */
  private handleAwarenessUpdate = (
    { added, updated, removed }: { added: number[]; updated: number[]; removed: number[] },
    origin: unknown,
  ): void => {
    const changedClients = [...added, ...updated, ...removed];
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, 1); // MESSAGE_AWARENESS
    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
      this.awareness,
      changedClients,
    );
    encoding.writeVarUint8Array(encoder, awarenessUpdate);
    const message = encoding.toUint8Array(encoder);

    for (const conn of this.connections) {
      if (conn !== origin) {
        conn.send(message);
      }
    }
  };

  /** 调度 debounce 持久化（避免每次 update 都写库） */
  private scheduleSave(): void {
    if (this.saveTimer) return;
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null;
      void this.flushSave();
    }, this.saveDebounceMs);
  }

  /** 把当前 Y.Doc 状态序列化后写入持久化层 */
  private async flushSave(): Promise<void> {
    const state = Y.encodeStateAsUpdate(this.ydoc);
    await this.persistence.saveState(this.docId, state);
  }
}
