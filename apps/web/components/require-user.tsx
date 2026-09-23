"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useUser } from "./user-provider";

/**
 * 未登录守卫
 *
 * 包裹在 layout.tsx 的 <main> 外层：用户未登录且不在 /login 路径时，
 * 用 useEffect 跳到 /login，loading 期间显示占位避免 SSR 内容闪烁。
 *
 * 注意：在 /login 路径上跳过守卫，避免循环重定向。
 */
export function RequireUser({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const { user, loading } = useUser();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === "/login";

  useEffect(() => {
    if (loading) return;
    if (!user && !isLoginPage) {
      router.replace("/login");
    }
    // 已登录但停留在 /login：跳回首页
    if (user && isLoginPage) {
      router.replace("/");
    }
  }, [loading, user, isLoginPage, router]);

  // /login 路径直接渲染（登录页自己处理"已登录就跳走"逻辑）
  if (isLoginPage) {
    return <>{children}</>;
  }

  // 还在从 localStorage 读：先占位
  if (loading) {
    return (
      <div className="flex justify-center py-16 text-sm text-slate-400">
        <svg
          viewBox="0 0 24 24"
          className="mr-2 h-4 w-4 animate-spin"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
        正在加载...
      </div>
    );
  }

  // 未登录：useEffect 已经触发跳转，渲染占位
  if (!user) {
    return (
      <div className="flex justify-center py-16 text-sm text-slate-400">
        正在跳转到登录页...
      </div>
    );
  }

  return <>{children}</>;
}
