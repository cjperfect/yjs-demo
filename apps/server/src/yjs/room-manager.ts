import type { YjsConnection, YjsPersistence, RoomInfo } from "./types.js";
import { YjsRoom } from "./room.js";
import { fromRoomId, toRoomId } from "@yjs-demo/shared";

/**
 * Yjs 房间管理器
 *
 * 维护 docId → YjsRoom 的映射，负责：
 * - 房间的惰性创建（首次 getOrCreateRoom 时 load 历史 state）
 * - 房间在最后一个连接断开后的销毁
 * - 监控查询（listRooms / getRoomInfo）
 *
 * 线程模型：单进程内单例。多实例水平扩展时需要走 sticky session 或 Redis pubsub。
 */
export class YjsRoomManager {
  private readonly rooms = new Map<string, YjsRoom>();
  private readonly pendingLoads = new Map<string, Promise<YjsRoom>>();

  constructor(
    private readonly persistence: YjsPersistence,
    private readonly saveDebounceMs: number = 2000,
    private readonly idleTtlMs: number = 30_000,
  ) {}

  /**
   * 获取或创建 docId 对应的房间
   *
   * 先查现成房间，没有再惰性创建；
   * 并发场景下使用 pendingLoads 防止重复 load
   */
  async getOrCreateRoom(docId: string): Promise<YjsRoom> {
    const existing = this.rooms.get(docId);
    if (existing) return existing;

    const pending = this.pendingLoads.get(docId);
    if (pending) return pending;

    const loadPromise = (async () => {
      const room = new YjsRoom(
        docId,
        this.persistence,
        this.saveDebounceMs,
        (id) => this.notifyConnectionClosed(id),
      );
      await room.load();
      this.rooms.set(docId, room);
      this.pendingLoads.delete(docId);
      return room;
    })();

    this.pendingLoads.set(docId, loadPromise);
    return loadPromise;
  }

  /**
   * 客户端断开后清理房间
   *
   * 如果房间已经空了，等待 idleTtlMs 后再 dispose（防止抖动重连反复 load）
   */
  notifyConnectionClosed(docId: string): void {
    const room = this.rooms.get(docId);
    if (!room || room.connectionCount > 0) return;

    setTimeout(() => {
      const current = this.rooms.get(docId);
      if (current && current.connectionCount === 0) {
        void current.dispose().then(() => {
          this.rooms.delete(docId);
        });
      }
    }, this.idleTtlMs);
  }

  /** 列出所有活跃房间（监控用） */
  listRooms(): RoomInfo[] {
    return Array.from(this.rooms.values()).map((room) => ({
      docId: room.docId,
      roomId: toRoomId(room.docId),
      connectionCount: room.connectionCount,
    }));
  }

  /** 按 roomId 查询房间 */
  getRoomByRoomId(roomId: string): YjsRoom | undefined {
    return this.rooms.get(fromRoomId(roomId));
  }

  /** 关闭所有房间（优雅停机时调用） */
  async disposeAll(): Promise<void> {
    const rooms = Array.from(this.rooms.values());
    this.rooms.clear();
    await Promise.all(rooms.map((room) => room.dispose()));
  }
}
