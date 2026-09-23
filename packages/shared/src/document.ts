import { z } from "zod";

/**
 * Yjs 协同文档元数据 DTO
 *
 * 注意：Yjs 文档本身的二进制 state 单独走 bytea 字段，
 * 这里的 DocumentMeta 只是文档的元信息（名称、所有者、时间戳、协作者）
 */
export const CollaboratorSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  userId: z.string().min(1),
  createdAt: z.string().datetime(),
});

export type Collaborator = z.infer<typeof CollaboratorSchema>;

/**
 * 列表返回时带"当前用户对这篇文档的角色"标记
 * - "owner": 当前用户是文档所有者（可改名/可删除/可邀请）
 * - "collaborator": 当前用户是协作者（只能查看和协同编辑，不能改/删/邀请）
 */
export const DocumentRoleSchema = z.enum(["owner", "collaborator"]);
export type DocumentRole = z.infer<typeof DocumentRoleSchema>;

export const DocumentMetaSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  owner: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  // 公开链接开关：true 时任何登录用户都能通过链接访问
  isPublic: z.boolean().optional(),
  // 列表场景：当前用户对该文档的角色（owner / collaborator）
  // 单查场景：不返回该字段（前端可以从 owner 字段自己推断）
  role: DocumentRoleSchema.optional(),
});

export type DocumentMeta = z.infer<typeof DocumentMetaSchema>;

/** 创建文档时的输入 DTO */
export const CreateDocumentInputSchema = z.object({
  name: z.string().min(1).max(200),
  owner: z.string().nullable().default(null),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentInputSchema>;

/** 更新文档元数据的输入 DTO */
export const UpdateDocumentMetaInputSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  owner: z.string().nullable().optional(),
  // 公开链接开关：owner 可在编辑器顶部切换
  isPublic: z.boolean().optional(),
});

export type UpdateDocumentMetaInput = z.infer<typeof UpdateDocumentMetaInputSchema>;

/** 邀请协作者的输入 DTO */
export const AddCollaboratorInputSchema = z.object({
  username: z.string().min(1).max(100),
});

export type AddCollaboratorInput = z.infer<typeof AddCollaboratorInputSchema>;
