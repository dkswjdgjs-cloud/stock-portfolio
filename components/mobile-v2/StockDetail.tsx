"use client";
import { useCallback, useEffect, useState } from "react";
import { C, NUM } from "@/lib/glow-theme";
import { fmtAvg, fmtN, fmtPrice, fmtW, type HoldingView, type MockStock } from "@/lib/tabletV2Helpers";
import { Badge, MiniChart } from "./ui";

interface ChartPoint { date: string; close: number; }
const PERIODS = [
  { label: "1주", range: "1W" }, { label: "1개월", range: "1M" },
  { label: "3개월", range: "3M" }, { label: "6개월", range: "1Y" }, { label: "1년", range: "3Y" },
];

export default function StockDetail({ stock: s, holding, acctSel, totalValue, onBack }: {
  stock: MockStock; holding: HoldingView | null; acctSel: string; totalValue: number; onBack: () => void;
}) {
  const [periodIdx, setPeriodIdx] = useState(1);
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const market = s.currency === "USD" ? "US" : "KR";
  const owned = !!holding;

  const fetchChart = useCallback(async (range: string) => {
    setLoading(true);
    try { const r = await fetch(`/api/stock-chart?ticker=${s.code}&market=${market}&range=${range}`); const d = await r.json(); setChartData(d.chartData || []); }
    catch { setChartData([]); } finally { setLoading(false); }
  }, [s.code, market]);
  useEffect(() => { fetchChart(PERIODS[periodIdx].range); }, [periodIdx, fetchChart]);

  const chartVals = chartData.map(d => ({ value: d.close }));
  const isUp = chartData.length > 1 ? chartData[chartData.length-1].close >= chartData[0].close : true;

  const infoRows: [string, string, string?][] = owned && holding ? [
    ["보유 수량", fmtN(holding.qty) + "주"],
    ["평균 단가", fmtAvg(s, holding.avg)],
    ["평가 금액", fmtW(holding.value)],
    ["평가 손익", (holding.pl >= 0 ? "+" : "") + fmtW(holding.pl), holding.pl >= 0 ? C.red : C.blue],
    ["비중", ((holding.value / totalValue) * 100).toFixed(2) + "%"],
  ] : [
    ["현재가", fmtPrice(s) + (s.currency === "KRW" ? "원" : "")],
    ["등락률", (s.dayPct >= 0 ? "+" : "") + s.dayPct.toFixed(2) + "%", s.dayPct >= 0 ? C.red : C.blue],
    ["섹터", s.sector], ["시장", s.market],
  ];

  return (
    <div style={{ position: "absolute", inset: 0, background: C.bgGrouped, zIndex: 100, overflowY: "auto", WebkitOverflowScrolling: "touch" }}>
      <div style={{ padding: "8px 16px 80px" }}>
        <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: C.blue, fontSize: 17, fontFamily: "inherit", cursor: "pointer", padding: "8px 0" }}>
          <svg width="10" height="18" viewBox="0 0 12 20"><path d="M10 2L3 10l7 8" stroke={C.blue} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>뒤로
        </button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div><h1 style={{ margin: 0, fontSize: 24, fontWeight: 700, color: C.label }}>{s.name}</h1><p style={{ margin: "2px 0 0", fontSize: 13, color: C.sec }}>{s.code} · {s.market}</p></div>
          {owned && holding ? (
            <div style={{ textAlign: "right" }}><p style={{ margin: 0, fontSize: 11, color: C.sec }}>평가수익률</p><p style={{ ...NUM, margin: "2px 0 0", fontSize: 20, fontWeight: 700, color: holding.pl >= 0 ? C.red : C.blue }}>{holding.pl >= 0 ? "+" : ""}{holding.plPct.toFixed(2)}%</p></div>
          ) : <div style={{ textAlign: "right" }}><p style={{ margin: 0, fontSize: 11, color: C.sec }}>관심종목</p><p style={{ ...NUM, margin: "2px 0 0", fontSize: 13, color: C.ter }}>미보유</p></div>}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, margin: "8px 0 14px" }}>
          <span style={{ ...NUM, fontSize: 28, fontWeight: 700, color: C.label }}>{fmtPrice(s)}{s.currency === "KRW" ? "원" : ""}</span>
          <Badge pct={s.dayPct} />
        </div>
        <div style={{ background: C.card, borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
            {PERIODS.map((p, i) => (
              <button key={p.label} onClick={() => setPeriodIdx(i)} style={{ border: `1px solid ${periodIdx === i ? C.blue : C.sep}`, padding: "3px 9px", borderRadius: 6, fontSize: 11, cursor: "pointer", background: periodIdx === i ? C.blue + "15" : "transparent", color: periodIdx === i ? C.blue : C.sec, fontFamily: "inherit" }}>{p.label}</button>
            ))}
          </div>
          {loading ? <div style={{ height: 160, display: "grid", placeItems: "center", color: C.sec, fontSize: 13 }}>차트 로딩 중…</div>
          : chartVals.length > 1 ? <MiniChart data={chartVals} color={isUp ? C.red : C.blue} h={160} />
          : <div style={{ height: 160, display: "grid", placeItems: "center", color: C.sec, fontSize: 13 }}>데이터 없음</div>}
        </div>
        <div style={{ background: C.card, borderRadius: 12, padding: "4px 14px" }}>
          {infoRows.map(([k, v, col], i) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
              <span style={{ fontSize: 14, color: C.sec }}>{k}</span>
              <span style={{ ...NUM, fontSize: 14, fontWeight: 600, color: (col as string) || C.label }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
