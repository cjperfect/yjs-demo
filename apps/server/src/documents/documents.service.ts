import { Injectable } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { nanoid } from "nanoid";
import type {
  DocumentMeta,
  CreateDocumentInput,
  Collaborator,
  DocumentRole,
} from "@yjs-demo/shared";

/**
 * 文档元数据服务（CRUD + owner 隔离 + 协作者授权）
 *
 * 注意：Yjs 文档本身的二进制 state 走 YjsPersistenceService，
 * 这里只管 documents 表里除 state 字段外的元数据。
 *
 * 隔离策略：
 * - 列表：返回 owner 名下文档 + owner 作为 collaborator 的文档（带 role 标记）
 * - 单查：owner 是 doc.owner 或 doc.collaborators 包含 owner 都能访问
 * - 改/删：仅 doc.owner 可操作（collaborator 不能改/删/邀请）
 */
@Injectable()
export class DocumentsService extends PrismaClient {
  /** 列出文档；owner 给定时返回 owner 名下 + owner 作为 collaborator 的所有文档 */
  async listDocuments(owner?: string | null): Promise<DocumentMeta[]> {
    if (!owner) {
      // 未带 owner：列所有文档（向后兼容，正常流程前端总会带 owner）
      const docs = await this.document.findMany({
        orderBy: { updatedAt: "desc" },
        select: docMetaSelect,
      });
      return docs.map((d) => toMeta(d, "owner"));
    }
    // owner 名下的文档
    const ownDocs = await this.document.findMany({
      where: { owner },
      orderBy: { updatedAt: "desc" },
      select: docMetaSelect,
    });
    // owner 作为 collaborator 的文档
    const collabDocs = await this.document.findMany({
      where: { collaborators: { some: { userId: owner } } },
      orderBy: { updatedAt: "desc" },
      select: docMetaSelect,
    });
    const ownIds = new Set(ownDocs.map((d) => d.id));
    const merged = [
      ...ownDocs.map((d) => toMeta(d, "owner" as DocumentRole)),
      ...collabDocs
        .filter((d) => !ownIds.has(d.id))
        .map((d) => toMeta(d, "collaborator" as DocumentRole)),
    ];
    // 按 updatedAt desc 重排（两段已经各自 desc，但合并后要再排一次）
    merged.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return merged;
  }

  /** 创建新文档（state 留空，由 YjsRoom 首次 save 时填充） */
  async createDocument(input: CreateDocumentInput): Promise<DocumentMeta> {
    const doc = await this.document.create({
      data: {
        id: `doc-${nanoid(12)}`,
        name: input.name,
        owner: input.owner,
      },
    });
    return toMeta(doc, "owner");
  }

  /**
   * 按 ID 查文档
   * - 公开文档（isPublic=true）：任何登录用户都能访问（role=collaborator）
   * - 私有文档：仅当文档属于 owner 或 owner 是 collaborator 才返回；
   *   不属于则视作 not_found（避免泄漏"该文档存在但你不属于"的信息）
   */
  async getDocument(
    id: string,
    owner?: string | null,
  ): Promise<DocumentMeta | null> {
    const doc = await this.document.findUnique({
      where: { id },
      select: docMetaSelect,
    });
    if (!doc) return null;
    // 公开文档跳过 owner 校验：任何登录用户都能通过链接访问
    if (!doc.isPublic) {
      if (owner !== undefined && owner !== null) {
        const isOwner = doc.owner === owner;
        const isCollab = await this.isCollaborator(id, owner);
        if (!isOwner && !isCollab) return null;
      }
    }
    return toMeta(doc, doc.owner === owner ? "owner" : "collaborator");
  }

  /** 重命名文档；仅当 owner 是 doc.owner 才允许（collaborator 不能改名） */
  async renameDocument(
    id: string,
    name: string,
    owner?: string | null,
  ): Promise<DocumentMeta | null> {
    const existing = await this.document.findUnique({ where: { id } });
    if (!existing) return null;
    if (owner !== undefined && owner !== null && existing.owner !== owner) {
      return null;
    }
    const doc = await this.document.update({
      where: { id },
      data: { name },
      select: docMetaSelect,
    });
    return toMeta(doc, "owner");
  }

  /** 删除文档（连带 Yjs state + collaborators）；仅 doc.owner 可删 */
  async deleteDocument(id: string, owner?: string | null): Promise<boolean> {
    const existing = await this.document.findUnique({ where: { id } });
    if (!existing) return false;
    if (owner !== undefined && owner !== null && existing.owner !== owner) {
      return false;
    }
    // onDelete: Cascade 会自动删 collaborators 行
    await this.document.delete({ where: { id } });
    return true;
  }

  // ─── 公开链接 ──────────────────────────────────────────────

  /** 切换文档公开/私有；仅 doc.owner 可操作 */
  async setPublic(
    id: string,
    isPublic: boolean,
    owner?: string | null,
  ): Promise<DocumentMeta | null> {
    const existing = await this.document.findUnique({ where: { id } });
    if (!existing) return null;
    if (owner !== undefined && owner !== null && existing.owner !== owner) {
      return null;
    }
    const doc = await this.document.update({
      where: { id },
      data: { isPublic },
      select: docMetaSelect,
    });
    return toMeta(doc, "owner");
  }

  // ─── 协作者管理 ────────────────────────────────────────────

  /** 列出文档的所有协作者；仅 doc.owner 或 collaborator 可看 */
  async listCollaborators(
    id: string,
    owner?: string | null,
  ): Promise<Collaborator[] | null> {
    const doc = await this.document.findUnique({
      where: { id },
      select: { owner: true, collaborators: true },
    });
    if (!doc) return null;
    if (owner !== undefined && owner !== null) {
      const isOwner = doc.owner === owner;
      const isCollab = doc.collaborators.some((c) => c.userId === owner);
      if (!isOwner && !isCollab) return null;
    }
    return doc.collaborators.map((c) => ({
      id: c.id,
      documentId: c.documentId,
      userId: c.userId,
      createdAt: c.createdAt.toISOString(),
    }));
  }

  /** 加协作者；仅 doc.owner 可加；已存在则返回已有记录（去重） */
  async addCollaborator(
    id: string,
    userId: string,
    owner?: string | null,
  ): Promise<Collaborator | { error: string } | null> {
    const doc = await this.document.findUnique({ where: { id } });
    if (!doc) return null;
    if (owner !== undefined && owner !== null && doc.owner !== owner) {
      return { error: "forbidden" };
    }
    if (doc.owner === userId) {
      return { error: "is_owner" };
    }
    // upsert：已存在则返回已有，不存在则新建（@@unique 保证幂等）
    const collab = await this.collaborator.upsert({
      where: {
        documentId_userId: { documentId: id, userId },
      },
      update: {},
      create: { documentId: id, userId },
    });
    return {
      id: collab.id,
      documentId: collab.documentId,
      userId: collab.userId,
      createdAt: collab.createdAt.toISOString(),
    };
  }

  /** 删协作者；仅 doc.owner 可删 */
  async removeCollaborator(
    id: string,
    userId: string,
    owner?: string | null,
  ): Promise<boolean | { error: string } | null> {
    const doc = await this.document.findUnique({ where: { id } });
    if (!doc) return null;
    if (owner !== undefined && owner !== null && doc.owner !== owner) {
      return { error: "forbidden" };
    }
    try {
      await this.collaborator.delete({
        where: { documentId_userId: { documentId: id, userId } },
      });
      return true;
    } catch {
      // 不存在的 collaborator → 视作已删除
      return false;
    }
  }

  /** 判断 userId 是否为 docId 的协作者 */
  private async isCollaborator(docId: string, userId: string): Promise<boolean> {
    const count = await this.collaborator.count({
      where: { documentId: docId, userId },
    });
    return count > 0;
  }
}

const docMetaSelect = {
  id: true,
  name: true,
  owner: true,
  isPublic: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Prisma Document 行的类型（结构化定义，避免依赖 @prisma/client 的 Document 命名导出） */
interface DocumentRow {
  id: string;
  name: string;
  owner: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** 把 Prisma Document 行转成 shared 包的 DocumentMeta DTO */
function toMeta(doc: DocumentRow, role: DocumentRole): DocumentMeta {
  return {
    id: doc.id,
    name: doc.name,
    owner: doc.owner,
    isPublic: doc.isPublic,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    role,
  };
}
