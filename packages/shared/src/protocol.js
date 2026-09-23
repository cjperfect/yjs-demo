"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WsMessageSchema = exports.ErrorPayloadSchema = exports.DocMetaUpdatePayloadSchema = exports.RoomUsersPayloadSchema = exports.LeaveRoomPayloadSchema = exports.JoinRoomPayloadSchema = exports.WS_MESSAGE_TYPES = void 0;
exports.createWsMessage = createWsMessage;
const zod_1 = require("zod");
const user_1 = require("./user");
/**
 * WebSocket 业务消息协议
 *
 * Yjs 的二进制 sync/awareness frame 走 y-protocols 自身的 encoding，
 * 不经过这里的 JSON 通道。这里只定义业务辅助消息：
 * - 房间加入/离开
 * - 在线用户列表更新
 * - 文档元数据更新通知
 * - 错误回执
 */
exports.WS_MESSAGE_TYPES = {
    JOIN_ROOM: "join-room",
    LEAVE_ROOM: "leave-room",
    ROOM_USERS: "room-users",
    DOC_META_UPDATE: "doc-meta-update",
    ERROR: "error",
};
/** JoinRoom 消息 payload */
exports.JoinRoomPayloadSchema = zod_1.z.object({
    docId: zod_1.z.string().min(1),
    user: user_1.UserSchema,
});
/** LeaveRoom 消息 payload */
exports.LeaveRoomPayloadSchema = zod_1.z.object({
    docId: zod_1.z.string().min(1),
    userId: zod_1.z.string().min(1),
});
/** RoomUsers 消息 payload（服务端广播当前在线用户列表） */
exports.RoomUsersPayloadSchema = zod_1.z.object({
    docId: zod_1.z.string().min(1),
    users: zod_1.z.array(user_1.UserSchema),
});
/** DocMetaUpdate 消息 payload */
exports.DocMetaUpdatePayloadSchema = zod_1.z.object({
    docId: zod_1.z.string().min(1),
    /** 更新后的字段（部分更新） */
    patch: zod_1.z.object({
        name: zod_1.z.string().optional(),
        owner: zod_1.z.string().nullable().optional(),
    }),
});
/** Error 消息 payload */
exports.ErrorPayloadSchema = zod_1.z.object({
    message: zod_1.z.string(),
    code: zod_1.z.string().optional(),
});
/**
 * WebSocket 业务消息判别式联合
 *
 * 用 discriminatedUnion 收口：客户端收到消息后可直接按 type 分发
 */
exports.WsMessageSchema = zod_1.z.discriminatedUnion("type", [
    zod_1.z.object({ type: zod_1.z.literal(exports.WS_MESSAGE_TYPES.JOIN_ROOM), payload: exports.JoinRoomPayloadSchema }),
    zod_1.z.object({ type: zod_1.z.literal(exports.WS_MESSAGE_TYPES.LEAVE_ROOM), payload: exports.LeaveRoomPayloadSchema }),
    zod_1.z.object({ type: zod_1.z.literal(exports.WS_MESSAGE_TYPES.ROOM_USERS), payload: exports.RoomUsersPayloadSchema }),
    zod_1.z.object({ type: zod_1.z.literal(exports.WS_MESSAGE_TYPES.DOC_META_UPDATE), payload: exports.DocMetaUpdatePayloadSchema }),
    zod_1.z.object({ type: zod_1.z.literal(exports.WS_MESSAGE_TYPES.ERROR), payload: exports.ErrorPayloadSchema }),
]);
/**
 * 构造消息的工具（避免每次手写 type 字段）
 *
 * 返回值是 WsMessage，不是 unknown。
 */
function createWsMessage(msg) {
    return msg;
}
//# sourceMappingURL=protocol.js.map