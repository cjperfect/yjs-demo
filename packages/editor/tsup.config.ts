import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  // React / Yjs / ProseMirror 等走外部依赖，不打包
  external: [
    "react",
    "react-dom",
    "react/jsx-runtime",
    "yjs",
    "y-prosemirror",
    "y-websocket",
    "@tiptap/core",
    "@tiptap/react",
    "@tiptap/starter-kit",
    "@tiptap/extension-collaboration",
    "@tiptap/extension-collaboration-cursor",
    "@tiptap/pm",
    "prosemirror-state",
    "prosemirror-view",
    "prosemirror-model",
    "prosemirror-transform",
    "@yjs-demo/shared",
  ],
  // 把 styles.css 一并复制到 dist
  esbuildOptions(options) {
    options.loader = {
      ...options.loader,
      ".css": "copy",
    };
    options.assetNames = "[name]";
  },
});
