import type { Metadata } from "next";
import "./globals.css";
import { UserProvider } from "../components/user-provider";
import { RequireUser } from "../components/require-user";
import { AppHeader } from "../components/app-header";

export const metadata: Metadata = {
  title: "yjs-demo · 协同文档",
  description: "Yjs CRDT collaborative document editing",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <UserProvider>
          {/* Header 是 client component（要读 useUser），所以放在 UserProvider 子树里 */}
          <AppHeader />
          <main className="flex-1">
            <RequireUser>{children}</RequireUser>
          </main>

          {/* Footer：极简，单行信息 */}
          <footer className="border-t border-slate-200 bg-white">
            <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-4 text-xs text-slate-400">
              <span>Yjs CRDT · 实时协同</span>
              <span>Postgres 持久化 · WebSocket 同步 · Tiptap 富文本</span>
            </div>
          </footer>
        </UserProvider>
      </body>
    </html>
  );
}
