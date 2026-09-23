import type { WebSocket } from "ws";
import type { YjsConnection } from "./types";

/**
 * 把 ws.WebSocket 适配成 YjsConnection
 *
 * ws 库的 'message' 事件回传 Buffer，
 * 这里转成 Uint8Array 以匹配 y-protocols 的二进制处理约定。
 *
 * 同时负责承载 Yjs clientId（由调用方从 Y.Doc.awareness.clientID 分配）
 */
export function createWsConnection(ws: WebSocket, clientId: number): YjsConnection {
  let messageHandler: ((data: Uint8Array) => void) | null = null;
  let closeHandler: (() => void) | null = null;

  ws.on("message", (raw: Buffer) => {
    if (messageHandler) {
      // Buffer → Uint8Array 直接共享内存，零拷贝
      const u8 = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      messageHandler(u8);
    }
  });

  ws.on("close", () => {
    if (closeHandler) closeHandler();
  });

  return {
    clientId,
    send(data: Uint8Array): void {
      if (ws.readyState === ws.OPEN) {
        ws.send(data, { binary: true });
      }
    },
    close(code?: number, reason?: string): void {
      ws.close(code, reason);
    },
    onMessage(handler: (data: Uint8Array) => void): void {
      messageHandler = handler;
    },
    onClose(handler: () => void): void {
      closeHandler = handler;
    },
  };
}

