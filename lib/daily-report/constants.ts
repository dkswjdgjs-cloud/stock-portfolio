// 실적 · 업황 데이터 — 분기/월 업데이트 시 직접 수정
// 단위: 영업이익 = 조원, 서프라이즈 = %

export interface EarningsRow {
  label: string;
  q3_2025_consensus: number | null;
  q3_2025_actual: number | null;
  q4_2025_consensus: number | null;
  q4_2025_actual: number | null;
  q1_2026_consensus: number | null;
  q1_2026_actual: number | null;
  q2_2026_consensus: number | null;
  q2_2026_actual: number | null; // null = 미발표(예정)
}

// 영업이익 (조원)
export const EARNINGS: { samsung: EarningsRow; hynix: EarningsRow } = {
  samsung: {
    label: "삼성전자",
    q3_2025_consensus: 11.5,
    q3_2025_actual: 9.1,
    q4_2025_consensus: 8.0,
    q4_2025_actual: 6.5,
    q1_2026_consensus: 5.2,
    q1_2026_actual: 6.7,
    q2_2026_consensus: 8.0,
    q2_2026_actual: null,
  },
  hynix: {
    label: "SK하이닉스",
    q3_2025_consensus: 7.0,
    q3_2025_actual: 7.03,
    q4_2025_consensus: 8.1,
    q4_2025_actual: 8.1,
    q1_2026_consensus: 6.1,
    q1_2026_actual: 7.44,
    q2_2026_consensus: 8.8,
    q2_2026_actual: null,
  },
};

export interface IndustryRow {
  label: string;
  apr: string | number | null;
  may: string | number | null;
  jun: string | number | null; // 최신
  direction: "up" | "down" | "flat" | null;
  unit: string;
}

// 업황 선행지표 (주 1회 수동 업데이트)
export const INDUSTRY_ROWS: IndustryRow[] = [
  { label: "DRAM DDR5 계약가", apr: 3.2,  may: 3.4,  jun: 3.6,  direction: "up",   unit: "$/GB" },
  { label: "마이크론 분기 매출", apr: null, may: 8.05, jun: null, direction: "up",   unit: "조원" },
  { label: "마이크론 총이익률",  apr: null, may: 22.6, jun: null, direction: "up",   unit: "%" },
  { label: "마이크론 가이던스",  apr: null, may: "상회", jun: null, direction: "up", unit: "" },
  { label: "HBM 완판 가시성",   apr: "2025년 완판", may: "2026년 90%+", jun: null, direction: "up", unit: "" },
  { label: "HBM 점유율(SK하이닉스)", apr: 52, may: 53, jun: null, direction: "up",  unit: "%" },
];

// 업데이트 기준일
export const REPORT_DATE = "2026.06.26";
export const LAST_UPDATED = "2026-06-26T08:00:00+09:00";
