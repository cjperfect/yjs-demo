import Link from "next/link";
import { cookies } from "next/headers";
import type { DocumentMeta } from "@yjs-demo/shared";
import { DocumentListItem } from "../components/document-list-item";

// 用 server component 直接 fetch 后端 API
// 从 cookie 读 yjs-demo-user（UserProvider 登录时写入）作为 owner
// header x-owner 传给后端，后端按 owner 过滤列表
// 返回 { docs, error }：区分 fetch 失败和真空，避免静默显示"共 0 篇"误导用户
async function fetchDocuments(): Promise<{
  docs: DocumentMeta[];
  error: string | null;
}> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const cookieStore = await cookies();
  // Next.js cookies() 已自动 decodeURIComponent 解码过 cookie 值
  // （写入时写的是 URL-encoded，读出来已经是原始中文名）。
  // HTTP x-owner header 仍要求 ASCII（ByteString 限制），中文用户名
  // 要再 encodeURIComponent 一次才能安全放进 header；后端 controller
  // 接收时统一 decodeURIComponent 还原。
  const ownerRaw = cookieStore.get("yjs-demo-user")?.value;
  const owner = ownerRaw ? encodeURIComponent(ownerRaw) : undefined;
  try {
    const res = await fetch(`${apiBase}/api/documents`, {
      cache: "no-store",
      headers: owner ? { "x-owner": owner } : undefined,
    });
    if (!res.ok) {
      return { docs: [], error: `后端返回 HTTP ${res.status}` };
    }
    const docs = (await res.json()) as DocumentMeta[];
    return { docs, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      docs: [],
      error: `无法连接后端（${apiBase}）：${msg}。请确认 NestJS 已在 3001 端口启动（pnpm --filter @yjs-demo/server dev）`,
    };
  }
}

export default async function HomePage(): Promise<React.ReactElement> {
  const { docs, error } = await fetchDocuments();
  // 把列表按 role 分成两组：owner = "我的文档"，collaborator = "协作给我的"
  const ownDocs = docs.filter((d) => d.role !== "collaborator");
  const collabDocs = docs.filter((d) => d.role === "collaborator");
  const hasDocs = docs.length > 0;
  const recentCount = docs.filter(
    (d) => Date.now() - new Date(d.updatedAt).getTime() < 24 * 3600 * 1000,
  ).length;
  // 模板字符串提前拼好，避免 React 子节点序列化输出 "共 ",N," 篇" 这种带引号格式
  const countText = `共 ${docs.length} 篇 · 近 24 小时更新 ${recentCount} 篇`;

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      {/* 标题行：左对齐标题 + 右对齐新建按钮，严格一行 */}
      <div className="flex items-end justify-between border-b border-slate-200 pb-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">文档</h1>
          <p className="mt-1 text-sm text-slate-500">
            {error ? <span className="text-amber-600">{countText}</span> : countText}
          </p>
        </div>
        <Link
          href="/editor/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
            <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
          </svg>
          新建文档
        </Link>
      </div>

      {/* fetch 失败时的错误提示 */}
      {error && (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium">无法加载文档列表</p>
          <p className="mt-1 text-xs text-amber-700">{error}</p>
        </div>
      )}

      {/* 文档列表：分"我的文档" + "协作给我的"两组 */}
      {hasDocs ? (
        <div className="space-y-8">
          {ownDocs.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                我的文档
              </h2>
              <ul className="divide-y divide-slate-100">
                {ownDocs.map((doc) => (
                  <DocumentListItem key={doc.id} doc={doc} />
                ))}
              </ul>
            </section>
          )}
          {collabDocs.length > 0 && (
            <section>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                协作给我的
              </h2>
              <ul className="divide-y divide-slate-100">
                {collabDocs.map((doc) => (
                  <DocumentListItem key={doc.id} doc={doc} />
                ))}
              </ul>
            </section>
          )}
        </div>
      ) : (
        <EmptyState />
      )}
    </div>
  );
}

function EmptyState(): React.ReactElement {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {/* 简洁图标：圆角方块 + 文档 SVG */}
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" strokeLinejoin="round" />
          <path d="M14 3v5h5" strokeLinejoin="round" />
          <path d="M9 13h6M9 17h4" strokeLinecap="round" />
        </svg>
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-900">还没有任何文档</h3>
      <p className="mt-1 text-sm text-slate-500">创建第一份协同文档，开两个浏览器窗口试试实时同步</p>
      <Link
        href="/editor/new"
        className="mt-5 inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
      >
        <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
          <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
        </svg>
        创建第一个文档
      </Link>
      <p className="mt-5 text-xs text-slate-400">
        提示：后端需在 3001 端口启动（pnpm --filter @yjs-demo/server dev）
      </p>
    </div>
  );
}
