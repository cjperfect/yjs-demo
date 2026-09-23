"use client";

import { useState, useTransition, type KeyboardEvent } from "react";
import { useRouter } from "next/navigation";
import type { DocumentMeta } from "@yjs-demo/shared";
import {
  nameInitial,
  pickColor,
  relativeTime,
  truncateDocId,
} from "../lib/document-utils";
import { useUser } from "./user-provider";

/**
 * 单条文档列表项（client component）
 *
 * 负责把"读 + 改 + 删"暴露到 UI：
 *  - 整行点击 → 跳转编辑器（read）
 *  - hover 出现 ✎ / 🗑 两个 icon 按钮
 *    - ✎ 把标题切到 inline input，Enter 提交 PATCH / Esc 取消（rename）
 *    - 🗑 弹出二次确认小卡片，确认后 DELETE（delete）
 *
 * 协作者模式（doc.role === "collaborator"）：
 *  - 隐藏重命名/删除按钮（仅 owner 可改/删）
 *  - 在标题左侧显示"协作给我"小徽章，让用户知道这是别人分享的
 *
 * create 走首页顶部"新建文档"按钮，不在这里。
 */
export interface DocumentListItemProps {
  doc: DocumentMeta;
}

export function DocumentListItem({
  doc,
}: DocumentListItemProps): React.ReactElement {
  const router = useRouter();
  const { user } = useUser();
  const [isPending, startTransition] = useTransition();

  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(doc.name);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // client component 走同源相对路径 /api/*，由 Next.js rewrites 转发到后端 3001。
  // 避免浏览器系统代理拦截直连 localhost:3001 的跨域请求。
  const apiBase = "";
  const color = pickColor(doc.name);
  const initial = nameInitial(doc.name);
  // 协作者模式：仅 owner 才能改/删
  const isCollaborator = doc.role === "collaborator";

  const openDoc = () => {
    if (renaming || confirmingDelete || isPending) return;
    router.push(`/editor/${doc.id}`);
  };

  // 取 ownerName 局部变量，submit 内部 narrow 后引用稳定（const 在闭包里 TS 会 narrow）
  const ownerName = user?.name;

  const submitRename = () => {
    const name = draftName.trim();
    if (!name || name === doc.name) {
      setRenaming(false);
      setDraftName(doc.name);
      return;
    }
    if (!ownerName) return; // 没登录就不发请求（正常不会到这）
    startTransition(async () => {
      try {
        const res = await fetch(`${apiBase}/api/documents/${doc.id}`, {
          method: "PATCH",
          // HTTP header 值必须 ASCII，中文用户名 URL-encode（后端 decode）
          headers: {
            "Content-Type": "application/json",
            "x-owner": encodeURIComponent(ownerName),
          },
          body: JSON.stringify({ name }),
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        // server component 重新拉列表
        router.refresh();
      } catch (e) {
        console.error("[rename] failed:", e);
        setDraftName(doc.name);
      } finally {
        setRenaming(false);
      }
    });
  };

  const submitDelete = () => {
    if (!ownerName) return;
    startTransition(async () => {
      try {
        const res = await fetch(`${apiBase}/api/documents/${doc.id}`, {
          method: "DELETE",
          headers: { "x-owner": encodeURIComponent(ownerName) },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        router.refresh();
      } catch (e) {
        console.error("[delete] failed:", e);
      } finally {
        setConfirmingDelete(false);
      }
    });
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // 阻止冒泡：避免按 Enter 时触发行级 onClick 跳转
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      submitRename();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setDraftName(doc.name);
      setRenaming(false);
    }
  };

  return (
    <li
      role="button"
      tabIndex={0}
      onClick={openDoc}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") openDoc();
      }}
      className="group relative flex cursor-pointer items-center gap-4 rounded-md px-2 py-3.5 transition-colors hover:bg-slate-50/60"
    >
      {/* 缩略图：首字母 + 稳定色 */}
      <span
        className="inline-flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-semibold"
        style={{ background: color.bg, color: color.fg }}
        aria-hidden="true"
      >
        {initial}
      </span>

      {/* 标题 + 子标题 */}
      <div className="min-w-0 flex-1">
        {renaming ? (
          <input
            // eslint-disable-next-line jsx-a11y/no-autofocus -- 重命名是用户主动触发，需要立即聚焦
            autoFocus
            value={draftName}
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={submitRename}
            onKeyDown={onInputKeyDown}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded border border-indigo-300 bg-white px-1.5 py-0.5 text-sm font-medium text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
            maxLength={200}
          />
        ) : (
          <div className="flex items-center gap-2">
            <p className="truncate text-sm font-medium text-slate-900 group-hover:text-indigo-700">
              {doc.name}
            </p>
            {isCollaborator && (
              <span
                className="inline-flex flex-shrink-0 items-center rounded-full bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
                title={`来自 ${doc.owner ?? "未知"}，仅可编辑，不能改名/删除`}
              >
                协作
              </span>
            )}
            {doc.isPublic && (
              <span
                className="inline-flex flex-shrink-0 items-center rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
                title="公开文档，任何人通过链接可编辑"
              >
                公开
              </span>
            )}
          </div>
        )}
        <p className="mt-0.5 truncate font-mono text-xs text-slate-400">
          {truncateDocId(doc.id)}
          {isCollaborator && doc.owner ? ` · 来自 ${doc.owner}` : ""}
        </p>
      </div>

      {/* 右侧时间 */}
      <time className="hidden w-28 flex-shrink-0 text-right text-xs text-slate-500 sm:block">
        {relativeTime(doc.updatedAt)}
      </time>

      {/* 操作按钮（hover 才显示，避免拥挤）；协作者模式隐藏改名/删除按钮 */}
      {!isCollaborator && (
        <div className="flex flex-shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setRenaming(true);
              setDraftName(doc.name);
            }}
            disabled={isPending}
            title="重命名"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-700 disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setConfirmingDelete(true);
            }}
            disabled={isPending}
            title="删除"
            className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M3 4h10M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1m1 0v9a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M7 7v5M9 7v5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      )}

      {/* 删除二次确认小卡片 */}
      {confirmingDelete && (
        <div
          className="absolute right-2 top-full z-20 mt-1 w-60 rounded-md border border-slate-200 bg-white p-3 shadow-lg"
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 这是浮层，点击外层时由父级 onClick 处理；这里阻止冒泡避免触发跳转
          onClick={(e) => e.stopPropagation()}
        >
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
    </li>
  );
}
