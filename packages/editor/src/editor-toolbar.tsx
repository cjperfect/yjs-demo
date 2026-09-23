"use client";

import type { Editor } from "@tiptap/react";
import type { JSX } from "react";

export interface EditorToolbarProps {
  editor: Editor | null;
}

type BtnAction = {
  label: string;
  icon: JSX.Element;
  active: (e: Editor) => boolean;
  run: (e: Editor) => void;
  disabled?: (e: Editor) => boolean;
  title: string;
};

const GROUP_1: BtnAction[] = [
  {
    title: "粗体",
    label: "bold",
    icon: <span className="ce-tb-bold">B</span>,
    active: (e) => e.isActive("bold"),
    run: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    title: "斜体",
    label: "italic",
    icon: <span className="ce-tb-italic">I</span>,
    active: (e) => e.isActive("italic"),
    run: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    title: "删除线",
    label: "strike",
    icon: <span className="ce-tb-strike">S</span>,
    active: (e) => e.isActive("strike"),
    run: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    title: "行内代码",
    label: "code",
    icon: <span className="ce-tb-code">{"</>"}</span>,
    active: (e) => e.isActive("code"),
    run: (e) => e.chain().focus().toggleCode().run(),
  },
];

const GROUP_2: BtnAction[] = [
  {
    title: "标题 1",
    label: "h1",
    icon: <span className="ce-tb-h">H1</span>,
    active: (e) => e.isActive("heading", { level: 1 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run(),
  },
  {
    title: "标题 2",
    label: "h2",
    icon: <span className="ce-tb-h">H2</span>,
    active: (e) => e.isActive("heading", { level: 2 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run(),
  },
  {
    title: "标题 3",
    label: "h3",
    icon: <span className="ce-tb-h">H3</span>,
    active: (e) => e.isActive("heading", { level: 3 }),
    run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run(),
  },
];

const GROUP_3: BtnAction[] = [
  {
    title: "无序列表",
    label: "ul",
    icon: (
      <svg viewBox="0 0 16 16" className="ce-tb-icon" fill="currentColor" aria-hidden="true">
        <circle cx="3" cy="4" r="1.2" />
        <circle cx="3" cy="8" r="1.2" />
        <circle cx="3" cy="12" r="1.2" />
        <rect x="6" y="3.4" width="8" height="1.2" rx="0.6" />
        <rect x="6" y="7.4" width="8" height="1.2" rx="0.6" />
        <rect x="6" y="11.4" width="8" height="1.2" rx="0.6" />
      </svg>
    ),
    active: (e) => e.isActive("bulletList"),
    run: (e) => e.chain().focus().toggleBulletList().run(),
  },
  {
    title: "有序列表",
    label: "ol",
    icon: (
      <svg viewBox="0 0 16 16" className="ce-tb-icon" fill="currentColor" aria-hidden="true">
        <text x="0" y="6" fontSize="5" fill="currentColor">1</text>
        <text x="0" y="11" fontSize="5" fill="currentColor">2</text>
        <rect x="5" y="3.4" width="9" height="1.2" rx="0.6" />
        <rect x="5" y="7.4" width="9" height="1.2" rx="0.6" />
        <rect x="5" y="11.4" width="9" height="1.2" rx="0.6" />
      </svg>
    ),
    active: (e) => e.isActive("orderedList"),
    run: (e) => e.chain().focus().toggleOrderedList().run(),
  },
  {
    title: "引用",
    label: "quote",
    icon: <span className="ce-tb-quote">"</span>,
    active: (e) => e.isActive("blockquote"),
    run: (e) => e.chain().focus().toggleBlockquote().run(),
  },
  {
    title: "代码块",
    label: "codeblock",
    icon: <span className="ce-tb-codeblock">{"{ }"}</span>,
    active: (e) => e.isActive("codeBlock"),
    run: (e) => e.chain().focus().toggleCodeBlock().run(),
  },
];

const GROUP_4: BtnAction[] = [
  {
    title: "撤销",
    label: "undo",
    icon: (
      <svg viewBox="0 0 16 16" className="ce-tb-icon" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M3 7h7a3 3 0 0 1 0 6H6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M5 5L3 7l2 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    active: () => false,
    run: (e) => e.chain().focus().undo().run(),
    disabled: (e) => !e.can().undo(),
  },
  {
    title: "重做",
    label: "redo",
    icon: (
      <svg viewBox="0 0 16 16" className="ce-tb-icon" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M13 7H6a3 3 0 0 0 0 6h4" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M11 5l2 2-2 2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    active: () => false,
    run: (e) => e.chain().focus().redo().run(),
    disabled: (e) => !e.can().redo(),
  },
];

function ToolbarButton({
  action,
  editor,
}: {
  action: BtnAction;
  editor: Editor;
}): JSX.Element {
  const isActive = action.active(editor);
  const isDisabled = action.disabled?.(editor) ?? false;
  return (
    <button
      type="button"
      title={action.title}
      aria-label={action.title}
      aria-pressed={isActive}
      disabled={isDisabled}
      className={`ce-tb-btn${isActive ? " ce-tb-btn--active" : ""}${isDisabled ? " ce-tb-btn--disabled" : ""}`}
      onClick={() => action.run(editor)}
    >
      {action.icon}
    </button>
  );
}

function Separator(): JSX.Element {
  return <span className="ce-tb-sep" aria-hidden="true" />;
}

/**
 * 富文本编辑器工具栏
 *
 * 与 Tiptap editor 实例绑定，提供常见格式切换按钮。
 * 不依赖任何 CSS 框架——样式由 globals.css 的 .ce-tb-* 系列提供。
 */
export function EditorToolbar({ editor }: EditorToolbarProps): JSX.Element | null {
  if (!editor) return null;

  return (
    <div className="ce-toolbar" role="toolbar" aria-label="格式工具栏">
      {GROUP_1.map((a) => (
        <ToolbarButton key={a.label} action={a} editor={editor} />
      ))}
      <Separator />
      {GROUP_2.map((a) => (
        <ToolbarButton key={a.label} action={a} editor={editor} />
      ))}
      <Separator />
      {GROUP_3.map((a) => (
        <ToolbarButton key={a.label} action={a} editor={editor} />
      ))}
      <Separator />
      {GROUP_4.map((a) => (
        <ToolbarButton key={a.label} action={a} editor={editor} />
      ))}
    </div>
  );
}
