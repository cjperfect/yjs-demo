import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  // dts 走独立 tsc 步骤生成（tsup 的 dts plugin 在 ESM .js 后缀 import 下有 file list 问题）
  dts: false,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // yjs / lib0 是 ESM 友好的 CommonJS，外部化避免重复打包
  external: ["yjs", "y-protocols", "lib0", "ws", "@yjs-demo/shared"],
});
