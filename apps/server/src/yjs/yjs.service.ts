import { Injectable, Logger, Module } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";
import { YjsRoomManager } from "./room-manager.js";
import { createWsConnection } from "./room.js";
import type { YjsPersistence } from "./types.js";
import type { WebSocket } from "ws";
import type { IncomingMessage } from "http";

/**
 * Yjs 协同服务 + NestJS 模块
 *
 * YjsService 同时实现 YjsPersistence 接口（loadState/saveState），
 * 把 Yjs 文档二进制 state 存到 Postgres bytea 字段。
 *
 * 不用 NestJS 的 @WebSocketGateway（其 WsAdapter 用 pathname 精确匹配 path，
 * 无法处理 /yjs/:docId 动态路径），改为 main.ts 手动创建 ws.WebSocketServer
 * 绑定 httpServer 的 upgrade 事件，调用本 service 的 handleConnection。
 *
 * 文件同时声明 YjsModule（@Module），让 app.module 直接引用，
 * 避免为 8 行的模块声明单独拆一个文件。
 */
@Injectable()
export class YjsService extends PrismaClient implements YjsPersistence {
  private readonly logger = new Logger(YjsService.name);
  private readonly roomManager: YjsRoomManager;

  constructor() {
    super();
    this.roomManager = new YjsRoomManager(this, 2000, 30_000);
  }

  /** 加载 docId 对应的 Yjs state 二进制（Postgres bytea） */
  async loadState(docId: string): Promise<Uint8Array | null> {
    const doc = await this.document.findUnique({
      where: { id: docId },
      select: { state: true },
    });
    if (!doc?.state) return null;
    const buf = Buffer.from(doc.state);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  }

  /** 覆盖式保存 docId 对应的 Yjs state 二进制 */
  async saveState(docId: string, state: Uint8Array): Promise<void> {
    const buf = Buffer.from(state);
    await this.document.upsert({
      where: { id: docId },
      create: { id: docId, name: docId, state: buf },
      update: { state: buf },
    });
  }

  /**
   * 处理新的 WebSocket 连接
   *
   * @param ws 已升级的 WebSocket
   * @param req HTTP 升级请求（带 url，用于解析 docId）
   */
  async handleConnection(ws: WebSocket, req: IncomingMessage): Promise<void> {
    const urlPath = req.url ?? "";
    const match = urlPath.match(/^\/yjs\/([^/?]+)/);
    const docId = match?.[1];

    if (!docId) {
      this.logger.warn(`Connection rejected: no docId in url ${urlPath}`);
      ws.close(4000, "missing docId");
      return;
    }

    try {
      const room = await this.roomManager.getOrCreateRoom(docId);
      const clientId = this.generateClientId();

      const conn = createWsConnection(ws, clientId);
      room.addConnection(conn);

      this.logger.log(`Client connected: docId=${docId} clientId=${clientId}`);
    } catch (err) {
      this.logger.error("handleConnection error:", err);
      ws.close(1011, "internal error");
    }
  }

  /** 生成 Yjs clientId（足够大的随机数） */
  private generateClientId(): number {
    return Math.floor(Math.random() * 0xffffffff);
  }

  /** 优雅停机时销毁所有房间 */
  async disposeAll(): Promise<void> {
    await this.roomManager.disposeAll();
    await this.$disconnect();
  }
}

@Module({
  providers: [YjsService],
  exports: [YjsService],
})
export class YjsModule {}
