"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.MESSAGE_AWARENESS = exports.MESSAGE_SYNC = void 0;
exports.handleYjsMessage = handleYjsMessage;
exports.sendInitialSync = sendInitialSync;
const syncProtocol = __importStar(require("y-protocols/sync"));
const awarenessProtocol = __importStar(require("y-protocols/awareness"));
const encoding = __importStar(require("lib0/encoding"));
const decoding = __importStar(require("lib0/decoding"));
/**
 * Yjs 二进制消息分发器
 *
 * 负责处理客户端发来的二进制 frame，按 y-protocols 的 message type 分发：
 * - 0 (sync): syncStep1 / syncStep2 / update
 * - 1 (awareness): awareness update / query
 *
 * 这是 y-websocket server 端的核心逻辑，剥离自 y-websocket 以便自定义传输层。
 */
exports.MESSAGE_SYNC = 0;
exports.MESSAGE_AWARENESS = 1;
/**
 * 处理一个客户端发来的二进制消息
 *
 * @param ydoc 当前房间对应的 Y.Doc
 * @param awareness 当前房间的 awareness 实例
 * @param conn 发送消息的客户端连接
 * @param data 二进制消息体
 */
function handleYjsMessage(ydoc, awareness, conn, data) {
    try {
        const decoder = decoding.createDecoder(data);
        const messageType = decoding.readVarUint(decoder);
        switch (messageType) {
            case exports.MESSAGE_SYNC:
                handleSyncMessage(ydoc, conn, decoder);
                break;
            case exports.MESSAGE_AWARENESS:
                handleAwarenessMessage(ydoc, awareness, decoder);
                break;
            default:
                // 未知消息类型，忽略（兼容未来协议扩展）
                break;
        }
    }
    catch (err) {
        // 解码失败时不要让单个客户端拖垮房间
        console.error("[yjs-server] handleYjsMessage error:", err);
    }
}
/** 处理 sync 消息（step1/step2/update） */
function handleSyncMessage(ydoc, conn, decoder) {
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
function handleAwarenessMessage(_ydoc, awareness, decoder) {
    awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), null);
}
/**
 * 给新连接的客户端发送初始同步消息
 *
 * 1. sync-step1：服务端告诉客户端自己的 state vector，客户端回缺失的 update
 * 2. sync-step2：服务端把当前完整 state 推给客户端
 * 3. awareness states：把当前在线用户状态推给客户端
 */
function sendInitialSync(ydoc, awareness, conn) {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, exports.MESSAGE_SYNC);
    syncProtocol.writeSyncStep1(encoder, ydoc);
    conn.send(encoding.toUint8Array(encoder));
    const encoder2 = encoding.createEncoder();
    encoding.writeVarUint(encoder2, exports.MESSAGE_SYNC);
    syncProtocol.writeSyncStep2(encoder2, ydoc);
    conn.send(encoding.toUint8Array(encoder2));
    const awarenessStates = awareness.getStates();
    if (awarenessStates.size > 0) {
        const encoder3 = encoding.createEncoder();
        encoding.writeVarUint(encoder3, exports.MESSAGE_AWARENESS);
        const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()));
        encoding.writeVarUint8Array(encoder3, awarenessUpdate);
        conn.send(encoding.toUint8Array(encoder3));
    }
}
//# sourceMappingURL=sync-handler.js.map