"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createWsConnection = createWsConnection;
/**
 * 把 ws.WebSocket 适配成 YjsConnection
 *
 * ws 库的 'message' 事件回传 Buffer，
 * 这里转成 Uint8Array 以匹配 y-protocols 的二进制处理约定。
 *
 * 同时负责承载 Yjs clientId（由调用方从 Y.Doc.awareness.clientID 分配）
 */
function createWsConnection(ws, clientId) {
    let messageHandler = null;
    let closeHandler = null;
    ws.on("message", (raw) => {
        if (messageHandler) {
            // Buffer → Uint8Array 直接共享内存，零拷贝
            const u8 = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
            messageHandler(u8);
        }
    });
    ws.on("close", () => {
        if (closeHandler)
            closeHandler();
    });
    return {
        clientId,
        send(data) {
            if (ws.readyState === ws.OPEN) {
                ws.send(data, { binary: true });
            }
        },
        close(code, reason) {
            ws.close(code, reason);
        },
        onMessage(handler) {
            messageHandler = handler;
        },
        onClose(handler) {
            closeHandler = handler;
        },
    };
}
//# sourceMappingURL=ws-adapter.js.map