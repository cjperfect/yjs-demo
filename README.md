# yjs-demo

基于 Yjs CRDT 的协同文档编辑系统，pnpm monorepo 架构。

NestJS 后端托管 WebSocket 同步房间，Next.js 前端用 Tiptap 编辑器接入，多人实时编辑同一份文档，CRDT 数学保证收敛，支持离线编辑。

## 架构总览

```mermaid
flowchart LR
    subgraph Browser["浏览器 (apps/web)"]
        Editor["Tiptap 编辑器<br/>components/editor/"]
        YWS["y-websocket Provider"]
        Editor --> YWS
    end

    subgraph Server["NestJS 后端 (apps/server)"]
        WS["ws.WebSocketServer<br/>手动绑 upgrade"]
        RoomMgr["YjsRoomManager<br/>src/yjs/room-manager.ts"]
        Sync["sync-handler<br/>y-protocols"]
        REST["REST /api/documents"]
        WS --> RoomMgr
        RoomMgr --> Sync
    end

    subgraph Persist["持久化"]
        PG[("PostgreSQL 17<br/>pgvector 镜像<br/>Yjs state = bytea")]
        Redis[("Redis 7<br/>在线状态缓存")]
    end

    YWS -->|ws://localhost:3001/yjs/:docId| WS
    Editor -.->|REST 创建/列表文档| REST
    RoomMgr -->|loadState / saveState| PG
    RoomMgr -.->|Awareness 快照| Redis
```

> **目录约定**：服务端协同核心（房间、同步协议、WS 适配）放在 `apps/server/src/yjs/`，
> 前端编辑器封装（Tiptap + y-websocket）放在 `apps/web/components/editor/`，
> 跨端共享的 DTO 与协议常量放在 `packages/shared/`。

## 技术栈

| 层级 | 选型 | 说明 |
|------|------|------|
| 协同算法 | Yjs (CRDT) | `y-protocols` 处理 sync/awareness，CRDT 无需服务端 OT 变换，支持离线 |
| 富文本编辑器 | Tiptap v2 + `y-prosemirror` | ProseMirror 之上的封装，协同光标开箱即用 |
| 前端 | Next.js 15 (App Router) + React 19 + Tailwind v4 | Turbopack 开发模式 |
| 后端 | NestJS 11 | 手动绑 `ws.WebSocketServer` 到 HTTP server 的 upgrade 事件 |
| 数据库 | PostgreSQL 17 (pgvector 镜像) + Prisma | Yjs 二进制 state 存 `bytea`，元数据走常规表 |
| 缓存 | Redis 7 | 在线用户、Awareness 快照（已搭好，待接入） |
| monorepo | pnpm workspace + Turborepo | catalog 集中管理依赖版本 |
| 类型共享 | `@yjs-demo/shared` | DTO、Yjs schema、WebSocket 协议常量跨端共用 |

## 目录结构

```
yjs-demo/
├── apps/
│   ├── web/                  # Next.js 15 + React 19 + Tailwind v4
│   │   ├── app/
│   │   │   ├── page.tsx                  # 文档列表页
│   │   │   ├── login/page.tsx            # 极简登录页
│   │   │   └── editor/[docId]/           # 协同编辑页（dynamic ssr:false）
│   │   │       ├── page.tsx              # server component：拉文档元数据
│   │   │       └── editor-client.tsx     # client component：标题/邀请/删除等交互
│   │   ├── components/
│   │   │   ├── editor/                   # 协同编辑器封装（原 packages/editor 并入）
│   │   │   │   ├── use-collaboration.ts  # React hook：Y.Doc + Provider + Tiptap
│   │   │   │   ├── collab-editor.tsx     # CollabEditor 组件（状态条/头像/工具栏）
│   │   │   │   ├── editor-toolbar.tsx    # 富文本工具栏
│   │   │   │   └── index.ts
│   │   │   ├── user-provider.tsx         # 极简登录（localStorage + cookie）
│   │   │   ├── require-user.tsx          # 未登录守卫
│   │   │   ├── app-header.tsx
│   │   │   └── document-list-item.tsx
│   │   ├── lib/document-utils.ts         # 相对时间/取色等展示工具
│   │   ├── next.config.ts                # rewrites: /api/* 与 /yjs/* → 3001
│   │   └── package.json
│   └── server/              # NestJS 11 + Prisma + WebSocket
│       ├── src/
│       │   ├── main.ts                   # 入口：手动绑 wss.handleUpgrade
│       │   ├── app.module.ts
│       │   ├── yjs/                      # 服务端协同核心（原 packages/yjs-server 并入，5 个文件分层）
│       │   │   ├── types.ts              # 契约层：YjsPersistence / YjsConnection / RoomInfo
│       │   │   ├── sync-handler.ts       # 协议层：y-protocols sync/awareness 消息分发
│       │   │   ├── room.ts               # 房间层：WS 适配（createWsConnection）+ YjsRoom
│       │   │   ├── room-manager.ts       # 管理层：房间池 + 惰性创建 + 空闲销毁
│       │   │   └── yjs.service.ts        # 接入层：NestJS service（Prisma 持久化）+ YjsModule 声明
│       │   ├── documents/                # REST CRUD + 协作者授权
│       │   └── info/                     # 局域网 IP 探测（复制链接用）
│       ├── prisma/schema.prisma          # Document（state bytea）+ Collaborator 表
│       ├── test-collab.mjs               # 协同 demo 测试脚本
│       └── package.json
├── packages/
│   └── shared/             # @yjs-demo/shared — DTO + 协议常量（唯一保留的 package）
│       └── src/
│           ├── user.ts                   # User / AwarenessUser 类型
│           ├── document.ts               # DocumentMeta / Collaborator DTO
│           ├── yjs-schema.ts             # 房间 ID 约定、文档 ID 前缀常量
│           └── protocol.ts               # WebSocket 消息（zod discriminatedUnion）
├── docker/
│   └── postgres/init.sql                # 启用 pgvector 扩展
├── docker-compose.yml                   # PostgreSQL + Redis
├── pnpm-workspace.yaml                  # workspace + catalog + nodeLinker
├── turbo.json                           # build/dev/lint/typecheck pipeline
├── tsconfig.base.json
├── .env.example
└── package.json
```

## 前置依赖

| 工具 | 版本要求 | 说明 |
|------|---------|------|
| Node.js | >= 22.0.0 | 推荐用版本管理器（nvm/fnm）安装 |
| pnpm | >= 9.5（实测 12.4.1） | catalog 特性需要 9.5+ |
| Docker | 任意现代版本 | 跑 PostgreSQL + Redis，macOS 推荐 colima |

**macOS Docker 提示**：若用 colima，先 `colima start` 再跑 docker 命令。docker 二进制通常在 `/opt/homebrew/bin/docker`，若不在 PATH，执行 `export PATH="/opt/homebrew/bin:$PATH"`。

## 快速开始

一键跑通完整协同 demo：

```bash
# 1. 安装依赖（catalog 自动解析，workspace 自动链接）
pnpm install

# 2. 复制环境变量
cp .env.example .env

# 3. 启动 PostgreSQL + Redis（Docker）
pnpm db:up

# 4. 生成 Prisma client + 同步 schema 到数据库
cd apps/server
pnpm prisma:generate
pnpm prisma:push
cd ../..

# 5. 构建共享包（apps 运行时依赖 packages/shared 的 dist）
pnpm --filter "@yjs-demo/shared" build

# 6. 启动后端 + 前端（两个终端各一个，或用 turbo 并行）
pnpm --filter @yjs-demo/server dev   # 终端 1：NestJS on :3001
pnpm --filter @yjs-demo/web dev      # 终端 2：Next.js on :3000
```

打开浏览器：
- 文档列表：http://localhost:3000
- 协同编辑：http://localhost:3000/editor/<docId>（任意 docId 即可创建房间）
- **开两个浏览器窗口访问同一 URL，即可看到协同光标和实时同步**

## 各项目启动流程

### 根目录脚本（推荐）

| 命令 | 作用 |
|------|------|
| `pnpm install` | 安装依赖，解析 catalog，链接 workspace 包 |
| `pnpm db:up` | 启动 PostgreSQL + Redis 容器 |
| `pnpm db:down` | 停止容器（保留数据） |
| `pnpm db:reset` | 销毁并重建容器（清空所有数据） |
| `pnpm db:logs` | 查看数据库日志 |
| `pnpm build` | Turborepo 并行构建所有 package + app |
| `pnpm dev` | Turborepo 并行启动所有 dev 模式（不推荐，日志混在一起） |
| `pnpm typecheck` | 全 workspace 类型检查 |
| `pnpm test:collab` | 跑协同 demo 测试脚本（需 server 已启动） |
| `pnpm clean` | 清理所有 dist + .turbo + node_modules |

### packages/shared — 共享类型包

```bash
cd packages/shared
pnpm build        # tsup 出 ESM+CJS，tsc 出 .d.ts
pnpm dev          # 先出一次 dts，再 tsup --watch
pnpm typecheck    # tsc --noEmit
```

产物：`dist/index.js`（ESM）、`dist/index.cjs`（CJS）、`dist/index.d.ts`。apps/server 和 apps/web 都依赖这个产物。

### apps/server — NestJS 后端

```bash
cd apps/server

# 首次启动（或 schema 变更后）
pnpm prisma:generate    # 生成 Prisma client 到 ../../node_modules/.prisma/client
pnpm prisma:push        # 同步 schema 到数据库（不需要 migration 时用这个）

# 开发模式
pnpm dev                # nest start --watch，监听 :3001

# 生产模式
pnpm build              # nest build → dist/main.js
pnpm start:prod         # NODE_ENV=production node dist/main.js

# Prisma 工具
pnpm prisma:migrate     # 创建 migration（正式项目用）
pnpm prisma:studio      # 打开 Prisma Studio 可视化看表
```

启动成功标志：
```
[server] listening on http://localhost:3001
[server] WebSocket path: ws://localhost:3001/yjs/:docId
```

> **协同核心在 `src/yjs/`**：房间/同步/持久化逻辑都在 NestJS 应用内，随 `nest build` 一起编译，
> 不需要单独 build。各文件的职责见上方目录结构注释。

### apps/web — Next.js 前端

```bash
cd apps/web
pnpm dev                # next dev --turbopack -p 3000
pnpm build              # next build
pnpm start              # next start -p 3000（生产）
```

启动成功后访问 http://localhost:3000。

> **注意**：协同编辑页用 `dynamic(() => import(...), { ssr: false })` 包装，因为 y-websocket Provider 依赖浏览器 API，不能 SSR。
> 编辑器封装在 `components/editor/`，样式统一写在 `apps/web/app/globals.css`（Tailwind v4 + Next.js 下跨包 CSS @import 解析失败，故不再拆 style 文件）。

## 测试流程

项目目前没有正式的单元测试框架，测试通过以下三种方式验证：

### 1. REST API 测试（验证后端 CRUD + Prisma）

启动 server 后，用 curl 验证文档接口：

```bash
# 创建文档
curl -s -X POST http://localhost:3001/api/documents \
  -H "Content-Type: application/json" \
  -d '{"name":"测试文档"}'
# 期望返回：{"id":"doc-xxx","name":"测试文档","owner":"unknown",...}

# 列出所有文档
curl -s http://localhost:3001/api/documents
# 期望返回：[{"id":"doc-xxx","name":"测试文档",...}]
```

### 2. 协同 Demo 测试（验证 Yjs CRDT 双向同步）

这是核心测试，用真实 yjs + y-websocket 客户端模拟两个用户同编辑一份文档：

```bash
# 前提：server 已启动（pnpm --filter @yjs-demo/server dev）

# 从根目录跑
pnpm test:collab

# 或从 apps/server 目录跑
cd apps/server
node test-collab.mjs
```

测试脚本 `apps/server/test-collab.mjs` 做的事：
1. 客户端 A、B 同时连接 `ws://localhost:3001/yjs/doc-collab-test-<timestamp>`（用时间戳后缀避免命中旧房间的残留状态）
2. A 写入 `"Hello from A"`，等待 1s 同步
3. 验证 B 是否收到（断言 B 的内容 === `"Hello from A"`）
4. B 追加 `" and B too"`，等待 1s 同步
5. 验证 A、B 内容一致（断言双方都 === `"Hello from A and B too"`）

期望输出：
```
[test] ✓ 协同同步成功！B 收到了 A 的修改
[test] ✓ 双向协同成功！A 和 B 内容一致
```

> **注意**：测试脚本用 `Date.now()` 后缀生成 docId，保证每次跑都是全新房间。如果手动用固定 docId 重复测试，需确保 server 重启过（或等 30 秒让旧房间空闲销毁），否则可能命中残留 awareness 状态。

### 3. 浏览器协同体验（端到端可视化验证）

```bash
# 启动 server + web
pnpm --filter @yjs-demo/server dev
pnpm --filter @yjs-demo/web dev
```

然后：
1. 浏览器开 http://localhost:3000/editor/test-doc
2. **再开一个窗口**（无痕模式或不同浏览器）访问同一 URL
3. 两个窗口同时编辑，应看到：
   - 实时内容同步（打字即时出现在另一窗口）
   - 协同光标（另一用户的彩色光标位置）
   - 顶部在线用户头像列表

## 环境变量

复制 `.env.example` 为 `.env`，放在仓库根目录：

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `postgresql://yjs:yjs@localhost:5432/yjs_demo?schema=public` | Prisma 连接串 |
| `REDIS_URL` | `redis://localhost:6379` | Redis 连接串 |
| `SERVER_PORT` | `3001` | NestJS 监听端口 |
| `SERVER_CORS_ORIGIN` | `http://localhost:3000` | 允许的前端源（逗号分隔多个） |
| `NEXT_PUBLIC_WS_URL` | `ws://localhost:3001` | 前端 WebSocket 地址 |
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | 前端 REST API 地址 |
| `MOCK_USER_ID` | `user-demo-001` | 暂未接 Auth，写死的测试用户 ID |
| `MOCK_USER_NAME` | `Demo User` | 测试用户名 |
| `MOCK_USER_COLOR` | `#7c3aed` | 测试用户光标颜色 |

> server 的 `.env` 加载通过 `dotenv` 显式 `config({ path: "../../.env" })`（见 `apps/server/src/main.ts`），所以 `.env` 必须在仓库根目录。

## 脚本速查表

```bash
# ===== 日常开发 =====
pnpm install                              # 装依赖
pnpm db:up                                # 起 PG + Redis
pnpm --filter @yjs-demo/server dev        # 起后端 :3001
pnpm --filter @yjs-demo/web dev           # 起前端 :3000

# ===== 构建 =====
pnpm --filter @yjs-demo/shared build      # 单独 build shared（唯一需要单独构建的 package）
pnpm build                                # build 全部（turbo 编排）

# ===== 测试 =====
pnpm test:collab                          # 协同 demo 测试（需 server 在线）
curl http://localhost:3001/api/documents  # REST 冒烟测试

# ===== Prisma =====
cd apps/server
pnpm prisma:generate                      # 生成 client
pnpm prisma:push                          # 同步 schema
pnpm prisma:studio                        # 可视化看表

# ===== Docker =====
pnpm db:up                                # 启动
pnpm db:down                              # 停止
pnpm db:logs                              # 看日志
pnpm db:reset                             # 清空重建

# ===== 清理 =====
pnpm clean                                # 删所有 dist + node_modules
```

## 关键设计决策与注意事项

### 1. pnpm catalog 集中管理依赖版本

所有公共依赖版本集中在 `pnpm-workspace.yaml` 的 `catalog:` 段，各 package 用 `"yjs": "catalog:"` 引用。升级只需改一处，全 workspace 生效。

### 2. nodeLinker: hoisted（Prisma 5 兼容性）

`pnpm-workspace.yaml` 里设了 `nodeLinker: hoisted`。原因：Prisma 5 在 pnpm 默认隔离模式下，`@prisma/client` 找不到生成的 `.prisma/client`。hoisted 模式让依赖提升到根 `node_modules`，Prisma 才能正常工作。

代价：失去 pnpm 严格的依赖隔离，但 monorepo 内可接受。

### 3. 协同代码直接内嵌在 apps 里（不再拆 package）

服务端协同核心在 `apps/server/src/yjs/`，前端编辑器封装在 `apps/web/components/editor/`，由 NestJS / Next.js 各自的构建管线编译，不需要单独的 tsup 构建步骤。共享契约（DTO、协议常量、房间 ID 约定）仍放在 `@yjs-demo/shared`，这是唯一需要单独构建的 package。

`src/yjs/` 按关注点分为 5 个文件，自下而上依赖（避免单文件过大，也避免文件过多）：

```
types.ts（契约） → sync-handler.ts（协议） → room.ts（房间） → room-manager.ts（房间池） → yjs.service.ts（NestJS 接入）
```

- `types.ts`：`YjsPersistence` / `YjsConnection` / `RoomInfo` 接口，被各层共用。
- `sync-handler.ts`：y-protocols 消息编解码与分发（`handleYjsMessage` / `sendInitialSync` / 消息类型常量），只依赖契约层，可独立测试。
- `room.ts`：一个房间的运行机制——`createWsConnection`（ws.WebSocket → YjsConnection）+ `YjsRoom`（Y.Doc + awareness + 广播 + 持久化调度）。
- `room-manager.ts`：房间池（惰性创建、空闲销毁、监控查询）。
- `yjs.service.ts`：NestJS 接入层（WebSocket 连接入口 + Prisma 持久化），`YjsModule` 声明同文件，避免单独 8 行的模块文件。

### 4. shared 用 dual format 输出（ESM + CJS）

`shared` 用 tsup 输出 ESM + CJS 双格式 + 独立 tsc 生成 `.d.ts`。因为：
- NestJS 走 CommonJS，需要 `.cjs` 产物
- Next.js 走 ESM，需要 `.js` 产物
- tsup 的 `dts` 插件在 monorepo paths 下 file list 不全，改用独立 `tsc -p tsconfig.dts.json` 出类型声明

### 5. 源码相对 import 后缀的约定

- `packages/shared` 源码内部相对 import **不加 `.js` 后缀**（tsup bundle 时 `.js` 后缀会导致 CJS 产物里 export 变 `void 0`）。
- `apps/server` 内部相对 import **统一加 `.js` 后缀**（NestJS + CommonJS 的约定，`moduleResolution: Node` 下两种写法都能解析，统一后缀避免混用）。

### 6. NestJS 手动绑 WebSocket（不用 WsAdapter）

NestJS 的 `@nestjs/platform-ws` WsAdapter 用 `pathname === wsServer.path` 精确匹配，无法处理 `/yjs/:docId` 动态路径。所以 `main.ts` 手动创建 `ws.WebSocketServer({ noServer: true })`，绑定到 `httpServer.on("upgrade")`，自己解析 URL 取 docId。

### 7. Auth 暂缓

先用 mock 用户（写死的 ID + name + color）打通协同闭环。后续接 JWT 时只需改 `apps/server` 的 guard 和 `apps/web` 的 client header，不影响 shared 层。

### 8. 编辑器样式合并到 web

跨包 CSS `@import "@yjs-demo/editor/src/styles.css"` 在 Tailwind v4 + Next.js 下解析失败。编辑器样式直接写在 `apps/web/app/globals.css`。改编辑器样式改这个文件。

### 9. 房间空闲自动销毁（避免 awareness 脏状态残留）

`YjsRoom` 在最后一个连接断开时，通过 `onEmpty` 回调通知 `YjsRoomManager.notifyConnectionClosed`，后者延迟 30 秒（`idleTtlMs`）后销毁房间（`dispose` 释放 `Y.Doc` + 清空 awareness）。

不销毁的后果：awareness 里残留已断开 client 的 state，新连接收到 `sendInitialSync` 发的脏 awareness 数据，客户端 `applyAwarenessUpdate` 解析时 `JSON.parse` 崩溃（`Unexpected end of JSON input`）。

## 常见问题

**Q: `pnpm dev` 启动后 NestJS 报找不到 `@yjs-demo/shared` 的类型？**
A: shared 没先 build 出 `dist/*.d.ts`。先跑 `pnpm --filter @yjs-demo/shared build`，再启动 server。

**Q: Prisma 报 `Cannot find module '.prisma/client'`？**
A: 确认 `pnpm-workspace.yaml` 里有 `nodeLinker: hoisted`，然后 `rm -rf node_modules pnpm-lock.yaml && pnpm install`，再 `cd apps/server && pnpm prisma:generate`。

**Q: WebSocket 连接被拒（404 或 socket hang up）？**
A: 确认 server 日志里有 `WebSocket path: ws://localhost:3001/yjs/:docId`。连接 URL 必须是 `ws://localhost:3001/yjs/<docId>`，不是 `ws://localhost:3001/yjs/`。

**Q: macOS 跑 `docker compose` 报 command not found？**
A: colima 没启动。先 `colima start`，并 `export PATH="/opt/homebrew/bin:$PATH"`。

**Q: 前端打开编辑器页白屏？**
A: 确认 shared 已 build（`packages/shared/dist/` 存在）。CollabEditor 用 dynamic import + ssr:false，编辑器组件依赖浏览器 API。
