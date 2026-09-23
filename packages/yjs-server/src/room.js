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
exports.YjsRoom = void 0;
const Y = __importStar(require("yjs"));
const syncProtocol = __importStar(require("y-protocols/sync"));
const awarenessProtocol = __importStar(require("y-protocols/awareness"));
const encoding = __importStar(require("lib0/encoding"));
const sync_handler_1 = require("./sync-handler");
/**
 * 单个 Yjs 协同房间
 *
 * 一个房间对应一个 Y.Doc，承载：
 * - 文档的 CRDT 状态
 * - 在线客户端的 Awareness（光标、用户信息）
 * - update 广播与持久化
 *
 * 生命周期：
 *   YjsRoomManager.getOrCreateRoom(docId) → load() → addConnection(conn) → ...
 *   → 最后一个 conn 断开 → flushSave() → 释放 Y.Doc
 */
class YjsRoom {
    constructor(docId, persistence, saveDebounceMs = 2000) {
        this.docId = docId;
        this.persistence = persistence;
        this.saveDebounceMs = saveDebounceMs;
        this.connections = new Set();
        this.saveTimer = null;
        /** awareness 变化时广播 */
        this.handleAwarenessUpdate = ({ added, updated, removed }, origin) => {
            const changedClients = [...added, ...updated, ...removed];
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, 1); // MESSAGE_AWARENESS
            const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients);
            encoding.writeVarUint8Array(encoder, awarenessUpdate);
            const message = encoding.toUint8Array(encoder);
            for (const conn of this.connections) {
                if (conn !== origin) {
                    conn.send(message);
                }
            }
        };
        this.ydoc = new Y.Doc();
        this.awareness = new awarenessProtocol.Awareness(this.ydoc);
        // 绑定 update handler（用箭头函数避免 this 丢失）
        this.handleDocUpdate = (update, origin) => {
            this.broadcastUpdate(update, origin);
            this.scheduleSave();
        };
        this.ydoc.on("update", this.handleDocUpdate);
        // awareness 变化时广播
        this.awareness.on("update", this.handleAwarenessUpdate);
    }
    /** 从持久化层加载已有 state */
    async load() {
        const state = await this.persistence.loadState(this.docId);
        if (state && state.byteLength > 0) {
            Y.applyUpdate(this.ydoc, state);
        }
    }
    /** 客户端连接加入房间 */
    addConnection(conn) {
        this.connections.add(conn);
        conn.onMessage((data) => {
            (0, sync_handler_1.handleYjsMessage)(this.ydoc, this.awareness, conn, data);
        });
        conn.onClose(() => {
            this.removeConnection(conn);
            // 客户端断开后从 awareness 中清除其状态
            awarenessProtocol.removeAwarenessStates(this.awareness, [conn.clientId], null);
        });
        // 发送初始同步消息
        (0, sync_handler_1.sendInitialSync)(this.ydoc, this.awareness, conn);
    }
    /** 客户端断开 */
    removeConnection(conn) {
        this.connections.delete(conn);
        if (this.connections.size === 0) {
            void this.flushSave();
        }
    }
    /** 当前连接数 */
    get connectionCount() {
        return this.connections.size;
    }
    /** 立即销毁房间（释放 Y.Doc 资源，先 flush 再 destroy） */
    async dispose() {
        if (this.saveTimer) {
            clearTimeout(this.saveTimer);
            this.saveTimer = null;
        }
        await this.flushSave();
        this.ydoc.off("update", this.handleDocUpdate);
        this.awareness.off("update", this.handleAwarenessUpdate);
        this.ydoc.destroy();
    }
    /** 广播 update 给房间内除 origin 外的所有客户端 */
    broadcastUpdate(update, origin) {
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, 0); // MESSAGE_SYNC
        syncProtocol.writeUpdate(encoder, update);
        const message = encoding.toUint8Array(encoder);
        for (const conn of this.connections) {
            if (conn !== origin) {
                conn.send(message);
            }
        }
    }
    /** 调度 debounce 持久化（避免每次 update 都写库） */
    scheduleSave() {
        if (this.saveTimer)
            return;
        this.saveTimer = setTimeout(() => {
            this.saveTimer = null;
            void this.flushSave();
        }, this.saveDebounceMs);
    }
    /** 把当前 Y.Doc 状态序列化后写入持久化层 */
    async flushSave() {
        const state = Y.encodeStateAsUpdate(this.ydoc);
        await this.persistence.saveState(this.docId, state);
    }
}
exports.YjsRoom = YjsRoom;
//# sourceMappingURL=room.js.map