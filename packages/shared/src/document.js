"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateDocumentMetaInputSchema = exports.CreateDocumentInputSchema = exports.DocumentMetaSchema = void 0;
const zod_1 = require("zod");
/**
 * Yjs 协同文档元数据 DTO
 *
 * 注意：Yjs 文档本身的二进制 state 单独走 bytea 字段，
 * 这里的 DocumentMeta 只是文档的元信息（名称、所有者、时间戳）
 */
exports.DocumentMetaSchema = zod_1.z.object({
    id: zod_1.z.string().min(1),
    name: zod_1.z.string().min(1),
    owner: zod_1.z.string().nullable(),
    createdAt: zod_1.z.string().datetime(),
    updatedAt: zod_1.z.string().datetime(),
});
/** 创建文档时的输入 DTO */
exports.CreateDocumentInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200),
    owner: zod_1.z.string().nullable().default(null),
});
/** 更新文档元数据的输入 DTO */
exports.UpdateDocumentMetaInputSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    owner: zod_1.z.string().nullable().optional(),
});
//# sourceMappingURL=document.js.map