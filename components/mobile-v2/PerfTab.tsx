"use client";
import { useMemo, useState } from "react";
import { C, NUM } from "@/lib/glow-theme";
import { fmtW, type AggUnit, type PerfPoint } from "@/lib/tabletV2Helpers";
import { MiniChart } from "./ui";

export default function PerfTab({ perfDays, agg }: { perfDays: PerfPoint[]; agg: Record<AggUnit, () => PerfPoint[]> }) {
  const [aggSel, setAggSel] = useState<AggUnit>("일별");
  const last = perfDays.length > 0 ? perfDays[perfDays.length - 1] : null;
  const chartData = useMemo(() => agg[aggSel]().map(p => ({ value: p.value })), [aggSel, agg]);

  const tableRows = useMemo(() => {
    const unit = ({ "일별": "일별", "월별": "월별", "분기별": "분기별", "년도별": "년도별" } as const)[aggSel];
    const full = agg[unit]();
    const withDelta = full.map((p, i) => ({ ...p, delta: p.profit - (i ? full[i - 1].profit : 0) }));
    return [...(aggSel === "일별" ? withDelta.slice(-60) : withDelta)].reverse();
  }, [aggSel, agg]);

  return (
    <div style={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 16px 20px" }}>
      <div style={{ padding: "14px 0 4px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.label }}>성과 추이</h1>
        {last && <p style={{ margin: "3px 0 0", fontSize: 13, color: C.sec }}>누적수익 <span style={{ color: last.profit >= 0 ? C.red : C.blue, fontWeight: 600 }}>{last.profit >= 0 ? "+" : ""}{fmtW(last.profit)}</span></p>}
      </div>

      {perfDays.length > 0 && (
        <div style={{ background: C.card, borderRadius: 12, padding: 14, margin: "8px 0 16px" }}>
          <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
            {(["일별", "월별", "분기별", "년도별"] as AggUnit[]).map(m => (
              <button key={m} onClick={() => setAggSel(m)}
                style={{ border: `1px solid ${aggSel === m ? C.blue : C.sep}`, padding: "3px 10px", borderRadius: 6, fontSize: 12, cursor: "pointer", background: aggSel === m ? C.blue + "15" : "transparent", color: aggSel === m ? C.blue : C.sec, fontFamily: "inherit" }}>{m.replace("별","")}</button>
            ))}
          </div>
          {chartData.length > 1 && <MiniChart data={chartData} color={C.blue} h={160} />}
          {last && (
            <div style={{ display: "flex", justifyContent: "space-around", marginTop: 10, padding: "8px 0 0", borderTop: `0.5px solid ${C.sep}` }}>
              {[["평가액", last.value, C.label], ["투자금", last.invested, C.sec], ["수익금", last.profit, C.red]].map(([l, v, c]) => (
                <div key={l as string} style={{ textAlign: "center" }}>
                  <p style={{ margin: 0, fontSize: 11, color: C.sec }}>{l as string}</p>
                  <p style={{ ...NUM, margin: "2px 0 0", fontSize: 14, fontWeight: 600, color: c as string }}>{fmtW(v as number)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h2 style={{ fontSize: 17, fontWeight: 700, color: C.label, margin: "0 0 8px" }}>결산 내역</h2>
      <div style={{ background: C.card, borderRadius: 12, overflow: "hidden", marginBottom: 80 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "8px 14px", borderBottom: `0.5px solid ${C.sep}` }}>
          {["날짜", "평가액", "수익금"].map(h => (
            <span key={h} style={{ fontSize: 11, fontWeight: 600, color: C.sec, textAlign: h === "날짜" ? "left" : "right" }}>{h}</span>
          ))}
        </div>
        {tableRows.length === 0 ? (
          <p style={{ padding: "20px 14px", fontSize: 14, color: C.sec, textAlign: "center" }}>결산 데이터가 없습니다.</p>
        ) : tableRows.map((r, i) => (
          <div key={r.label} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", padding: "10px 14px", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
            <span style={{ ...NUM, fontSize: 13, color: C.label }}>{r.label}</span>
            <span style={{ ...NUM, fontSize: 13, textAlign: "right", color: C.label }}>{fmtW(r.value)}</span>
            <span style={{ ...NUM, fontSize: 13, textAlign: "right", fontWeight: 600, color: r.profit >= 0 ? C.red : C.blue }}>{r.profit >= 0 ? "+" : ""}{fmtW(r.profit)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
