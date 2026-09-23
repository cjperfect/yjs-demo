import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import type { YjsConnection } from "./types.js";

/**
 * Yjs 二进制消息分发器（协议层）
 *
 * 负责处理客户端发来的二进制 frame，按 y-protocols 的 message type 分发：
 * - 0 (sync): syncStep1 / syncStep2 / update
 * - 1 (awareness): awareness update / query
 *
 * 这是 y-websocket server 端的核心逻辑，剥离自 y-websocket 以便自定义传输层。
 * 只依赖契约层（types.ts），不依赖房间实现，可独立测试。
 */

export const MESSAGE_SYNC = 0;
export const MESSAGE_AWARENESS = 1;

/**
 * 处理一个客户端发来的二进制消息
 *
 * @param ydoc 当前房间对应的 Y.Doc
 * @param awareness 当前房间的 awareness 实例
 * @param conn 发送消息的客户端连接
 * @param data 二进制消息体
 */
export function handleYjsMessage(
  ydoc: Y.Doc,
  awareness: awarenessProtocol.Awareness,
  conn: YjsConnection,
  data: Uint8Array,
): void {
  try {
    const decoder = decoding.createDecoder(data);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
      case MESSAGE_SYNC:
        handleSyncMessage(ydoc, conn, decoder);
        break;
      case MESSAGE_AWARENESS:
        handleAwarenessMessage(ydoc, awareness, decoder);
        break;
      default:
        // 未知消息类型，忽略（兼容未来协议扩展）
        break;
    }
  } catch (err) {
    // 解码失败时不要让单个客户端拖垮房间
    console.error("[yjs] handleYjsMessage error:", err);
  }
}

/** 处理 sync 消息（step1/step2/update） */
function handleSyncMessage(
  ydoc: Y.Doc,
  conn: YjsConnection,
  decoder: decoding.Decoder,
): void {
  const encoder = encoding.createEncoder();
  const messageType = syncProtocol.readSyncMessage(decoder, encoder, ydoc, conn);

  if (encoding.length(encoder) > 1) {
    // 有响应数据需要回写给客户端
    const response = encoding.toUint8Array(encoder);
    conn.send(response);
  }

  if (messageType === syncProtocol.messageYjsUpdate) {
    // 收到 update：广播给房间内其他客户端由 Y.Doc 的 update 事件统一处理
    // 这里只需保证 awareness 同步
  }
}

/** 处理 awareness 消息（光标、用户状态） */
function handleAwarenessMessage(
  _ydoc: Y.Doc,
  awareness: awarenessProtocol.Awareness,
  decoder: decoding.Decoder,
): void {
  awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), null);
}

/**
 * 给新连接的客户端发送初始同步消息
 *
 * 1. sync-step1：服务端告诉客户端自己的 state vector，客户端回缺失的 update
 * 2. sync-step2：服务端把当前完整 state 推给客户端
 * 3. awareness states：把当前在线用户状态推给客户端
 */
export function sendInitialSync(
  ydoc: Y.Doc,
  awareness: awarenessProtocol.Awareness,
  conn: YjsConnection,
): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MESSAGE_SYNC);
  syncProtocol.writeSyncStep1(encoder, ydoc);
  conn.send(encoding.toUint8Array(encoder));

  const encoder2 = encoding.createEncoder();
  encoding.writeVarUint(encoder2, MESSAGE_SYNC);
  syncProtocol.writeSyncStep2(encoder2, ydoc);
  conn.send(encoding.toUint8Array(encoder2));

  const awarenessStates = awareness.getStates();
  if (awarenessStates.size > 0) {
    const encoder3 = encoding.createEncoder();
    encoding.writeVarUint(encoder3, MESSAGE_AWARENESS);
    const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(
      awareness,
      Array.from(awarenessStates.keys()),
    );
    encoding.writeVarUint8Array(encoder3, awarenessUpdate);
    conn.send(encoding.toUint8Array(encoder3));
  }
}
