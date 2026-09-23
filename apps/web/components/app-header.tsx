"use client";

import { useRouter } from "next/navigation";
import { useUser } from "./user-provider";

/**
 * 顶部导航：logo + 链接 + 当前用户 + 退出
 *
 * 从原 layout header 抽出来变 client component，因为要读 useUser()。
 * server component 不能用 client context。
 */
export function AppHeader(): React.ReactElement {
  const { user, logout } = useUser();
  const router = useRouter();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  // 取用户名首字母当头像（兜底 #）
  const initial = user ? user.name.trim().charAt(0).toUpperCase() || "#" : "#";

  return (
    <header className="h-14 border-b border-slate-200 bg-white">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-8">
        <a href="/" className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white">
            <svg viewBox="0 0 16 16" className="h-4 w-4" fill="currentColor" aria-hidden="true">
              <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h3.379a1.5 1.5 0 0 1 1.06.44L8.062 2.56a1.5 1.5 0 0 0 1.06.44H12.5A1.5 1.5 0 0 1 14 4.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9Z" />
            </svg>
          </span>
          <span className="text-[15px] font-semibold tracking-tight">yjs-demo</span>
          <span className="ml-1 hidden text-xs text-slate-400 sm:inline">协同文档</span>
        </a>

        <nav className="flex items-center gap-3">
          <a
            href="/"
            className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            文档
          </a>
          <a
            href="/editor/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="currentColor" aria-hidden="true">
              <path d="M8 2a.75.75 0 0 1 .75.75v4.5h4.5a.75.75 0 0 1 0 1.5h-4.5v4.5a.75.75 0 0 1-1.5 0v-4.5h-4.5a.75.75 0 0 1 0-1.5h4.5v-4.5A.75.75 0 0 1 8 2Z" />
            </svg>
            新建
          </a>

          {user && (
            <div className="ml-2 flex items-center gap-2 border-l border-slate-200 pl-3">
              <span
                className="inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold text-white"
                style={{ backgroundColor: user.color }}
                title={user.name}
                aria-hidden="true"
              >
                {initial}
              </span>
              <span className="hidden text-sm text-slate-700 sm:inline">
                {user.name}
              </span>
              <button
                type="button"
                onClick={handleLogout}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                title="退出登录"
              >
                退出
              </button>
            </div>
          )}
        </nav>
      </div>
    </header>
  );
}
