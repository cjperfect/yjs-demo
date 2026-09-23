"use strict";
/**
 * Yjs 文档相关常量与工具
 *
 * Yjs 是动态结构，无需在 shared 层声明 schema（不像 ProseMirror 需要 schema）。
 * 这里只放房间 ID 约定、文档 ID 前缀等跨端共享常量。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_DOC_NAME = exports.ROOM_PREFIX = exports.DOC_ID_PREFIX = void 0;
exports.toRoomId = toRoomId;
exports.fromRoomId = fromRoomId;
/** 文档 ID 前缀 */
exports.DOC_ID_PREFIX = "doc-";
/** WebSocket 房间前缀（房间 ID = 文档 ID） */
exports.ROOM_PREFIX = "room:";
/** 默认文档名 */
exports.DEFAULT_DOC_NAME = "Untitled";
/**
 * 构造 WebSocket 房间 ID
 *
 * @param docId Yjs 文档 ID
 * @returns 形如 "room:doc-xxx" 的房间标识
 */
function toRoomId(docId) {
    return `${exports.ROOM_PREFIX}${docId}`;
}
/**
 * 从 WebSocket 房间 ID 还原 Yjs 文档 ID
 *
 * 兼容输入已经是文档 ID（无前缀）的情况。
 */
function fromRoomId(roomId) {
    return roomId.startsWith(exports.ROOM_PREFIX) ? roomId.slice(exports.ROOM_PREFIX.length) : roomId;
}
//# sourceMappingURL=yjs-schema.js.map