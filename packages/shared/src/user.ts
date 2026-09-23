import { z } from "zod";

/**
 * 协同编辑用户 DTO
 *
 * 暂不做 Auth，先用 mock 数据；后续接入 JWT 时只动 server 端 guard，
 * shared 包本身的 User 类型不动。
 */
export const UserSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  /** 协同光标颜色，hex 格式 #RRGGBB */
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "color must be hex like #7c3aed"),
});

export type User = z.infer<typeof UserSchema>;

/** Awareness 协议里的用户信息（与 y-protocols awareness client state 对齐） */
export const AwarenessUserSchema = UserSchema.extend({
  /** 客户端在 Yjs 里的唯一 ID（Y.Doc.awareness.clientID） */
  clientId: z.number(),
});

export type AwarenessUser = z.infer<typeof AwarenessUserSchema>;
