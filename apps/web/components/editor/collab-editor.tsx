"use client";

import { EditorContent } from "@tiptap/react";
import { useEffect } from "react";
import type { JSX } from "react";
import { useCollaboration, type CollaborationUser } from "./use-collaboration";
import { EditorToolbar } from "./editor-toolbar";
import type { User } from "@yjs-demo/shared";

export interface CollabEditorProps {
  docId: string;
  user: User;
  wsUrl: string;
  placeholder?: string;
  initialContent?: string;
  /** 在线用户头像/状态条回调（可选） */
  onUsersChange?: (users: CollaborationUser[]) => void;
  /** 连接状态变化回调（可选） */
  onConnectedChange?: (connected: boolean) => void;
}

/**
 * 协同编辑器组件
 *
 * 用法：
 *   <CollabEditor docId="doc-001" user={user} wsUrl={wsUrl} />
 *
 * 在 Next.js App Router 中建议用 dynamic import 包装以避免 SSR 报错：
 *   const CollabEditor = dynamic(() => import("../../../components/editor").then(m => m.CollabEditor), { ssr: false });
 */
export function CollabEditor(props: CollabEditorProps): JSX.Element {
  const { docId, user, wsUrl, placeholder, initialContent, onUsersChange, onConnectedChange } = props;
  const { editor, connected, users } = useCollaboration({
    docId,
    user,
    wsUrl,
    placeholder,
    initialContent,
  });

  // 通知父组件
  useEffect(() => {
    onUsersChange?.(users);
  }, [users, onUsersChange]);

  useEffect(() => {
    onConnectedChange?.(connected);
  }, [connected, onConnectedChange]);

  return (
    <div className="collab-editor">
      <div className="collab-editor-statusbar">
        <ConnectionBadge connected={connected} />
        <UserAvatars users={users} />
      </div>
      <EditorToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}

function ConnectionBadge({ connected }: { connected: boolean }): JSX.Element {
  return (
    <span className={`collab-conn-badge collab-conn-badge--${connected ? "on" : "off"}`}>
      <span className="collab-conn-dot" />
      {connected ? "已连接" : "连接中..."}
    </span>
  );
}

function UserAvatars({ users }: { users: CollaborationUser[] }): JSX.Element {
  if (users.length === 0) return <span className="collab-users-empty">无在线用户</span>;
  return (
    <div className="collab-users">
      {users.map((u, idx) => (
        <span
          key={`${u.name}-${idx}`}
          className="collab-user-avatar"
          title={u.name}
          style={{ backgroundColor: u.color }}
        >
          {u.name.slice(0, 1).toUpperCase()}
        </span>
      ))}
    </div>
  );
}
