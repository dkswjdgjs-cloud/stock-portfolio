"use client";
import { useState } from "react";
import { C, NUM } from "@/lib/glow-theme";
import { PL_MODES, fmtW, type PortfolioSummary, type PortfolioView } from "@/lib/tabletV2Helpers";
import NewsSection from "./NewsSection";
import type { NewsTarget } from "@/lib/useStockNews";

function todayLabel() {
  const d = new Date();
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${day}요일`;
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
  const [plMode, setPlMode] = useState(0);

  const mode = PL_MODES[plMode];

  // 실시간 delta 반영
  const delta = liveValue - summary.currValue;

  const profits = [
    { amt: summary.cumulativeProfit + delta, pct: summary.totalInvested > 0 ? ((summary.cumulativeProfit + delta) / summary.totalInvested) * 100 : 0 },
    { amt: summary.annualProfit + delta, pct: summary.annualBase > 0 ? ((summary.annualProfit + delta) / summary.annualBase) * 100 : 0 },
    { amt: summary.monthlyProfit + delta, pct: summary.monthlyBase > 0 ? ((summary.monthlyProfit + delta) / summary.monthlyBase) * 100 : 0 },
    { amt: summary.dailyProfit + delta, pct: summary.dailyBase > 0 ? ((summary.dailyProfit + delta) / summary.dailyBase) * 100 : 0 },
  ];
  const plAmt = profits[plMode].amt;
  const plPct = profits[plMode].pct;
  const plCol = plAmt >= 0 ? C.red : C.blue;

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
      <div onClick={() => setPlMode((p) => (p + 1) % PL_MODES.length)}
        style={{ display: "inline-flex", gap: 10, alignItems: "center", margin: "6px 0 22px", cursor: "pointer", userSelect: "none" }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: C.sec, background: C.fill, borderRadius: 6, padding: "3px 8px" }}>
          {mode}수익금
        </span>
        <span style={{ ...NUM, fontSize: 22, fontWeight: 700, color: plCol }}>
          {plAmt >= 0 ? "+" : ""}{fmtW(plAmt)}
        </span>
        <span style={{ ...NUM, fontSize: 17, fontWeight: 600, color: plCol }}>
          ({plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%)
        </span>
        <svg width="11" height="7" viewBox="0 0 12 7" style={{ opacity: 0.4 }}>
          <path d="M1 1l5 5 5-5" stroke="rgba(60,60,67,0.6)" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>

      <NewsSection heldStocks={heldStocks} favStocks={favStocks} onSelectStock={onSelectStock} />
    </main>
  );
}
