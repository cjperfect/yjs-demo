import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import { DocumentsService } from "./documents.service.js";
import type {
  AddCollaboratorInput,
  CreateDocumentInput,
  UpdateDocumentMetaInput,
} from "@yjs-demo/shared";

/**
 * 文档元数据 + 协作者 REST API
 *
 * 路由前缀: /api/documents
 *
 * 文档元数据：
 *   GET    /api/documents        列出当前 owner 名下 + 协作给我的所有文档（带 role 标记）
 *   GET    /api/documents/:id    查询单个文档（owner 或 collaborator 都能看）
 *   POST   /api/documents        创建文档（owner 取自 header，覆盖 body）
 *   PATCH  /api/documents/:id    重命名文档（仅 doc.owner）
 *   DELETE /api/documents/:id    删除文档（仅 doc.owner，cascade 删 collaborators）
 *
 * 协作者管理（仅 doc.owner 可操作 add/remove，list 协作者本人也能看）：
 *   GET    /api/documents/:id/collaborators        列协作者
 *   POST   /api/documents/:id/collaborators        加协作者（body: {username}）
 *   DELETE /api/documents/:id/collaborators/:u     删协作者
 *
 * Owner 通过 HTTP header `x-owner` 传递（前端登录态写 cookie 后，
 * server component 用 next/headers cookies() 读，client 用 useUser 拿）。
 *
 * HTTP header 值要求 ASCII（ByteString），中文用户名会被前端
 * encodeURIComponent 编码；本 controller 用 decodeOwner 解码后再用。
 * 简单登录系统无密码，header 本身不防伪造，但保证列表/单查的隔离体验。
 *
 * Yjs 二进制 sync/awareness 走 WebSocket /yjs/:docId，不在这里。
 */
@Controller("api/documents")
export class DocumentsController {
  constructor(private readonly documents: DocumentsService) {}

  /**
   * 解码 x-owner header：前端用 encodeURIComponent 把中文用户名编成 ASCII
   * 再放进 HTTP header；这里 decode 还原成原始用户名。
   * 空值/解码失败时返回 undefined（service 视为"未带 owner"）。
   */
  private decodeOwner(raw?: string): string | undefined {
    if (!raw) return undefined;
    try {
      return decodeURIComponent(raw);
    } catch {
      // 不合法的 % 序列：直接当原始值用（容错）
      return raw;
    }
  }

  @Get()
  async list(@Headers("x-owner") owner?: string) {
    return this.documents.listDocuments(this.decodeOwner(owner));
  }

  @Get(":id")
  async get(@Param("id") id: string, @Headers("x-owner") owner?: string) {
    const doc = await this.documents.getDocument(id, this.decodeOwner(owner));
    if (!doc) {
      return { error: "not_found", id };
    }
    return doc;
  }

  @Post()
  async create(
    @Body() body: CreateDocumentInput,
    @Headers("x-owner") owner?: string,
  ) {
    // owner 始终取自 header（前端已 URL-encode），防止前端在 body 里伪造他人 owner
    return this.documents.createDocument({
      name: body.name,
      owner: this.decodeOwner(owner) ?? body.owner ?? null,
    });
  }

  @Patch(":id")
  async update(
    @Param("id") id: string,
    @Body() body: UpdateDocumentMetaInput,
    @Headers("x-owner") owner?: string,
  ) {
    const o = this.decodeOwner(owner);
    // 支持同时改 name 和 isPublic，各自校验 owner 权限
    if (body.name !== undefined) {
      await this.documents.renameDocument(id, body.name, o);
    }
    if (body.isPublic !== undefined) {
      await this.documents.setPublic(id, body.isPublic, o);
    }
    // 统一返回最新状态（rename/setPublic 各自已做 owner 校验）
    const doc = await this.documents.getDocument(id, o);
    if (!doc) {
      return { error: "not_found", id };
    }
    return doc;
  }

  @Delete(":id")
  async delete(@Param("id") id: string, @Headers("x-owner") owner?: string) {
    const deleted = await this.documents.deleteDocument(id, this.decodeOwner(owner));
    return { id, deleted };
  }

  // ─── 协作者管理 ────────────────────────────────────────────

  @Get(":id/collaborators")
  async listCollaborators(
    @Param("id") id: string,
    @Headers("x-owner") owner?: string,
  ) {
    const list = await this.documents.listCollaborators(id, this.decodeOwner(owner));
    if (list === null) {
      return { error: "not_found", id };
    }
    return list;
  }

  @Post(":id/collaborators")
  async addCollaborator(
    @Param("id") id: string,
    @Body() body: AddCollaboratorInput,
    @Headers("x-owner") owner?: string,
  ) {
    if (!body?.username || typeof body.username !== "string") {
      throw new BadRequestException("body.username is required");
    }
    const result = await this.documents.addCollaborator(
      id,
      body.username,
      this.decodeOwner(owner),
    );
    if (result === null) {
      return { error: "not_found", id };
    }
    if ("error" in result) {
      return { error: result.error, id };
    }
    return result;
  }

  @Delete(":id/collaborators/:username")
  async removeCollaborator(
    @Param("id") id: string,
    @Param("username") username: string,
    @Headers("x-owner") owner?: string,
  ) {
    // username 是 URL 路径参数，NestJS 已 decode；直接用
    const result = await this.documents.removeCollaborator(
      id,
      username,
      this.decodeOwner(owner),
    );
    if (result === null) {
      return { error: "not_found", id };
    }
    if (typeof result === "object" && "error" in result) {
      return { error: result.error, id };
    }
    return { id, username, removed: result };
  }
}
