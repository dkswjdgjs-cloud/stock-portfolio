// =============================================================
// tablet-v2 stateless 헬퍼 + 타입 + 상수
// 이전 lib/tabletV2Mock.ts에서 데이터 상수(STOCKS/CASH/PERF_DAYS/ACCOUNTS/AGG)를
// 제거하고, 그것들을 인자로 받는 stateless 함수만 남긴 버전.
// 실데이터는 lib/tabletV2Data.ts의 useTabletV2Data() hook에서 공급.
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
  price: number; // KRW 종목: 원화, USD 종목: 달러
  dayPct: number;
  sector: string;
  country: string;
  color: string;
  holdings: Record<string, { qty: number; avg: number }>;
  stats: Record<string, string>;
  trades: StockTrade[];
  exchangeRate?: number; // USD 종목용 실시간 환율 (없으면 FX 폴백)
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

export const FX = 1385; // USD→KRW (1단계 시점 고정값, 추후 실환율 API 연동 가능)

export const ACCT_LIST = ["전체", "ISA", "IRP", "연금저축", "DC형 연금", "일반직투1", "일반직투2"];
export const ACCT_LIST_EX_ALL = ACCT_LIST.filter((a) => a !== "전체");

// 수익금 표시 모드 (프로토타입용 환산 비율 — PerfPage의 실데이터 기반 결산과는 별개)
export const PL_MODES = ["누적", "연", "월", "일"] as const;
export const PL_FACTOR: Record<(typeof PL_MODES)[number], number> = {
  누적: 1, 연: 0.42, 월: 0.075, 일: 0.011,
};

// ===== 포맷터 =====
export const fmtW = (n: number) => "₩" + Math.round(n).toLocaleString("ko-KR");
export const fmtN = (n: number) => n.toLocaleString("ko-KR");
export const fmtPrice = (s: MockStock) => (s.currency === "USD" ? "$" + s.price.toFixed(2) : fmtN(s.price));
export const fmtAvg = (s: MockStock, avg: number) =>
  s.currency === "USD" ? "$" + avg.toFixed(2) : fmtN(Math.round(avg * 100) / 100) + "원";
export const toKRW = (s: MockStock, units: number) =>
  s.currency === "USD" ? units * (s.exchangeRate || FX) : units;

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
  return { qty, avg, value, invested, pl, plPct: invested > 0 ? (pl / invested) * 100 : 0 };
}

export function cashOf(cash: Record<string, number>, acctSel: string): number {
  return acctSel === "전체" ? Object.values(cash).reduce((a, b) => a + b, 0) : cash[acctSel] || 0;
}

// ===== 시드 기반 가짜 주가 시계열 (StockDetail용 — 추후 /api/stock-chart로 교체) =====
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

// ===== 집계 헬퍼 (PerfPoint 배열에서 단위별 마지막값 추출) =====
export type AggUnit = "일별" | "월별" | "분기별" | "년도별";

function aggLast(perfDays: PerfPoint[], keyFn: (d: Date) => string): PerfPoint[] {
  const map = new Map<string, PerfPoint>();
  perfDays.forEach((p) => map.set(keyFn(p.date), p));
  return [...map.values()];
}

export function buildAgg(perfDays: PerfPoint[]): Record<AggUnit, () => PerfPoint[]> {
  return {
    일별: () => perfDays,
    월별: () => aggLast(perfDays, (d) => `${d.getFullYear()}-${d.getMonth()}`),
    분기별: () => aggLast(perfDays, (d) => `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3)}`),
    년도별: () => aggLast(perfDays, (d) => `${d.getFullYear()}`),
  };
}

// ===== 포트폴리오 뷰 (stocks + cash + 계좌 필터 → 통합) =====
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

export function buildView(
  stocks: MockStock[],
  cashByAcct: Record<string, number>,
  acctSel: string,
): PortfolioView {
  const rows = stocks
    .map((s) => ({ stock: s, h: holdingOf(s, acctSel) }))
    .filter((r): r is PortfolioRow => r.h !== null)
    .sort((a, b) => b.h.value - a.h.value); // 평가액 내림차순
  const cash = cashOf(cashByAcct, acctSel);
  const totalValue = rows.reduce((sum, r) => sum + r.h.value, 0) + cash;
  const totalPl = rows.reduce((sum, r) => sum + r.h.pl, 0);
  const totalInvested = rows.reduce((sum, r) => sum + r.h.invested, 0);
  return { rows, cash, totalValue, totalPl, totalPlPct: totalInvested ? (totalPl / totalInvested) * 100 : 0 };
}

// ===== 거래 내역 (전체 종목 합산, 계좌 필터, 날짜 내림차순) =====
export interface TradeRow extends StockTrade {
  stockName: string;
}

export function allTradesOf(stocks: MockStock[], acctSel: string): TradeRow[] {
  return stocks
    .flatMap((s) => s.trades.map((t) => ({ ...t, stockName: s.name })))
    .filter((t) => acctSel === "전체" || t.acct === acctSel)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ===== 기간별 수익금 막대 (구간 수익금 = 누적수익금 증감) =====
export interface ProfitBar {
  label: string;
  full?: string;
  value: number;
}

export function profitBars(
  perfDays: PerfPoint[],
  agg: Record<AggUnit, () => PerfPoint[]>,
  mode: "년" | "월" | "일",
): ProfitBar[] {
  if (mode === "년") {
    const pts = agg["년도별"]();
    return pts.map((p, i) => ({ label: `${p.date.getFullYear()}년`, value: p.profit - (i ? pts[i - 1].profit : 0) }));
  }
  if (mode === "월") {
    const pts = agg["월별"]();
    return pts
      .map((p, i) => ({
        label: `${String(p.date.getMonth() + 1)}월`,
        full: `${p.date.getFullYear()}.${p.date.getMonth() + 1}`,
        value: p.profit - (i ? pts[i - 1].profit : 0),
      }))
      .slice(-12);
  }
  // 일: 최근 30일
  return perfDays
    .map((p, i) => ({ label: `${p.date.getDate()}`, value: p.profit - (i ? perfDays[i - 1].profit : 0) }))
    .slice(-30);
}
