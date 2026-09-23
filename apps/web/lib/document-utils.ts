// 文档列表展示工具：server component 和 client component 共用，避免 DRY

/** ISO 时间 → 相对时间，超过 7 天回落到中文长日期 */
export function relativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Math.max(0, Date.now() - t);
  const min = Math.floor(diff / 60000);
  if (min < 1) return "刚刚";
  if (min < 60) return `${min} 分钟前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小时前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** docId 截断显示：前 10 + … + 后 4 */
export function truncateDocId(docId: string): string {
  if (docId.length <= 18) return docId;
  return `${docId.slice(0, 10)}…${docId.slice(-4)}`;
}

// 7 种低饱和度配色，基于名字 hash 稳定取色
export interface PaletteColor {
  readonly bg: string;
  readonly fg: string;
}

const PALETTE: ReadonlyArray<PaletteColor> = [
  { bg: "#e0e7ff", fg: "#4338ca" },
  { bg: "#ede9fe", fg: "#6d28d9" },
  { bg: "#fce7f3", fg: "#be185d" },
  { bg: "#dcfce7", fg: "#15803d" },
  { bg: "#ccfbf1", fg: "#0f766e" },
  { bg: "#cffafe", fg: "#0e7490" },
  { bg: "#fef3c7", fg: "#b45309" },
];

// Map 做模 N 索引，避免数组索引返回 T | undefined
const PALETTE_BY_MOD = new Map<number, PaletteColor>(
  PALETTE.map((p, i) => [i, p]),
);

const FALLBACK_COLOR: PaletteColor = { bg: "#e0e7ff", fg: "#4338ca" };

/** 用名字 hash 在 PALETTE 中稳定取色 */
export function pickColor(key: string): PaletteColor {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  return PALETTE_BY_MOD.get(Math.abs(h) % PALETTE.length) ?? FALLBACK_COLOR;
}

/** 取名字首字母（兜底 #） */
export function nameInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || "#";
}
