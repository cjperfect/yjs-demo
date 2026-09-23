/**
 * @yjs-demo/shared
 *
 * 跨端共享的契约层：
 * - DTO（用户、文档元数据）
 * - WebSocket 业务消息协议
 * - Yjs 文档相关常量
 *
 * 前端 apps/web 和后端 apps/server 都引用这里，避免类型双份定义。
 */

export * from "./user";
export * from "./document";
export * from "./yjs-schema";
export * from "./protocol";
