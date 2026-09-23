/**
 * Yjs 文档相关常量与工具
 *
 * Yjs 是动态结构，无需在 shared 层声明 schema（不像 ProseMirror 需要 schema）。
 * 这里只放房间 ID 约定、文档 ID 前缀等跨端共享常量。
 */

/** 文档 ID 前缀 */
export const DOC_ID_PREFIX = "doc-";

/** WebSocket 房间前缀（房间 ID = 文档 ID） */
export const ROOM_PREFIX = "room:";

/** 默认文档名 */
export const DEFAULT_DOC_NAME = "Untitled";

/**
 * 构造 WebSocket 房间 ID
 *
 * @param docId Yjs 文档 ID
 * @returns 形如 "room:doc-xxx" 的房间标识
 */
export function toRoomId(docId: string): string {
  return `${ROOM_PREFIX}${docId}`;
}

/**
 * 从 WebSocket 房间 ID 还原 Yjs 文档 ID
 *
 * 兼容输入已经是文档 ID（无前缀）的情况。
 */
export function fromRoomId(roomId: string): string {
  return roomId.startsWith(ROOM_PREFIX) ? roomId.slice(ROOM_PREFIX.length) : roomId;
}
