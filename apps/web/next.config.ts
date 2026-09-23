import type { NextConfig } from "next";

const config: NextConfig = {
  // 转发 /api/* 和 /yjs/* 到 NestJS 后端（3001）
  // /yjs/* 用于 Yjs WebSocket 协同——走同源避免浏览器系统代理（Clash 等）
  // 拦截直连 ws://localhost:3001 的跨端口连接
  async rewrites() {
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
    return [
      {
        source: "/api/:path*",
        destination: `${apiBase}/api/:path*`,
      },
      {
        source: "/yjs/:path*",
        destination: `${apiBase}/yjs/:path*`,
      },
    ];
  },
  experimental: {
    // 加快 dev 模式 HMR
    optimizePackageImports: ["react", "react-dom"],
  },
};

export default config;
