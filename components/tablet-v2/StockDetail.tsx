"use client";
import { useState, type ReactNode } from "react";
import { C, NUM } from "@/lib/glow-theme";
import {
  fmtAvg, fmtN, fmtPrice, fmtW, type HoldingView, type MockStock,
} from "@/lib/tabletV2Helpers";
import { PriceChart } from "./charts";
import { Badge, Segment } from "./ui";

export default function StockDetail({
  stock, holding, acctSel, totalValue, topLeft, onBack,
}: {
  stock: MockStock;
  holding: HoldingView;
  acctSel: string;
  totalValue: number;
  topLeft: ReactNode;
  onBack: () => void;
}) {
  const [period, setPeriod] = useState("1개월");

  const infoRows: [string, string][] = [
    ["보유 수량", fmtN(holding.qty) + "주"],
    ["평균 단가", fmtAvg(stock, holding.avg)],
    ["평가 금액", fmtW(holding.value)],
    ["평가 손익", (holding.pl >= 0 ? "+" : "") + fmtW(holding.pl)],
    ["포트폴리오 비중", ((holding.value / totalValue) * 100).toFixed(2) + "%"],
    ...(stock.stats.PER ? ([["PER", stock.stats.PER], ["PBR", stock.stats.PBR]] as [string, string][]) : []),
  ];

  const trades = stock.trades.filter((t) => acctSel === "전체" || t.acct === acctSel);

  return (
    <main style={{ padding: "20px 28px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        {topLeft}
        <button onClick={onBack}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: C.blue, fontSize: 17, fontFamily: "inherit", cursor: "pointer", padding: "4px 0" }}>
          <svg width="12" height="20" viewBox="0 0 12 20">
            <path d="M10 2L3 10l7 8" stroke={C.blue} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          포트폴리오
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.026em" }}>{stock.name}</h1>
          <p style={{ margin: "3px 0 0", fontSize: 15, color: C.sec }}>
            {stock.code} · {stock.market}{acctSel !== "전체" ? ` · ${acctSel}` : ""}
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p style={{ margin: 0, fontSize: 12, color: C.sec }}>평가수익률</p>
          <p style={{ ...NUM, margin: "2px 0 0", fontSize: 22, fontWeight: 700, color: holding.pl >= 0 ? C.red : C.blue }}>
            {holding.pl >= 0 ? "+" : ""}{holding.plPct.toFixed(2)}%
          </p>
          <p style={{ ...NUM, margin: 0, fontSize: 13, color: C.sec }}>{holding.pl >= 0 ? "+" : ""}{fmtW(holding.pl)}</p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 12, margin: "12px 0 18px" }}>
        <span style={{ ...NUM, fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em" }}>
          {fmtPrice(stock)}{stock.currency === "KRW" ? "원" : ""}
        </span>
        <Badge pct={stock.dayPct} size={17} />
      </div>

      <div style={{ background: C.card, borderRadius: 16, padding: 22, marginBottom: 26 }}>
        <div style={{ marginBottom: 14 }}>
          <Segment compact items={["1주", "1개월", "3개월", "6개월", "1년"]} value={period} onChange={setPeriod} />
        </div>
        <PriceChart stock={stock} period={period} trendPct={holding.plPct} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16, background: C.fill, borderRadius: 10, padding: "12px 16px" }}>
          {["시가", "고가", "저가", "거래량"].map((k) => (
            <div key={k}>
              <p style={{ margin: 0, fontSize: 12, color: C.sec }}>{k}</p>
              <p style={{ ...NUM, margin: "2px 0 0", fontSize: 15, fontWeight: 600 }}>{stock.stats[k] || "—"}</p>
            </div>
          ))}
        </div>
      </div>

      <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>종목 정보{acctSel !== "전체" ? ` · ${acctSel}` : ""}</h2>
      <div style={{ background: C.card, borderRadius: 16, padding: "4px 22px", marginBottom: 26 }}>
        {infoRows.map(([k, v], i) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
            <span style={{ fontSize: 15, color: C.sec }}>{k}</span>
            <span style={{ ...NUM, fontSize: 15, fontWeight: 600, color: k === "평가 손익" ? (holding.pl >= 0 ? C.red : C.blue) : C.label }}>{v}</span>
          </div>
        ))}
      </div>

      <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>거래 내역</h2>
      <div style={{ background: C.card, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 64px 70px 110px", gap: 8, padding: "10px 22px", background: C.fill }}>
          {["날짜", "계좌", "구분", "수량", "단가"].map((h) => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: C.sec, textAlign: h === "수량" || h === "단가" ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        {trades.map((t, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 64px 70px 110px", gap: 8, alignItems: "center", padding: "12px 22px", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
            <span style={{ ...NUM, fontSize: 14 }}>{t.date}</span>
            <span style={{ fontSize: 14 }}>{t.acct}</span>
            <span style={{ fontSize: 12, fontWeight: 600, textAlign: "center", padding: "2px 0", borderRadius: 5, color: t.type === "매수" ? C.red : C.blue, background: t.type === "매수" ? "rgba(255,59,48,0.10)" : "rgba(0,122,255,0.10)" }}>{t.type}</span>
            <span style={{ ...NUM, fontSize: 14, textAlign: "right" }}>{t.qty}주</span>
            <span style={{ ...NUM, fontSize: 14, textAlign: "right" }}>{t.unit}</span>
          </div>
        ))}
      </div>
    </main>
  );
}
