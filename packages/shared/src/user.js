"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AwarenessUserSchema = exports.UserSchema = void 0;
const zod_1 = require("zod");
/**
 * 协同编辑用户 DTO
 *
 * 暂不做 Auth，先用 mock 数据；后续接入 JWT 时只动 server 端 guard，
 * shared 包本身的 User 类型不动。
 */
exports.UserSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    /** 协同光标颜色，hex 格式 #RRGGBB */
    color: zod_1.z.string().regex(/^#[0-9a-fA-F]{6}$/, "color must be hex like #7c3aed"),
});
/** Awareness 协议里的用户信息（与 y-protocols awareness client state 对齐） */
exports.AwarenessUserSchema = exports.UserSchema.extend({
    /** 客户端在 Yjs 里的唯一 ID（Y.Doc.awareness.clientID） */
    clientId: zod_1.z.number(),
});
//# sourceMappingURL=user.js.map