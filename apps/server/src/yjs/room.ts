import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import type { WebSocket } from "ws";
import type { YjsConnection, YjsPersistence } from "./types.js";
import {
  MESSAGE_AWARENESS,
  MESSAGE_SYNC,
  handleYjsMessage,
  sendInitialSync,
} from "./sync-handler.js";

/**
 * Yjs 协同房间（房间层）
 *
 * 本文件包含一个协同房间的"运行机制"：
 * - 传输适配：createWsConnection（ws.WebSocket → YjsConnection）
 * - 房间本体：YjsRoom（Y.Doc + awareness + connections + 持久化）
 *
 * 关注点分层（自下而上，各自独立成文件避免单文件过大）：
 *   types.ts（契约）→ sync-handler.ts（协议）→ room.ts（房间）→ room-manager.ts（房间池）→ yjs.service.ts（NestJS 接入）
 */

// ─── 传输适配 ────────────────────────────────────────────────────

/**
 * 把 ws.WebSocket 适配成 YjsConnection
 *
 * ws 库的 'message' 事件回传 Buffer，
 * 这里转成 Uint8Array 以匹配 y-protocols 的二进制处理约定。
 *
 * 同时负责承载 Yjs clientId（由调用方从 Y.Doc.awareness.clientID 分配）
 */
export function createWsConnection(ws: WebSocket, clientId: number): YjsConnection {
  let messageHandler: ((data: Uint8Array) => void) | null = null;
  let closeHandler: (() => void) | null = null;

  ws.on("message", (raw: Buffer) => {
    if (messageHandler) {
      // Buffer → Uint8Array 直接共享内存，零拷贝
      const u8 = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      messageHandler(u8);
    }
  });

  ws.on("close", () => {
    if (closeHandler) closeHandler();
  });

  return {
    clientId,
    send(data: Uint8Array): void {
      if (ws.readyState === ws.OPEN) {
        ws.send(data, { binary: true });
      }
    },
    close(code?: number, reason?: string): void {
      ws.close(code, reason);
    },
    onMessage(handler: (data: Uint8Array) => void): void {
      messageHandler = handler;
    },
    onClose(handler: () => void): void {
      closeHandler = handler;
    },
  };
}

// ─── 房间本体 ─────────────────────────────────────────────────────

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
    encoding.writeVarUint(encoder, MESSAGE_SYNC);
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
    encoding.writeVarUint(encoder, MESSAGE_AWARENESS);
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
