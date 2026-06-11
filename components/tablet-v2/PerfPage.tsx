"use client";
import { useMemo, useState, type ReactNode } from "react";
import { C, NUM } from "@/lib/glow-theme";
import { AGG, PERF_DAYS, fmtW, profitBars, type AggUnit, type PerfPoint } from "@/lib/tabletV2Mock";
import { PerfLineChart, ProfitBarChart } from "./charts";
import { Segment } from "./ui";

type PerfMode = "누적" | "년" | "월" | "일";

interface TableRow extends PerfPoint {
  delta: number;
}

export default function PerfPage({ topLeft }: { topLeft: ReactNode }) {
  const [mode, setMode] = useState<PerfMode>("누적"); // 누적 | 년 | 월 | 일
  const [agg, setAgg] = useState<AggUnit>("일별"); // 일별 | 월별 | 분기별 | 년도별 (누적 전용)

  const linePts = mode === "누적" ? AGG[agg]() : null;
  const bars = mode !== "누적" ? profitBars(mode) : null;

  // 결산 내역 단위 = 그래프 설정과 연동
  const unit =
    mode === "누적"
      ? ({ 일별: "일", 월별: "월", 분기별: "분기", 년도별: "년" } as const)[agg]
      : mode === "년" ? "년" : mode === "월" ? "월" : "일";

  const tableRows = useMemo<TableRow[]>(() => {
    const full =
      unit === "일" ? AGG["일별"]() : unit === "월" ? AGG["월별"]() : unit === "분기" ? AGG["분기별"]() : AGG["년도별"]();
    const withDelta = full.map((p, i) => ({ ...p, delta: p.profit - (i ? full[i - 1].profit : 0) }));
    const sliced = unit === "일" ? withDelta.slice(-120) : withDelta;
    return [...sliced].reverse();
  }, [unit]);

  const fmtRowDate = (p: TableRow) =>
    unit === "년" ? p.date.getFullYear() + "년"
    : unit === "분기" ? `${p.date.getFullYear()} Q${Math.floor(p.date.getMonth() / 3) + 1}`
    : unit === "월" ? p.label.slice(0, 7)
    : p.label;

  const last = PERF_DAYS[PERF_DAYS.length - 1];

  return (
    <main style={{ padding: "20px 28px 40px" }}>
      <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 4 }}>{topLeft}</div>
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.026em" }}>성과 추이</h1>
      <p style={{ margin: "3px 0 0", fontSize: 15, color: C.sec }}>
        {last.label} 기준 · 평가액 {fmtW(last.value)} · 누적수익{" "}
        <span style={{ color: C.red, fontWeight: 600 }}>+{fmtW(last.profit)}</span>
      </p>

      {/* ===== 상단: 성과 추이 그래프 ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 10px" }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          {mode === "누적" ? `누적 추이 · ${agg}` : `${mode}별 수익금`}
        </h2>
        <div style={{ display: "flex", gap: 10 }}>
          <Segment compact items={["누적", "년", "월", "일"]} value={mode} onChange={(m) => setMode(m as PerfMode)} />
          {mode === "누적" && (
            <Segment compact items={["일별", "월별", "분기별", "년도별"]} value={agg} onChange={(a) => setAgg(a as AggUnit)} />
          )}
        </div>
      </div>
      <div style={{ background: C.card, borderRadius: 16, padding: 22, marginBottom: 26 }}>
        {linePts ? <PerfLineChart points={linePts} /> : bars ? <ProfitBarChart bars={bars} /> : null}
      </div>

      {/* ===== 하단: 결산 내역 (그래프 단위와 연동) ===== */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>결산 내역</h2>
        <span style={{ fontSize: 13, fontWeight: 600, color: C.sec, background: C.fill, borderRadius: 6, padding: "3px 9px" }}>{unit}별</span>
      </div>
      <div style={{ background: C.card, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "96px 1fr 1fr 1fr 1fr", gap: 8, padding: "10px 22px", background: C.fill }}>
          {["날짜", "평가액", "누적투자금", "누적수익금", `${unit} 수익금`].map((h, i) => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: C.sec, textAlign: i ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        <div style={{ height: 430, overflowY: "auto" }}>
          {tableRows.map((r, i) => (
            <div key={r.label} style={{ display: "grid", gridTemplateColumns: "96px 1fr 1fr 1fr 1fr", gap: 8, alignItems: "center", padding: "11px 22px", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
              <span style={{ ...NUM, fontSize: 13 }}>{fmtRowDate(r)}</span>
              <span style={{ ...NUM, fontSize: 13, textAlign: "right", fontWeight: 600 }}>{fmtW(r.value)}</span>
              <span style={{ ...NUM, fontSize: 13, textAlign: "right", color: C.sec }}>{fmtW(r.invested)}</span>
              <span style={{ ...NUM, fontSize: 13, textAlign: "right", fontWeight: 600, color: r.profit >= 0 ? C.red : C.blue }}>
                {r.profit >= 0 ? "+" : ""}{fmtW(r.profit)}
              </span>
              <span style={{ ...NUM, fontSize: 13, textAlign: "right", fontWeight: 600, color: r.delta >= 0 ? C.red : C.blue }}>
                {r.delta >= 0 ? "+" : ""}{fmtW(r.delta)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
