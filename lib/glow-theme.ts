import type { CSSProperties } from "react";

// ===== GLOW iPadOS 테마 상수 (SVG/인라인 스타일용) =====
// CSS 변수와 동일한 값 — SVG stroke/fill 등 인라인에서 직접 사용
export const C = {
  bgGrouped: "#F2F2F7",
  bgSidebar: "#F7F7F9",
  card: "#FFFFFF",
  label: "#000000",
  sec: "rgba(60,60,67,0.60)",
  ter: "rgba(60,60,67,0.30)",
  sep: "rgba(60,60,67,0.29)",
  fill: "rgba(120,120,128,0.08)",
  search: "rgba(120,120,128,0.12)",
  red: "#FF3B30",
  blue: "#007AFF",
  green: "#34C759",
  gray: "#8E8E93",
  orange: "#FF9500",
} as const;

export const FONT = `-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", Pretendard, system-ui, sans-serif`;

export const NUM: CSSProperties = { fontVariantNumeric: "tabular-nums" };

export const IOS_EASE = "cubic-bezier(.32,.72,.25,1)";

// 자산배분 차트 팔레트
export const CHART_PALETTE = [
  "#5856D6",
  "#30B0C7",
  "#007AFF",
  "#AF52DE",
  "#00C7BE",
  "#8E8E93",
  "#34C759",
] as const;

export const SECTOR_COLOR: Record<string, string> = {
  반도체: "#5856D6",
  채권혼합: "#30B0C7",
  지수: "#AF52DE",
  현금: "#34C759",
};

export const COUNTRY_COLOR: Record<string, string> = {
  한국: "#007AFF",
  미국: "#FF9500",
  현금: "#34C759",
};
