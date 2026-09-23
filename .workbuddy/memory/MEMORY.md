# yjs-demo 项目长期记忆

## 项目定位

协同文档 demo：基于 Yjs CRDT 的实时协同编辑，pnpm monorepo 架构。
工作目录：/Users/chenjiang/Desktop/yjs-demo

## 技术栈（已敲定）

- **协同算法**：Yjs CRDT（不用 OT，不用 Automerge）
- **编辑器**：Tiptap v2 + y-prosemirror + CollaborationCursor
- **前端**：Next.js 15 (App Router) + React 19 + Tailwind v4 + Turbopack
- **后端**：NestJS 11 + 手动 ws.WebSocketServer（不用 WsAdapter）
- **数据库**：复用 pgvector/pgvector:pg17 + Prisma 5，Yjs state 存 bytea
- **缓存**：Redis 7（在线状态缓存）
- **monorepo**：pnpm workspace + Turborepo + catalog（集中管理依赖版本）
- **Auth**：暂不做，先用 mock 用户

## 项目结构

```
yjs-demo/
├── apps/
│   ├── web/           # Next.js + Tiptap + y-websocket client
│   └── server/       # NestJS + ws.WebSocketServer + YjsService
├── packages/
│   ├── shared/       # DTO + WebSocket 协议 + Yjs 常量
│   ├── editor/       # Tiptap 配置 + Yjs 绑定封装
│   └── yjs-server/   # YjsRoom + YjsRoomManager + sync-handler
├── docker-compose.yml  # pgvector + redis
└── pnpm-workspace.yaml # catalog + nodeLinker: hoisted
```

## 关键项目约定（必读）

1. **packages 相对 import 不带 .js 后缀**：tsup dual format bundle 时 .js 后缀会导致 export 变 void 0 placeholder。所有 `from "./xxx"` 不带 .js。
2. **packages 的 dts 生成**：tsup `dts: false` + 独立 `tsc -p tsconfig.dts.json`（emitDeclarationOnly）。dev script 是 `tsc -p tsconfig.dts.json && tsup --watch`（先生成一次 dts 再 watch）。
3. **apps/server tsconfig 不用 paths**：paths 指向 packages/src 会让 nest build 把 packages 源码编译进 dist。依赖 packages 的 dist 产物。
4. **apps/server WebSocket 不用 @WebSocketGateway**：WsAdapter 的 path 精确匹配无法处理 /yjs/:docId。main.ts 手动创建 ws.WebSocketServer + httpServer.on("upgrade") + handleUpgrade。
5. **Prisma schema 不指定 output**：nodeLinker=hoisted 模式下默认生成到 monorepo 根 node_modules/.prisma/client。
6. **pnpm 12 配置位置**：nodeLinker、allowBuilds 都在 pnpm-workspace.yaml（不在 .npmrc，不在 package.json 的 pnpm 字段）。
7. **apps/web CSS**：不用 `@import "@yjs-demo/editor/styles.css"`（Tailwind v4 + Next.js 解析失败），editor 样式直接合并到 web 的 globals.css。

## 启动命令

```bash
# 启动数据库（docker compose，需要 colima 在 PATH）
export PATH="/opt/homebrew/bin:$PATH"
cd /Users/chenjiang/Desktop/yjs-demo
docker-compose up -d          # pgvector + redis
cd apps/server
DATABASE_URL="postgresql://yjs:yjs@localhost:5432/yjs_demo?schema=public" pnpm prisma generate --schema=prisma/schema.prisma
DATABASE_URL="postgresql://yjs:yjs@localhost:5432/yjs_demo?schema=public" pnpm prisma db push --schema=prisma/schema.prisma

# 启动应用（分两个终端）
cd apps/server && pnpm dev      # NestJS 3001
cd apps/web && pnpm dev         # Next.js 3000
```

## 访问入口

- Web: http://localhost:3000
- Server REST: http://localhost:3001/api/documents
- Server WebSocket: ws://localhost:3001/yjs/:docId

## 测试协同

访问 http://localhost:3000/editor/new 会创建文档并跳转；开两个浏览器窗口访问同一 docId URL，可看到实时协同光标和内容同步。
