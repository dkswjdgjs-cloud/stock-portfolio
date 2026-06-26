"use client";
import { useMemo, useState, type ReactNode } from "react";
import { C, NUM } from "@/lib/glow-theme";
import { fmtW, profitBars, type AggUnit, type PerfPoint } from "@/lib/tabletV2Helpers";
import { PerfLineChart, ProfitBarChart } from "./charts";
import { Segment } from "./ui";

type PerfMode = "누적" | "년" | "월" | "일";

interface TableRow extends PerfPoint {
  delta: number;
}

const todayStr = () => new Date().toISOString().slice(0, 10);

const INPUT_STYLE: React.CSSProperties = {
  width: "100%", padding: "10px 12px", fontSize: 15, borderRadius: 10,
  border: `1px solid ${C.sep}`, background: C.fill, color: C.sec,
  boxSizing: "border-box", outline: "none",
};

export default function PerfPage({
  topLeft, perfDays, agg, totalInvested, onRefresh,
}: {
  topLeft: ReactNode;
  perfDays: PerfPoint[];
  agg: Record<AggUnit, () => PerfPoint[]>;
  totalInvested?: number;
  onRefresh?: () => void;
}) {
  const [mode, setMode] = useState<PerfMode>("누적");
  const [aggSel, setAggSel] = useState<AggUnit>("일별");
  const [showSave, setShowSave] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveForm, setSaveForm] = useState({ date: todayStr(), valuation: "", totalInvested: "", cumulativeProfit: "" });

  const linePts = mode === "누적" ? agg[aggSel]() : null;
  const bars = mode !== "누적" ? profitBars(perfDays, agg, mode as "년" | "월" | "일") : null;

  const unit =
    mode === "누적"
      ? ({ 일별: "일", 월별: "월", 분기별: "분기", 년도별: "년" } as const)[aggSel]
      : mode === "년" ? "년" : mode === "월" ? "월" : "일";

  const tableRows = useMemo<TableRow[]>(() => {
    const full =
      unit === "일" ? agg["일별"]()
      : unit === "월" ? agg["월별"]()
      : unit === "분기" ? agg["분기별"]()
      : agg["년도별"]();
    const withDelta = full.map((p, i) => ({ ...p, delta: p.profit - (i ? full[i - 1].profit : 0) }));
    const sliced = withDelta;
    return [...sliced].reverse();
  }, [unit, agg]);

  const fmtRowDate = (p: TableRow) =>
    unit === "년" ? p.date.getFullYear() + "년"
    : unit === "분기" ? `${p.date.getFullYear()} Q${Math.floor(p.date.getMonth() / 3) + 1}`
    : unit === "월" ? p.label.slice(0, 7)
    : p.label;

  const last = perfDays.length > 0 ? perfDays[perfDays.length - 1] : null;
  const isEmpty = perfDays.length === 0;

  const openSave = () => {
    setSaveForm({ date: todayStr(), valuation: "", totalInvested: totalInvested ? String(Math.round(totalInvested)) : "", cumulativeProfit: "" });
    setShowSave(true);
  };

  const handleSave = async () => {
    const { date, valuation, totalInvested, cumulativeProfit } = saveForm;
    if (!date || !valuation || !totalInvested || !cumulativeProfit) return;
    setSaving(true);
    try {
      await fetch("/api/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([{ date, valuation: Number(valuation.replace(/,/g, "")), totalInvested: Number(totalInvested.replace(/,/g, "")), cumulativeProfit: Number(cumulativeProfit.replace(/,/g, "")) }]),
      });
      setShowSave(false);
      onRefresh?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <main style={{ padding: "20px 28px 40px" }}>
      <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.026em" }}>성과 추이</h1>
      {last ? (
        <p style={{ margin: "3px 0 0", fontSize: 15, color: C.sec }}>
          {last.label} 기준 · 평가액 {fmtW(last.value)} · 누적수익{" "}
          <span style={{ color: last.profit >= 0 ? C.red : C.blue, fontWeight: 600 }}>
            {last.profit >= 0 ? "+" : ""}{fmtW(last.profit)}
          </span>
        </p>
      ) : (
        <p style={{ margin: "3px 0 0", fontSize: 15, color: C.sec }}>스냅샷 데이터가 아직 없습니다.</p>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "20px 0 10px" }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>
          {mode === "누적" ? `누적 추이 · ${aggSel}` : `${mode}별 수익금`}
        </h2>
        <div style={{ display: "flex", gap: 10 }}>
          <Segment compact items={["누적", "년", "월", "일"]} value={mode} onChange={(m) => setMode(m as PerfMode)} />
          {mode === "누적" && (
            <Segment compact items={["일별", "월별", "분기별", "년도별"]} value={aggSel} onChange={(a) => setAggSel(a as AggUnit)} />
          )}
        </div>
      </div>
      <div style={{ background: C.card, borderRadius: 16, padding: 22, marginBottom: 26, minHeight: 280 }}>
        {isEmpty ? (
          <div style={{ height: 280, display: "grid", placeItems: "center", color: C.sec, fontSize: 14 }}>
            성과 추이 데이터가 아직 없습니다.
          </div>
        ) : linePts ? (
          <PerfLineChart points={linePts} />
        ) : bars ? (
          <ProfitBarChart bars={bars} />
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>결산 내역</h2>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button onClick={openSave} style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: C.blue, borderRadius: 8, padding: "5px 13px", border: "none", cursor: "pointer" }}>
            평가액 저장
          </button>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.sec, background: C.fill, borderRadius: 6, padding: "3px 9px" }}>{unit}별</span>
        </div>
      </div>
      <div style={{ background: C.card, borderRadius: 16, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "96px 1fr 1fr 1fr 1fr", gap: 8, padding: "10px 22px", background: C.fill }}>
          {["날짜", "평가액", "누적투자금", "누적수익금", `${unit} 수익금`].map((h, i) => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: C.sec, textAlign: i ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        <div style={{ height: 430, overflowY: "auto" }}>
          {tableRows.length === 0 ? (
            <p style={{ padding: "30px 22px", fontSize: 14, color: C.sec, textAlign: "center" }}>결산 데이터가 없습니다.</p>
          ) : (
            tableRows.map((r, i) => (
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
            ))
          )}
        </div>
      </div>
      {/* 평가액 저장 모달 */}
      {showSave && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowSave(false); }}>
          <div style={{ background: C.card, borderRadius: 20, padding: 28, width: 360, boxShadow: "0 8px 40px rgba(0,0,0,0.18)" }}>
            <h3 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>오늘 결산 저장</h3>
            {[
              { label: "날짜", key: "date", type: "date" },
              { label: "평가액 (원)", key: "valuation", type: "text", placeholder: "예: 160000000" },
              { label: "누적 투자금 (원)", key: "totalInvested", type: "text", placeholder: "예: 66864737" },
              { label: "누적 수익금 (원)", key: "cumulativeProfit", type: "text", placeholder: "예: 93299536" },
            ].map(({ label, key, type, placeholder }) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.sec, marginBottom: 5 }}>{label}</div>
                <input
                  type={type}
                  value={saveForm[key as keyof typeof saveForm]}
                  placeholder={placeholder}
                  onChange={(e) => setSaveForm((f) => ({ ...f, [key]: e.target.value }))}
                  style={INPUT_STYLE}
                />
              </div>
            ))}
            <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
              <button onClick={() => setShowSave(false)}
                style={{ flex: 1, padding: "12px 0", borderRadius: 10, border: "none", background: C.fill, color: C.sec, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ flex: 2, padding: "12px 0", borderRadius: 10, border: "none", background: C.blue, color: "#fff", fontSize: 15, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.7 : 1 }}>
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
