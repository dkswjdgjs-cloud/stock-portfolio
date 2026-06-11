// =============================================================
// tablet-v2 목업 데이터 레이어 (1단계 전용)
// 2단계에서 이 파일의 데이터 소스를 KIS/Supabase 실데이터로 교체합니다.
// 컴포넌트는 이 파일이 export하는 타입/함수 시그니처에만 의존하므로,
// 교체 시 컴포넌트 수정은 최소화됩니다.
// =============================================================

export interface StockTrade {
  date: string;
  acct: string;
  type: "매수" | "매도";
  qty: number;
  unit: string;
}

export interface MockStock {
  id: string;
  name: string;
  code: string;
  market: string;
  currency: "KRW" | "USD";
  price: number;
  dayPct: number;
  sector: string;
  country: string;
  color: string;
  holdings: Record<string, { qty: number; avg: number }>;
  stats: Record<string, string>;
  trades: StockTrade[];
}

export interface HoldingView {
  qty: number;
  avg: number;
  value: number;
  invested: number;
  pl: number;
  plPct: number;
}

export interface PerfPoint {
  date: Date;
  label: string;
  invested: number;
  value: number;
  profit: number;
}

export interface AcctPerf {
  name: string;
  val: string;
  inv: string;
  gain: string;
  pct: number;
}

export const FX = 1385; // USD→KRW (프로토타입용 고정 환율)

export const ACCT_LIST = ["전체", "ISA", "IRP", "연금저축", "DC형 연금", "일반직투1", "일반직투2"];

// 수익금 표시 모드: 누적 → 연 → 월 → 일 (프로토타입용 환산 비율, 실제로는 스냅샷 기반 계산으로 교체)
export const PL_MODES = ["누적", "연", "월", "일"] as const;
export const PL_FACTOR: Record<(typeof PL_MODES)[number], number> = {
  누적: 1,
  연: 0.42,
  월: 0.075,
  일: 0.011,
};

// ===== 종목 목업 (계좌별 보유 내역 포함) =====
export const STOCKS: MockStock[] = [
  {
    id: "4425", name: "PLUS 글로벌HBM반도체", code: "442580", market: "국내 ETF", currency: "KRW",
    price: 114870, dayPct: 0.87, sector: "반도체", country: "한국", color: "#5856D6",
    holdings: { 연금저축: { qty: 211, avg: 127010 }, "DC형 연금": { qty: 72, avg: 129837 }, IRP: { qty: 13, avg: 125715 } },
    stats: { 시가: "109,930", 고가: "117,155", 저가: "109,725", 거래량: "2,125,638" },
    trades: [
      { date: "2026-06-10", acct: "연금저축", type: "매수", qty: 4, unit: "116,340원" },
      { date: "2026-06-04", acct: "DC형 연금", type: "매수", qty: 72, unit: "129,837원" },
      { date: "2026-06-02", acct: "IRP", type: "매수", qty: 13, unit: "125,715원" },
      { date: "2026-06-02", acct: "연금저축", type: "매수", qty: 207, unit: "127,010원" },
    ],
  },
  {
    id: "4483", name: "KODEX 삼성전자채권혼합", code: "448320", market: "국내 ETF", currency: "KRW",
    price: 17720, dayPct: -0.45, sector: "채권혼합", country: "한국", color: "#30B0C7",
    holdings: { IRP: { qty: 738, avg: 16434.09 } },
    stats: { 시가: "17,790", 고가: "17,820", 저가: "17,650", 거래량: "412,907" },
    trades: [
      { date: "2026-05-28", acct: "IRP", type: "매수", qty: 120, unit: "17,210원" },
      { date: "2026-04-15", acct: "IRP", type: "매수", qty: 618, unit: "16,283원" },
    ],
  },
  {
    id: "0059", name: "삼성전자", code: "005930", market: "KOSPI", currency: "KRW",
    price: 298000, dayPct: -1.16, sector: "반도체", country: "한국", color: "#007AFF",
    holdings: { 일반직투1: { qty: 50, avg: 195000 }, ISA: { qty: 20, avg: 177777 } },
    stats: { 시가: "301,500", 고가: "303,000", 저가: "296,500", 거래량: "18,204,113", PER: "21.4", PBR: "2.8" },
    trades: [
      { date: "2026-05-12", acct: "일반직투1", type: "매수", qty: 10, unit: "276,000원" },
      { date: "2026-02-03", acct: "일반직투1", type: "매수", qty: 25, unit: "201,500원" },
      { date: "2025-11-20", acct: "일반직투1", type: "매수", qty: 15, unit: "157,300원" },
      { date: "2025-10-08", acct: "ISA", type: "매수", qty: 20, unit: "177,777원" },
    ],
  },
  {
    id: "0695", name: "KODEX 200", code: "069500", market: "국내 ETF", currency: "KRW",
    price: 122700, dayPct: -0.88, sector: "지수", country: "한국", color: "#AF52DE",
    holdings: { 연금저축: { qty: 233, avg: 89337.12 } },
    stats: { 시가: "123,900", 고가: "124,350", 저가: "122,250", 거래량: "5,118,392" },
    trades: [
      { date: "2026-03-10", acct: "연금저축", type: "매수", qty: 40, unit: "104,200원" },
      { date: "2025-12-08", acct: "연금저축", type: "매수", qty: 193, unit: "86,255원" },
    ],
  },
  {
    id: "DRAM", name: "DRAM", code: "DRAM", market: "NASDAQ", currency: "USD",
    price: 57.37, dayPct: 4.54, sector: "반도체", country: "미국", color: "#00C7BE",
    holdings: { 일반직투2: { qty: 19, avg: 35.15 } },
    stats: { 시가: "$55.02", 고가: "$58.10", 저가: "$54.71", 거래량: "3,882,051" },
    trades: [{ date: "2026-01-22", acct: "일반직투2", type: "매수", qty: 19, unit: "$35.15" }],
  },
  {
    id: "0006", name: "SK하이닉스", code: "000660", market: "KOSPI", currency: "KRW",
    price: 2077000, dayPct: 1.42, sector: "반도체", country: "한국", color: "#8E8E93",
    holdings: { "DC형 연금": { qty: 12, avg: 580000 }, ISA: { qty: 8, avg: 652812 } },
    stats: { 시가: "2,050,000", 고가: "2,095,000", 저가: "2,031,000", 거래량: "2,931,058", PER: "12.7", PBR: "3.4" },
    trades: [
      { date: "2026-04-02", acct: "DC형 연금", type: "매수", qty: 3, unit: "1,512,000원" },
      { date: "2025-09-17", acct: "DC형 연금", type: "매수", qty: 9, unit: "702,400원" },
      { date: "2025-05-30", acct: "ISA", type: "매수", qty: 8, unit: "652,812원" },
    ],
  },
];

// 계좌별 예수금
export const CASH: Record<string, number> = {
  ISA: 120000, IRP: 60000, 연금저축: 95000, "DC형 연금": 110000, 일반직투1: 88682, 일반직투2: 75000,
};

// 계좌별 성과 (1단계 목업 — 2단계에서 transactions 기반 계산으로 교체)
export const ACCOUNTS: AcctPerf[] = [
  { name: "ISA", val: "₩41,338,661", inv: "₩9,000,000", gain: "+₩32,338,661", pct: 359.3 },
  { name: "연금저축", val: "₩26,044,334", inv: "₩12,010,000", gain: "+₩14,034,334", pct: 116.9 },
  { name: "DC형 연금", val: "₩31,758,841", inv: "₩18,807,023", gain: "+₩12,951,818", pct: 68.9 },
  { name: "IRP", val: "₩8,002,968", inv: "₩4,856,000", gain: "+₩3,146,968", pct: 64.8 },
  { name: "일반직투1", val: "₩20,116,023", inv: "₩14,000,000", gain: "+₩6,116,023", pct: 43.7 },
  { name: "일반직투2", val: "₩11,109,841", inv: "₩8,191,714", gain: "+₩2,918,127", pct: 35.6 },
];

// ===== 포맷터 =====
export const fmtW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
export const fmtN = (n: number) => n.toLocaleString("ko-KR");
export const fmtPrice = (s: MockStock) => (s.currency === "USD" ? "$" + s.price.toFixed(2) : fmtN(s.price));
export const fmtAvg = (s: MockStock, avg: number) =>
  s.currency === "USD" ? "$" + avg.toFixed(2) : fmtN(Math.round(avg * 100) / 100) + "원";
export const toKRW = (s: MockStock, units: number) => (s.currency === "USD" ? units * FX : units);

export const fmtEok = (n: number) => {
  const sign = n < 0 ? "-" : "";
  const a = Math.abs(n);
  if (a >= 1e8) return sign + (a / 1e8).toFixed(1) + "억";
  if (a >= 1e4) return sign + Math.round(a / 1e4).toLocaleString("ko-KR") + "만";
  return sign + Math.round(a).toString();
};

// ===== 보유/예수금 합산 (계좌 필터 기준) =====
export function holdingOf(stock: MockStock, acctSel: string): HoldingView | null {
  const entries =
    acctSel === "전체"
      ? Object.entries(stock.holdings)
      : Object.entries(stock.holdings).filter(([a]) => a === acctSel);
  const qty = entries.reduce((s, [, h]) => s + h.qty, 0);
  if (!qty) return null;
  const investedU = entries.reduce((s, [, h]) => s + h.qty * h.avg, 0);
  const avg = investedU / qty;
  const value = toKRW(stock, qty * stock.price);
  const invested = toKRW(stock, investedU);
  const pl = value - invested;
  return { qty, avg, value, invested, pl, plPct: (pl / invested) * 100 };
}

export function cashOf(acctSel: string): number {
  return acctSel === "전체" ? Object.values(CASH).reduce((a, b) => a + b, 0) : CASH[acctSel] || 0;
}

// ===== 시드 기반 가짜 주가 시계열 (2단계: KIS 기간별 시세 API로 교체) =====
export function makeSeries(seed: number, n: number, trendPct: number): number[] {
  let x = seed;
  const rnd = () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
  const pts = [100];
  for (let i = 1; i < n; i++) {
    pts.push(pts[i - 1] * (1 + trendPct / 100 / n + (rnd() - 0.5) * 0.035));
  }
  return pts;
}

// ===== 성과 추이: 프로토타입용 일별 결산 시계열 (2단계: daily_snapshot으로 교체) =====
export const PERF_DAYS: PerfPoint[] = (() => {
  let x = 7;
  const rnd = () => {
    x = (x * 1103515245 + 12345) % 2147483648;
    return x / 2147483648;
  };
  const out: PerfPoint[] = [];
  let invested = 50000000;
  let value = 52000000;
  const d = new Date(2025, 0, 2);
  const end = new Date(2026, 5, 10);
  while (d <= end) {
    if (d.getDate() === 1) {
      const dep = 1200000 + Math.floor(rnd() * 1500000);
      invested += dep;
      value += dep;
    }
    value *= 1 + 0.0014 + (rnd() - 0.5) * 0.016;
    out.push({
      date: new Date(d),
      label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      invested: Math.round(invested),
      value: Math.round(value),
      profit: Math.round(value - invested),
    });
    d.setDate(d.getDate() + 1);
  }
  return out;
})();

function aggLast(keyFn: (d: Date) => string): PerfPoint[] {
  const map = new Map<string, PerfPoint>();
  PERF_DAYS.forEach((p) => map.set(keyFn(p.date), p)); // 각 구간의 마지막 결산값
  return [...map.values()];
}

export type AggUnit = "일별" | "월별" | "분기별" | "년도별";

export const AGG: Record<AggUnit, () => PerfPoint[]> = {
  일별: () => PERF_DAYS,
  월별: () => aggLast((d) => `${d.getFullYear()}-${d.getMonth()}`),
  분기별: () => aggLast((d) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3)}`),
  년도별: () => aggLast((d) => `${d.getFullYear()}`),
};

// ===== 계좌 필터 기준 파생 뷰 =====
export interface PortfolioRow {
  stock: MockStock;
  h: HoldingView;
}

export interface PortfolioView {
  rows: PortfolioRow[];
  cash: number;
  totalValue: number;
  totalPl: number;
  totalPlPct: number;
}

export function buildView(acctSel: string): PortfolioView {
  const rows = STOCKS
    .map((s) => ({ stock: s, h: holdingOf(s, acctSel) }))
    .filter((r): r is PortfolioRow => r.h !== null);
  const cash = cashOf(acctSel);
  const totalValue = rows.reduce((sum, r) => sum + r.h.value, 0) + cash;
  const totalPl = rows.reduce((sum, r) => sum + r.h.pl, 0);
  const totalInvested = rows.reduce((sum, r) => sum + r.h.invested, 0);
  return { rows, cash, totalValue, totalPl, totalPlPct: totalInvested ? (totalPl / totalInvested) * 100 : 0 };
}

export interface TradeRow extends StockTrade {
  stockName: string;
}

// 전체 거래 내역 (계좌 필터 적용, 날짜 내림차순)
export function allTradesOf(acctSel: string): TradeRow[] {
  return STOCKS.flatMap((s) => s.trades.map((t) => ({ ...t, stockName: s.name })))
    .filter((t) => acctSel === "전체" || t.acct === acctSel)
    .sort((a, b) => b.date.localeCompare(a.date));
}

export interface ProfitBar {
  label: string;
  full?: string;
  value: number;
}

// 기간별 수익금 막대 데이터 (구간 수익금 = 누적수익금 증감)
export function profitBars(mode: "년" | "월" | "일"): ProfitBar[] {
  if (mode === "년") {
    const pts = AGG["년도별"]();
    return pts.map((p, i) => ({ label: `${p.date.getFullYear()}년`, value: p.profit - (i ? pts[i - 1].profit : 0) }));
  }
  if (mode === "월") {
    const pts = AGG["월별"]();
    return pts
      .map((p, i) => ({
        label: `${String(p.date.getMonth() + 1)}월`,
        full: `${p.date.getFullYear()}.${p.date.getMonth() + 1}`,
        value: p.profit - (i ? pts[i - 1].profit : 0),
      }))
      .slice(-12);
  }
  // 일: 최근 30일
  return PERF_DAYS.map((p, i) => ({
    label: `${p.date.getDate()}`,
    value: p.profit - (i ? PERF_DAYS[i - 1].profit : 0),
  })).slice(-30);
}
