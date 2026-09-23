"use client";

import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import { useEditor, type Editor } from "@tiptap/react";
import { StarterKit } from "@tiptap/starter-kit";
import { Collaboration } from "@tiptap/extension-collaboration";
import { CollaborationCursor } from "@tiptap/extension-collaboration-cursor";
import { useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@yjs-demo/shared";

export interface UseCollaborationOptions {
  docId: string;
  user: User;
  wsUrl: string;
  /** 空文档时的占位提示 */
  placeholder?: string;
  /** 文档初始 HTML（仅首次加载时使用） */
  initialContent?: string;
}

export interface UseCollaborationResult {
  ydoc: Y.Doc;
  provider: WebsocketProvider;
  editor: Editor | null;
  /** 是否已与服务器建立 WebSocket 连接 */
  connected: boolean;
  /** 当前房间在线用户列表 */
  users: CollaborationUser[];
}

/** y-websocket awareness 上报的 user 信息结构 */
export interface CollaborationUser {
  name: string;
  color: string;
}

/**
 * 协同编辑器 React hook
 *
 * 把 Yjs Y.Doc + y-websocket Provider + Tiptap Editor 三者绑在一起，
 * 同时维护 connected 状态和在线用户列表。
 *
 * 必须在 client component 中使用（依赖 WebSocket）。
 * 调用方在 Next.js App Router 里建议用 dynamic(() => ..., { ssr: false }) 包装。
 */
export function useCollaboration(opts: UseCollaborationOptions): UseCollaborationResult {
  const { docId, user, wsUrl, placeholder = "Start writing...", initialContent } = opts;

  // 用 useRef 持有 ydoc + provider，避免每次渲染重建
  // 因为本文件已标记 'use client'，可安全访问 window
  const refs = useRef<{ ydoc: Y.Doc; provider: WebsocketProvider } | null>(null);
  if (refs.current === null) {
    const ydoc = new Y.Doc();
    const provider = new WebsocketProvider(wsUrl, docId, ydoc, {
      connect: true,
      // 离线重连退避
      maxBackoffTime: 2500,
    });
    refs.current = { ydoc, provider };
  }

  const { ydoc, provider } = refs.current;

  // connected 状态
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const onStatus = (event: { status: "connected" | "disconnected" | "connecting" }) => {
      setConnected(event.status === "connected");
    };
    provider.on("status", onStatus);
    provider.connect();
    return () => {
      provider.off("status", onStatus);
    };
  }, [provider]);

  // awareness 在线用户列表
  const [users, setUsers] = useState<CollaborationUser[]>([]);
  useEffect(() => {
    const onAwarenessUpdate = () => {
      const states = provider.awareness.getStates();
      const list: CollaborationUser[] = [];
      states.forEach((state) => {
        if (state.user) {
          list.push({
            name: state.user.name,
            color: state.user.color,
          });
        }
      });
      setUsers(list);
    };
    provider.awareness.on("update", onAwarenessUpdate);
    onAwarenessUpdate();
    return () => {
      provider.awareness.off("update", onAwarenessUpdate);
    };
  }, [provider]);

  // 卸载时销毁 ydoc 和 provider
  useEffect(() => {
    return () => {
      const r = refs.current;
      if (r) {
        r.provider.destroy();
        r.ydoc.destroy();
        refs.current = null;
      }
    };
  }, []);

  // user 变化时同步给 awareness
  // 注意 deps 用 user.name/user.color 字段而非 user 引用，避免父组件
  // 每次构造新对象（如 inline {id,name,color}）导致反复 setLocalStateField
  // → awareness.update → setUsers → re-render → 死循环
  useEffect(() => {
    provider.awareness.setLocalStateField("user", {
      name: user.name,
      color: user.color,
    });
  }, [provider, user.name, user.color]);

  // editor 扩展配置（用 useMemo 稳定引用）
  // deps 同样按字段，user 引用变化不会重建 extensions（= 不重建 editor）
  const extensions = useMemo(() => {
    return [
      StarterKit.configure({
        // 协同模式下由 Collaboration 扩展接管 undo/redo
        history: false,
      }),
      Collaboration.configure({
        document: ydoc,
      }),
      CollaborationCursor.configure({
        provider,
        user: {
          name: user.name,
          color: user.color,
        },
      }),
    ];
  }, [ydoc, provider, user.name, user.color]);

  // useEditor 的第二个参数是 deps，docId 变化时重建 editor
  const editor = useEditor(
    {
      extensions,
      editorProps: {
        attributes: {
          class: "collab-editor-content",
          "data-placeholder": placeholder,
        },
      },
      content: initialContent,
      autofocus: "end",
    },
    [docId, extensions],
  );

  return { ydoc, provider, editor, connected, users };
}
