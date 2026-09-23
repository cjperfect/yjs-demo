"use client";

import { useEffect, useMemo, useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useUser } from "../../../components/user-provider";
import type { Collaborator, User } from "@yjs-demo/shared";

// CollabEditor 是 client-only（依赖 WebSocket），用 dynamic ssr:false 包装
const CollabEditor = dynamic(
  () => import("../../../components/editor").then((m) => m.CollabEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex justify-center py-16 text-sm text-slate-500">
        <svg viewBox="0 0 24 24" className="mr-2 h-4 w-4 animate-spin" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        加载编辑器...
      </div>
    ),
  },
);

export interface EditorClientProps {
  docId: string;
  docName: string;
  owner: string | null;
  isPublic: boolean;
}

export default function EditorClient({
  docId,
  docName,
  owner,
  isPublic,
}: EditorClientProps): React.ReactElement {
  const router = useRouter();
  // 用户从 UserProvider 拿，登录信息存 localStorage（极简登录）
  // RequireUser 已经在 layout 里拦截未登录访问，这里 user 一定非空
  const { user: loginUser } = useUser();
  const [copied, setCopied] = useState(false);

  // 重命名 + 删除状态
  const [isPending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(docName);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // 邀请协作弹层 + 协作者列表
  const [showInvite, setShowInvite] = useState(false);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [collabLoading, setCollabLoading] = useState(false);
  const [newCollabName, setNewCollabName] = useState("");
  const [collabError, setCollabError] = useState<string | null>(null);

  // y-websocket 会拼成 wsUrl + "/" + docId。
  // 走同源 ws://<当前host>/yjs，由 Next.js rewrites 代理到后端 3001，
  // 避免浏览器系统代理（Clash 等）拦截直连 ws://localhost:3001 的跨端口连接。
  // server 端渲染时 window 不存在，用 fallback（CollabEditor 是 ssr:false，只在 client 用）。
  const wsUrl =
    typeof window !== "undefined"
      ? `ws://${window.location.host}/yjs`
      : "ws://localhost:3000/yjs";
  // client component 走同源相对路径 /api/*，由 Next.js rewrites 转发到后端 3001。
  // 避免浏览器系统代理（Clash 等）拦截直连 localhost:3001 的跨域请求——
  // 浏览器 fetch 直连 3001 会被代理拦截报 ERR_CONNECTION_REFUSED，
  // 但同源 /api/* 只发到 3000（和打开页面一样），由 server 端 Node.js 转发。
  const apiBase = "";

  const handleCopyLink = async () => {
    // 先尝试把 localhost 换成本机局域网 IP，方便发给同局域网的其他设备
    let shareUrl = window.location.href;
    try {
      const res = await fetch(`${apiBase}/api/info/lan-ip`, { cache: "no-store" });
      if (res.ok) {
        const { lanIp } = (await res.json()) as { lanIp: string | null };
        if (lanIp) {
          shareUrl = shareUrl.replace("localhost", lanIp);
        }
      }
    } catch {
      // 获取 IP 失败，用原 URL（localhost 也能本机自测）
    }
    // 优先用现代 Clipboard API（要求 secure context，localhost 算）
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
        return;
      } catch {
        // 权限被拒或 API 不可用，走 fallback
      }
    }
    // Fallback：临时 textarea + execCommand（兼容非 secure context / 旧浏览器）
    try {
      const ta = document.createElement("textarea");
      ta.value = shareUrl;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.top = "0";
      ta.style.left = "0";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }
    } catch {
      // 真的没法复制了，静默；用户可手动选中地址栏复制
    }
  };

  // ─── 协作者管理 ────────────────────────────────────────────
  // 当前用户是否为文档所有者：仅 owner 可加/删协作者、可改/删文档
  // owner 是 prop 传来的文档 owner；collabUser.name 是当前登录用户名
  const isOwner = useMemo(
    () => (owner !== null && loginUser?.name === owner) || false,
    [owner, loginUser?.name],
  );

  const loadCollaborators = async () => {
    if (!loginUser) return;
    setCollabLoading(true);
    setCollabError(null);
    try {
      const res = await fetch(`${apiBase}/api/documents/${docId}/collaborators`, {
        cache: "no-store",
        // HTTP header 值必须 ASCII，中文用户名要 URL-encode（后端 controller decode）
        headers: { "x-owner": encodeURIComponent(loginUser.name) },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as Collaborator[] | { error: string };
      if (Array.isArray(json)) {
        setCollaborators(json);
      } else {
        setCollabError(json.error === "not_found" ? "文档不存在或无访问权限" : json.error);
      }
    } catch (e) {
      setCollabError(e instanceof Error ? e.message : String(e));
    } finally {
      setCollabLoading(false);
    }
  };

  const addCollaborator = () => {
    const username = newCollabName.trim();
    if (!username || !loginUser) return;
    setCollabError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`${apiBase}/api/documents/${docId}/collaborators`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-owner": encodeURIComponent(loginUser.name),
          },
          body: JSON.stringify({ username }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as Collaborator | { error: string };
        if ("error" in json) {
          const msg =
            json.error === "forbidden"
              ? "仅文档所有者可邀请"
              : json.error === "is_owner"
                ? "不能把自己加为协作者"
                : json.error;
          setCollabError(msg);
        } else {
          setNewCollabName("");
          await loadCollaborators();
        }
      } catch (e) {
        setCollabError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  const removeCollaborator = (username: string) => {
    if (!loginUser) return;
    setCollabError(null);
    startTransition(async () => {
      try {
        const res = await fetch(
          `${apiBase}/api/documents/${docId}/collaborators/${encodeURIComponent(username)}`,
          {
            method: "DELETE",
            headers: { "x-owner": encodeURIComponent(loginUser.name) },
            cache: "no-store",
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        await loadCollaborators();
      } catch (e) {
        setCollabError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  // 打开邀请弹层时拉协作者列表
  useEffect(() => {
    if (showInvite && loginUser) {
      void loadCollaborators();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadCollaborators 依赖 apiBase/docId/loginUser，每次 show 都要重新拉
  }, [showInvite]);

  // 所有 hooks 已调用完毕，从这里开始可以提前 return
  if (!loginUser) {
    // 正常情况下 RequireUser 已经在 layout 拦截未登录访问，这里是防御性 fallback
    return <div className="py-16 text-center text-sm text-slate-500">初始化用户...</div>;
  }

  // 取 const 别名：闭包里 TypeScript 不会保留 useUser 返回值（state）的 narrowing，
  // 但 const 后就稳定了，submitRename 等闭包可以安全引用 currentUser.name
  const currentUser = loginUser;

  const submitRename = () => {
    const name = draftName.trim();
    if (!name || name === docName) {
      setRenaming(false);
      setDraftName(docName);
      return;
    }
    startTransition(async () => {
      try {
        const res = await fetch(`${apiBase}/api/documents/${docId}`, {
          method: "PATCH",
          // x-owner 让后端按 owner 校验所有权（防止越权改他人文档）；
          // 中文用户名 URL-encode 后才能进 HTTP header（ASCII 限制）
          headers: {
            "Content-Type": "application/json",
            "x-owner": encodeURIComponent(currentUser.name),
          },
          body: JSON.stringify({ name }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // 当前页面 docName 是 server component 传来的 prop；refresh 让 server 重新拉
        router.refresh();
      } catch (e) {
        console.error("[rename] failed:", e);
        setDraftName(docName);
      } finally {
        setRenaming(false);
      }
    });
  };

  const submitDelete = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`${apiBase}/api/documents/${docId}`, {
          method: "DELETE",
          headers: { "x-owner": encodeURIComponent(currentUser.name) },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // 删除后回首页
        router.push("/");
        router.refresh();
      } catch (e) {
        console.error("[delete] failed:", e);
        setConfirmingDelete(false);
      }
    });
  };

  // 切换公开/私有（仅 owner 可操作）
  const togglePublic = () => {
    startTransition(async () => {
      try {
        const res = await fetch(`${apiBase}/api/documents/${docId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "x-owner": encodeURIComponent(currentUser.name),
          },
          body: JSON.stringify({ isPublic: !isPublic }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // server component 重新拉文档元数据
        router.refresh();
      } catch (e) {
        console.error("[togglePublic] failed:", e);
      }
    });
  };

  const onTitleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      submitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraftName(docName);
      setRenaming(false);
    }
  };

  // AppUser 是 web 内部形状，CollabEditor 期待 shared 包的 User；
  // 字段一致，用 useMemo 稳定引用，避免每次 re-render 构造新对象触发
  // useCollaboration 内部 useMemo 重算 extensions → useEditor 销毁重建（协同断连）
  const collabUser = useMemo<User>(
    () => ({ id: currentUser.id, name: currentUser.name, color: currentUser.color }),
    [currentUser.id, currentUser.name, currentUser.color],
  );

  return (
    <div className="mx-auto max-w-5xl px-8 py-6">
      {/* 顶部工具栏：返回 + 标题（可改）+ 复制链接 + 删除，严格对齐 */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-6">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="inline-flex items-center gap-1 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          返回
        </button>

        {/* 标题：默认显示文本 + ✎ 图标；点击 ✎ 切到 input */}
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 px-4">
          {renaming ? (
            <input
              // eslint-disable-next-line jsx-a11y/no-autofocus -- 重命名由用户主动触发，需要立即聚焦
              autoFocus
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onBlur={submitRename}
              onKeyDown={onTitleKeyDown}
              className="min-w-0 flex-1 rounded border border-indigo-300 bg-white px-2 py-1 text-center text-sm font-semibold text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
              maxLength={200}
            />
          ) : (
            <>
              <h1 className="min-w-0 truncate text-sm font-semibold text-slate-900">
                {docName}
              </h1>
              {isOwner && (
                <button
                  type="button"
                  onClick={() => {
                    setRenaming(true);
                    setDraftName(docName);
                  }}
                  disabled={isPending}
                  title="重命名"
                  className="inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
                  </svg>
                </button>
              )}
            </>
          )}
        </div>

        {/* 右侧动作：公开切换 + 邀请协作（弹层）+ 删除（仅 owner 可见，删除带二次确认） */}
        <div className="relative flex flex-shrink-0 items-center gap-2">
          {/* 公开/私有切换（仅 owner 可见） */}
          {isOwner && (
            <button
              type="button"
              onClick={togglePublic}
              disabled={isPending}
              title={
                isPublic
                  ? "当前为公开文档，任何人通过链接可编辑。点击设为私有"
                  : "当前为私有文档，仅协作者可访问。点击设为公开"
              }
              className={
                isPublic
                  ? "inline-flex items-center gap-1.5 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
                  : "inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-40"
              }
            >
              {isPublic ? (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <circle cx="8" cy="8" r="6.5" />
                  <path d="M1.5 8h13" strokeLinecap="round" />
                  <path d="M8 1.5c2 2 2 9 0 13M8 1.5c-2 2-2 9 0 13" strokeLinecap="round" />
                </svg>
              ) : (
                <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                  <rect x="3" y="7" width="10" height="7" rx="1.5" />
                  <path d="M5 7V5a3 3 0 0 1 6 0v2" strokeLinecap="round" />
                </svg>
              )}
              {isPublic ? "公开" : "私有"}
            </button>
          )}

          {/* 邀请协作（弹层）：仅 owner 可见——访客/协作者不能邀请 */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setShowInvite((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              title="邀请协作"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M6.5 6.5h-2A2.5 2.5 0 0 0 2 9v2.5A2.5 2.5 0 0 0 4.5 14h2A2.5 2.5 0 0 0 9 11.5V9a2.5 2.5 0 0 0-2.5-2.5Z M9.5 2.5h2A2.5 2.5 0 0 1 14 5v2.5" strokeLinecap="round" />
              </svg>
              邀请协作
            </button>
          )}

          {/* 仅 owner 可见删除按钮 */}
          {isOwner && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              disabled={isPending}
              title="删除文档"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
            >
              <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1m1 0v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M7 7v5M9 7v5" strokeLinecap="round" />
              </svg>
              删除
            </button>
          )}

          {/* 邀请协作弹层 */}
          {showInvite && (
            <div
              className="absolute right-0 top-full z-20 mt-1 w-80 rounded-md border border-slate-200 bg-white p-3 shadow-lg"
              // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 浮层，点击外层时由父级 onClick 处理；这里阻止冒泡避免触发跳转
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-900">协作成员</p>
                <button
                  type="button"
                  onClick={() => setShowInvite(false)}
                  className="text-slate-400 hover:text-slate-700"
                  aria-label="关闭"
                >
                  <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                    <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>

              {/* 添加协作者输入框（仅 owner 可见） */}
              {isOwner ? (
                <div className="mt-2 flex gap-1.5">
                  <input
                    value={newCollabName}
                    onChange={(e) => setNewCollabName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCollaborator();
                      }
                    }}
                    placeholder="输入用户名"
                    className="min-w-0 flex-1 rounded border border-slate-200 bg-white px-2 py-1 text-xs outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-100"
                    maxLength={100}
                  />
                  <button
                    type="button"
                    onClick={addCollaborator}
                    disabled={isPending || newCollabName.trim().length === 0}
                    className="rounded bg-indigo-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                  >
                    添加
                  </button>
                </div>
              ) : (
                <p className="mt-2 text-[10px] text-slate-400">
                  {isPublic
                    ? "这是公开文档，任何人通过链接可编辑"
                    : "仅文档所有者可邀请，你以协作成员身份访问"}
                </p>
              )}

              {/* 协作者列表 */}
              <div className="mt-2 max-h-48 overflow-auto">
                {collabLoading ? (
                  <p className="py-3 text-center text-xs text-slate-400">加载中...</p>
                ) : collaborators.length === 0 ? (
                  <p className="py-3 text-center text-xs text-slate-400">
                    {isOwner ? "还没有协作者，添加一个开始协作" : "暂无其他协作者"}
                  </p>
                ) : (
                  <ul className="space-y-1">
                    {collaborators.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between rounded px-1.5 py-1 hover:bg-slate-50"
                      >
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
                          <span
                            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-violet-50 text-[10px] font-semibold text-violet-700"
                            aria-hidden="true"
                          >
                            {c.userId.slice(0, 1).toUpperCase()}
                          </span>
                          {c.userId}
                        </span>
                        {isOwner && (
                          <button
                            type="button"
                            onClick={() => removeCollaborator(c.userId)}
                            disabled={isPending}
                            title={`移除 ${c.userId}`}
                            className="text-slate-300 hover:text-red-600 disabled:opacity-40"
                          >
                            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                              <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
                            </svg>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 错误提示 */}
              {collabError && (
                <p className="mt-2 text-[10px] text-red-600">{collabError}</p>
              )}

              {/* 分隔线 + 复制链接按钮 */}
              <div className="mt-3 border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="flex w-full items-center justify-center gap-1.5 rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {copied ? (
                    <>
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5 text-emerald-500" fill="currentColor" aria-hidden="true">
                        <path d="M13.5 4.5L6 12l-3-3 1-1 2 2 6.5-6.5 1 1Z" />
                      </svg>
                      链接已复制
                    </>
                  ) : (
                    <>
                      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                        <path d="M3 8h10M8 3v10M3 8l3-3M3 8l3 3M13 8l-3-3M13 8l-3 3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      复制链接
                    </>
                  )}
                </button>
                <p className="mt-1.5 text-[10px] text-slate-400">
                  {isPublic
                    ? "文档已公开，任何人打开链接即可编辑"
                    : "对方需先被加为协作者才能打开此链接"}
                </p>
              </div>
            </div>
          )}

          {/* 删除二次确认浮层 */}
          {confirmingDelete && (
            <div className="absolute right-0 top-full z-20 mt-1 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg">
              <p className="text-xs font-medium text-slate-900">删除该文档？</p>
              <p className="mt-1 text-xs text-slate-500">
                删除后不可恢复，文档内容（含协同历史）将一并清空。
              </p>
              <div className="mt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={isPending}
                  className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={submitDelete}
                  disabled={isPending}
                  className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {isPending ? "删除中..." : "删除"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 编辑器区 */}
      <CollabEditor
        docId={docId}
        user={collabUser}
        wsUrl={wsUrl}
        placeholder="开始你的协同编辑..."
      />

      {/* 底部小贴士 */}
      <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M8 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13Zm0 3a.75.75 0 0 1 .75.75v3a.75.75 0 0 1-1.5 0v-3A.75.75 0 0 1 8 4.5Zm0 6.5a1 1 0 1 1 0 2 1 1 0 0 1 0-2Z" />
        </svg>
        <span>开一个无痕窗口访问同一链接，即可体验多人实时协同</span>
      </p>
    </div>
  );
}
