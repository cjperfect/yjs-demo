"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "../../components/user-provider";

/**
 * 极简登录页：只输入用户名即可登录
 *
 * 已登录访问会被 RequireUser 自动 redirect 回首页。
 * 提交后写入 localStorage 并跳回 /。
 */
export default function LoginPage(): React.ReactElement {
  const { login } = useUser();
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      setError("请输入用户名");
      return;
    }
    if (trimmed.length > 32) {
      setError("用户名最多 32 个字符");
      return;
    }
    setSubmitting(true);
    try {
      login(trimmed);
      router.replace("/");
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "登录失败");
    }
  };

  return (
    <div className="mx-auto flex max-w-md flex-col items-center justify-center px-8 py-16">
      {/* Logo + 标题 */}
      <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white">
        <svg viewBox="0 0 16 16" className="h-6 w-6" fill="currentColor" aria-hidden="true">
          <path d="M2 3.5A1.5 1.5 0 0 1 3.5 2h3.379a1.5 1.5 0 0 1 1.06.44L8.062 2.56a1.5 1.5 0 0 0 1.06.44H12.5A1.5 1.5 0 0 1 14 4.5v8a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 2 12.5v-9Z" />
        </svg>
      </span>
      <h1 className="mt-4 text-lg font-semibold text-slate-900">登录 yjs-demo</h1>
      <p className="mt-1 text-sm text-slate-500">
        只需要一个用户名即可开始协同编辑
      </p>

      {/* 表单 */}
      <form onSubmit={onSubmit} className="mt-6 w-full">
        <label htmlFor="login-name" className="sr-only">
          用户名
        </label>
        <input
          id="login-name"
          type="text"
          autoComplete="username"
          autoFocus
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          placeholder="输入用户名，比如 张三"
          maxLength={32}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
        />
        {error && (
          <p className="mt-2 text-xs text-red-600">{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting || name.trim().length === 0}
          className="mt-4 w-full rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "登录中..." : "登录"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-slate-400">
        提示：登录信息只存于本浏览器，无密码。
        <br />
        在另一台设备用同一用户名会被视为同一人。
      </p>
    </div>
  );
}
