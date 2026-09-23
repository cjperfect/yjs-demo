import type * as Y from "yjs";

/**
 * Yjs 文档持久化接口
 *
 * 实现方负责把 Yjs 的二进制 state 存到具体存储后端。
 * 默认实现在 apps/server 里用 Prisma + Postgres bytea。
 *
 * 设计取舍：
 * - 这里只覆盖式存 state（Y.encodeStateAsUpdate 的产物）
 * - 不做 update 增量追加，避免增量无限膨胀
 * - 调用方负责周期性 flush，yjs-server 包内做 debounce
 */
export interface YjsPersistence {
  /** 加载 docId 对应的 Yjs state 二进制，没有则返回 null */
  loadState(docId: string): Promise<Uint8Array | null>;
  /** 覆盖式保存 docId 对应的 Yjs state 二进制 */
  saveState(docId: string, state: Uint8Array): Promise<void>;
}

/**
 * Yjs 客户端连接抽象
 *
 * 任何能 send 二进制 + close 的传输都实现这个接口。
 * 当前实现是 ws.WebSocket，未来可以扩展到 socket.io / WebRTC。
 */
export interface YjsConnection {
  /** 客户端唯一 ID（与 Y.Doc.awareness.clientID 对齐） */
  readonly clientId: number;
  /** 发送二进制消息到对端 */
  send(data: Uint8Array): void;
  /** 关闭连接 */
  close(code?: number, reason?: string): void;
  /** 注册收到二进制消息时的回调 */
  onMessage(handler: (data: Uint8Array) => void): void;
  /** 注册连接关闭时的回调 */
  onClose(handler: () => void): void;
}

/** 房间信息（监控/调试用） */
export interface RoomInfo {
  docId: string;
  roomId: string;
  connectionCount: number;
}
