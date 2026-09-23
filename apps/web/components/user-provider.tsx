"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * 极简登录系统：仅输入用户名即可
 *
 * 不做密码、不做服务端 session，登录态完全在 localStorage。
 * 多端用同一用户名登录视为同一人（awareness 不依赖此 id 区分连接，
 * y-websocket 用 clientID 区分；user.id 只是用作元数据）。
 */

const STORAGE_KEY = "yjs-demo:user";
// Cookie 名（不带连字符避免某些代理解析问题）；server component 用
// next/headers cookies() 读它，把 owner 传给后端 REST API
const COOKIE_KEY = "yjs-demo-user";
// Cookie 过期时间：7 天（足够长，跟"记住我"语义一致）
const COOKIE_MAX_AGE = 7 * 24 * 3600;

/** 协同用户结构（对应 shared 包 User，但简化为 name + color） */
export interface AppUser {
  id: string;
  name: string;
  color: string;
}

interface UserContextValue {
  user: AppUser | null;
  /** Provider 仍在从 localStorage 读取时的初始化标志 */
  loading: boolean;
  /** 用 name 登录：写入 localStorage + state，并返回 user */
  login: (name: string) => AppUser;
  /** 退出：清 localStorage + state */
  logout: () => void;
}

const UserContext = createContext<UserContextValue | null>(null);

// 用户颜色色板（6 种），登录时基于 name hash 取稳定色
const USER_PALETTE: ReadonlyArray<string> = [
  "#7c3aed", // violet-600
  "#dc2626", // red-600
  "#16a34a", // green-600
  "#0891b2", // cyan-600
  "#d97706", // amber-600
  "#db2777", // pink-600
];

const USER_PALETTE_BY_MOD = new Map<number, string>(
  USER_PALETTE.map((c, i) => [i, c]),
);
const FALLBACK_COLOR = "#7c3aed";

/** 用 name hash 在色板里稳定取色 */
function pickUserColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return USER_PALETTE_BY_MOD.get(Math.abs(h) % USER_PALETTE.length) ?? FALLBACK_COLOR;
}

interface StoredUser {
  id: string;
  name: string;
  color: string;
}

function readFromStorage(): AppUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredUser;
    // 基本校验，避免脏数据导致崩溃
    if (typeof parsed?.name !== "string" || parsed.name.trim().length === 0) {
      return null;
    }
    return {
      // 兼容历史无 id 的存档：用 name 兜底
      id: parsed.id ?? parsed.name,
      name: parsed.name,
      color: parsed.color ?? pickUserColor(parsed.name),
    };
  } catch {
    return null;
  }
}

function writeToStorage(user: AppUser | null): void {
  if (typeof window === "undefined") return;
  try {
    if (user) {
      window.localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ id: user.id, name: user.name, color: user.color }),
      );
      // 同步写 cookie，让 server component 用 next/headers 读到 owner
      // encodeURIComponent 防止用户名里有 ; = 等字符破坏 cookie 格式
      document.cookie = `${COOKIE_KEY}=${encodeURIComponent(user.name)}; path=/; max-age=${COOKIE_MAX_AGE}; samesite=lax`;
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
      // max-age=0 立即过期
      document.cookie = `${COOKIE_KEY}=; path=/; max-age=0; samesite=lax`;
    }
  } catch {
    // localStorage / cookie 写入失败（隐私模式 / 配额超限），静默失败
  }
}

export function UserProvider({
  children,
}: {
  children: ReactNode;
}): React.ReactElement {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // mount 时从 localStorage 读 user
  useEffect(() => {
    setUser(readFromStorage());
    setLoading(false);
  }, []);

  // 跨 tab / 跨窗口同步：监听 storage 事件，登出/登录会反映到当前 tab
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY) return;
      setUser(readFromStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const login = useCallback((name: string): AppUser => {
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      throw new Error("用户名不能为空");
    }
    const next: AppUser = {
      id: trimmed,
      name: trimmed,
      color: pickUserColor(trimmed),
    };
    writeToStorage(next);
    setUser(next);
    return next;
  }, []);

  const logout = useCallback(() => {
    writeToStorage(null);
    setUser(null);
  }, []);

  const value = useMemo<UserContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

/** 读取当前登录用户和登录/退出方法 */
export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (ctx === null) {
    throw new Error("useUser 必须在 <UserProvider> 内使用");
  }
  return ctx;
}
