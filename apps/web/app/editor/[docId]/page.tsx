import { notFound, redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { DocumentMeta } from "@yjs-demo/shared";
import EditorClient from "./editor-client";

// SSR：先去后端确认文档存在；如果 docId="new"，则新建一个
// 从 cookie 读 owner 作为 x-owner header，确保只看到/创建自己的文档
async function ensureDocument(docId: string): Promise<DocumentMeta | null> {
  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
  const cookieStore = await cookies();
  // Next.js cookies() 已自动 decodeURIComponent 解码过 cookie 值
  // （写入时写的是 URL-encoded，读出来已经是原始中文名）。
  // HTTP x-owner header 仍要求 ASCII（ByteString 限制），中文用户名
  // 要再 encodeURIComponent 一次才能安全放进 header；后端 controller
  // 接收时统一 decodeURIComponent 还原。
  const ownerRaw = cookieStore.get("yjs-demo-user")?.value;
  const owner = ownerRaw ? encodeURIComponent(ownerRaw) : undefined;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (owner) headers["x-owner"] = owner;
  try {
    if (docId === "new") {
      // 没登录（owner 空）的话，后端会创建无主文档；正常流程 RequireUser 已拦截
      // body 里 owner 用同样的 URL-encoded 字符串跟 header 保持一致（后端实际从 header 取）
      const res = await fetch(`${apiBase}/api/documents`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          name: `Document ${new Date().toLocaleString("zh-CN")}`,
          owner: owner ?? null,
        }),
        cache: "no-store",
      });
      if (!res.ok) return null;
      return (await res.json()) as DocumentMeta;
    }
    const res = await fetch(`${apiBase}/api/documents/${docId}`, {
      cache: "no-store",
      headers,
    });
    if (!res.ok) return null;
    const json = (await res.json()) as DocumentMeta | { error: string };
    if ("error" in json) return null;
    return json;
  } catch {
    return null;
  }
}

export default async function EditorPage({
  params,
}: {
  params: Promise<{ docId: string }>;
}): Promise<React.ReactElement> {
  const { docId } = await params;
  const doc = await ensureDocument(docId);
  if (!doc) {
    notFound();
  }

  // "new" 分支：文档已经在 ensureDocument 里创建好，
  // 用 redirect() 在 server 端发起跳转到真实 docId 的 URL。
  // ⚠️ 注意：redirect() 必须放在 try/catch 外面，否则它抛的
  // NEXT_REDIRECT 特殊错误会被 catch 吞掉，跳转失效（页面空白）
  if (docId === "new") {
    redirect(`/editor/${doc.id}`);
  }

  return (
    <EditorClient
      docId={doc.id}
      docName={doc.name}
      owner={doc.owner ?? null}
      isPublic={doc.isPublic ?? false}
    />
  );
}
