// ===== GLOW tablet-v2 디자인 토큰 (CSS 변수 참조) =====
export const C = {
  bgGrouped: "var(--glow-bg-grouped)",
  bgSidebar: "var(--glow-bg-sidebar)",
  card: "var(--glow-card)",
  label: "var(--glow-label)",
  sec: "var(--glow-sec)",
  ter: "var(--glow-ter)",
  sep: "var(--glow-sep)",
  fill: "var(--glow-fill)",
  search: "var(--glow-search)",
  red: "var(--glow-red)",
  blue: "var(--glow-blue)",
  green: "var(--glow-green)",
  gray: "var(--glow-gray)",
  orange: "var(--glow-orange)",
};

export const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Apple SD Gothic Neo", Pretendard, system-ui, sans-serif';
export const NUM: React.CSSProperties = { fontVariantNumeric: "tabular-nums" };
export const IOS_EASE = "cubic-bezier(.32,.72,.25,1)";
export const CHART_PALETTE = ["#5856D6", "#30B0C7", "#007AFF", "#AF52DE", "#00C7BE", "#34C759", "#5AC8FA", "#FFCC00"];
export const SECTOR_COLOR: Record<string, string> = { "반도체": "#5856D6", "채권혼합": "#30B0C7", "지수": "#AF52DE", "2차전지": "#00C7BE", "IT": "#007AFF", "현금": "#34C759" };
export const COUNTRY_COLOR: Record<string, string> = { "한국": "#007AFF", "미국": "#AF52DE", "현금": "#34C759" };
