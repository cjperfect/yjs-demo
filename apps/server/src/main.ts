import { config } from "dotenv";
import { NestFactory } from "@nestjs/core";
import { WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { Socket } from "net";
import { AppModule } from "./app.module.js";
import { YjsService } from "./yjs/yjs.service.js";

// 加载仓库根的 .env（apps/server 在子目录，所以 ../../）
config({ path: "../../.env" });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: process.env.SERVER_CORS_ORIGIN?.split(",") ?? ["http://localhost:3000"],
    credentials: true,
  });

  const port = Number(process.env.SERVER_PORT ?? 3001);

  // 手动创建 ws.WebSocketServer，绑定到 NestJS HTTP server 的 upgrade 事件
  // （不用 NestJS WsAdapter，因为其 path 是精确匹配，无法处理 /yjs/:docId 动态路径）
  const httpServer = app.getHttpServer();
  const wss = new WebSocketServer({ noServer: true });
  const yjsService = app.get(YjsService);

  httpServer.on("upgrade", (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const url = req.url ?? "";
    // 只处理 /yjs/ 前缀的升级请求，其他交给 NestJS 默认处理
    if (url.startsWith("/yjs/")) {
      wss.handleUpgrade(req, socket, head, (ws) => {
        void yjsService.handleConnection(ws, req);
      });
    }
    // 非 /yjs/ 前缀的升级请求：socket 会被默认拒绝（NestJS 不处理）
  });

  await app.listen(port);

  console.log(`[server] listening on http://localhost:${port}`);
  console.log(`[server] WebSocket path: ws://localhost:${port}/yjs/:docId`);

  // 优雅停机
  process.on("SIGINT", async () => {
    await yjsService.disposeAll();
    await app.close();
    process.exit(0);
  });
}

void bootstrap();

