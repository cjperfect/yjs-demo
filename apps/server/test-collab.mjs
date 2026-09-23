import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { setTimeout as delay } from "timers/promises";

const WS_URL = "ws://localhost:3001";
// 用时间戳后缀避免命中旧房间的残留 awareness state
const DOC_ID = "doc-collab-test-" + Date.now();

console.log("[test] 创建两个客户端，连接同一文档", DOC_ID);

// 客户端 A
const ydocA = new Y.Doc();
const providerA = new WebsocketProvider(WS_URL, `yjs/${DOC_ID}`, ydocA, { connect: true });
const ytextA = ydocA.getText("content");

providerA.on("status", (event) => {
  console.log("[A] status:", event.status);
});

// 客户端 B
const ydocB = new Y.Doc();
const providerB = new WebsocketProvider(WS_URL, `yjs/${DOC_ID}`, ydocB, { connect: true });
const ytextB = ydocB.getText("content");

providerB.on("status", (event) => {
  console.log("[B] status:", event.status);
});

// 等连接建立
await delay(1500);
console.log("[test] 当前内容 A:", JSON.stringify(ytextA.toString()));
console.log("[test] 当前内容 B:", JSON.stringify(ytextB.toString()));

// 客户端 A 写入文字
console.log("[test] 客户端 A 写入: Hello from A");
ydocA.transact(() => {
  ytextA.insert(0, "Hello from A");
});

await delay(1000);
console.log("[test] 写入后内容 A:", JSON.stringify(ytextA.toString()));
console.log("[test] 写入后内容 B:", JSON.stringify(ytextB.toString()));

// 验证 B 是否同步收到 A 的修改
if (ytextB.toString() === "Hello from A") {
  console.log("[test] ✓ 协同同步成功！B 收到了 A 的修改");
} else {
  console.log("[test] ✗ 协同同步失败，B 内容:", JSON.stringify(ytextB.toString()));
}

// 客户端 B 也写入
console.log("[test] 客户端 B 追加: and B too");
ydocB.transact(() => {
  ytextB.insert(ytextB.toString().length, " and B too");
});

await delay(1000);
console.log("[test] 最终内容 A:", JSON.stringify(ytextA.toString()));
console.log("[test] 最终内容 B:", JSON.stringify(ytextB.toString()));

if (ytextA.toString() === ytextB.toString() && ytextA.toString() === "Hello from A and B too") {
  console.log("[test] ✓ 双向协同成功！A 和 B 内容一致");
} else {
  console.log("[test] ✗ 双向协同失败");
}

providerA.destroy();
providerB.destroy();
ydocA.destroy();
ydocB.destroy();
process.exit(0);
