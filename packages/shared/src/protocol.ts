import { z } from "zod";
import { UserSchema } from "./user";

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
export const WS_MESSAGE_TYPES = {
  JOIN_ROOM: "join-room",
  LEAVE_ROOM: "leave-room",
  ROOM_USERS: "room-users",
  DOC_META_UPDATE: "doc-meta-update",
  ERROR: "error",
} as const;

export type WsMessageType = (typeof WS_MESSAGE_TYPES)[keyof typeof WS_MESSAGE_TYPES];

/** JoinRoom 消息 payload */
export const JoinRoomPayloadSchema = z.object({
  docId: z.string().min(1),
  user: UserSchema,
});
export type JoinRoomPayload = z.infer<typeof JoinRoomPayloadSchema>;

/** LeaveRoom 消息 payload */
export const LeaveRoomPayloadSchema = z.object({
  docId: z.string().min(1),
  userId: z.string().min(1),
});
export type LeaveRoomPayload = z.infer<typeof LeaveRoomPayloadSchema>;

/** RoomUsers 消息 payload（服务端广播当前在线用户列表） */
export const RoomUsersPayloadSchema = z.object({
  docId: z.string().min(1),
  users: z.array(UserSchema),
});
export type RoomUsersPayload = z.infer<typeof RoomUsersPayloadSchema>;

/** DocMetaUpdate 消息 payload */
export const DocMetaUpdatePayloadSchema = z.object({
  docId: z.string().min(1),
  /** 更新后的字段（部分更新） */
  patch: z.object({
    name: z.string().optional(),
    owner: z.string().nullable().optional(),
  }),
});
export type DocMetaUpdatePayload = z.infer<typeof DocMetaUpdatePayloadSchema>;

/** Error 消息 payload */
export const ErrorPayloadSchema = z.object({
  message: z.string(),
  code: z.string().optional(),
});
export type ErrorPayload = z.infer<typeof ErrorPayloadSchema>;

/**
 * WebSocket 业务消息判别式联合
 *
 * 用 discriminatedUnion 收口：客户端收到消息后可直接按 type 分发
 */
export const WsMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(WS_MESSAGE_TYPES.JOIN_ROOM), payload: JoinRoomPayloadSchema }),
  z.object({ type: z.literal(WS_MESSAGE_TYPES.LEAVE_ROOM), payload: LeaveRoomPayloadSchema }),
  z.object({ type: z.literal(WS_MESSAGE_TYPES.ROOM_USERS), payload: RoomUsersPayloadSchema }),
  z.object({ type: z.literal(WS_MESSAGE_TYPES.DOC_META_UPDATE), payload: DocMetaUpdatePayloadSchema }),
  z.object({ type: z.literal(WS_MESSAGE_TYPES.ERROR), payload: ErrorPayloadSchema }),
]);

export type WsMessage = z.infer<typeof WsMessageSchema>;

/**
 * 构造消息的工具（避免每次手写 type 字段）
 *
 * 返回值是 WsMessage，不是 unknown。
 */
export function createWsMessage<T extends WsMessage>(msg: T): T {
  return msg;
}
