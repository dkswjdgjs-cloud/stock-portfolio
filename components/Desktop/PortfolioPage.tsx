"use client";
import { C, NUM } from "@/lib/glow-theme";
import { fmtW, type PortfolioSummary, type PortfolioView } from "@/lib/tabletV2Helpers";
import NewsSection from "./NewsSection";
import type { NewsTarget } from "@/lib/useStockNews";

function todayLabel() {
  const d = new Date();
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${day}요일`;
}

function ProfitRow({ label, amt, pct }: { label: string; amt: number; pct: number }) {
  const col = amt >= 0 ? C.red : C.blue;
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0", borderTop: `0.5px solid ${C.sep}` }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: C.sec }}>{label}</span>
      <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
        <span style={{ ...NUM, fontSize: 15, fontWeight: 700, color: col }}>
          {amt >= 0 ? "+" : ""}{fmtW(amt)}
        </span>
        <span style={{ ...NUM, fontSize: 13, fontWeight: 600, color: col, minWidth: 72, textAlign: "right" }}>
          ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
        </span>
      </div>
    </div>
  );
}

export default function PortfolioPage({
  view, acctSel, summary, liveValue, heldStocks, favStocks, onSelectStock,
}: {
  view: PortfolioView;
  acctSel: string;
  summary: PortfolioSummary;
  liveValue: number;
  heldStocks: NewsTarget[];
  favStocks: NewsTarget[];
  onSelectStock: (id: string) => void;
}) {
  // 실시간 가격 반영: summary는 데이터 로드 시점 기준, liveValue는 현재 실시간 평가액
  const delta = liveValue - summary.currValue;

  const liveProfit = summary.cumulativeProfit + delta;
  const liveReturn = summary.totalInvested > 0 ? (liveProfit / summary.totalInvested) * 100 : 0;

  const liveAnnual = summary.annualProfit + delta;
  const liveAnnualReturn = summary.annualBase > 0 ? (liveAnnual / summary.annualBase) * 100 : 0;

  const liveMonthly = summary.monthlyProfit + delta;
  const liveMonthlyReturn = summary.monthlyBase > 0 ? (liveMonthly / summary.monthlyBase) * 100 : 0;

  const liveDaily = summary.dailyProfit + delta;
  const liveDailyReturn = summary.dailyBase > 0 ? (liveDaily / summary.dailyBase) * 100 : 0;

  return (
    <main style={{ height: "100%", overflowY: "auto", padding: "20px 28px 40px", boxSizing: "border-box" }}>
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.026em" }}>
        포트폴리오{acctSel !== "전체" ? ` · ${acctSel}` : ""}
      </h1>
      <p style={{ margin: "3px 0 0", fontSize: 15, color: C.sec }}>
        <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: C.green, marginRight: 5, verticalAlign: 1 }} />
        실시간 · {todayLabel()}
      </p>

      <p style={{ ...NUM, margin: "14px 0 0", fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em" }}>{fmtW(liveValue)}</p>

      <div style={{ margin: "10px 0 22px", background: C.card, borderRadius: 12, padding: "0 14px" }}>
        <ProfitRow label="누적수익" amt={liveProfit} pct={liveReturn} />
        <ProfitRow label="연수익" amt={liveAnnual} pct={liveAnnualReturn} />
        <ProfitRow label="월수익" amt={liveMonthly} pct={liveMonthlyReturn} />
        <ProfitRow label="일수익" amt={liveDaily} pct={liveDailyReturn} />
      </div>

      <NewsSection heldStocks={heldStocks} favStocks={favStocks} onSelectStock={onSelectStock} />
    </main>
  );
}
