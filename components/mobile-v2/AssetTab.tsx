"use client";
import { useState } from "react";
import { C, FONT, NUM } from "@/lib/glow-theme";
import { fmtW, type AcctPerf, type MockStock, type PortfolioView } from "@/lib/tabletV2Helpers";
import { AssetBars } from "./ui";

const FILTERS = ["종목별", "계좌별", "국가별", "섹터별"];
const ACCT_COLORS = ["#5856D6", "#30B0C7", "#007AFF", "#AF52DE", "#00C7BE", "#5AC8FA"];
const SECTOR_COLORS: Record<string, string> = { "반도체": "#5856D6", "지수": "#007AFF", "채권혼합": "#00C7BE", "현금": "#34C759", "2차전지": "#AF52DE", "IT": "#5AC8FA" };

export default function AssetTab({ view, stocks, accounts, acctSel }: {
  view: PortfolioView; stocks: MockStock[]; accounts: AcctPerf[]; acctSel: string;
}) {
  const [filter, setFilter] = useState("종목별");
  const [dropOpen, setDropOpen] = useState(false);

  const getItems = () => {
    if (filter === "종목별") {
      return [...view.rows.map(r => ({ id: r.stock.id, label: r.stock.name, value: r.h.value, color: r.stock.color })),
        ...(view.cash ? [{ id: "CASH", label: "현금성 자산", value: view.cash, color: C.green }] : [])];
    }
    if (filter === "계좌별") {
      return accounts.map((a, i) => ({ id: a.name, label: a.name, value: Number(a.val.replace(/[^\d-]/g, "")), color: ACCT_COLORS[i % ACCT_COLORS.length] }));
    }
    if (filter === "국가별") {
      const kr = view.rows.filter(r => r.stock.currency === "KRW").reduce((s, r) => s + r.h.value, 0) + view.cash;
      const us = view.rows.filter(r => r.stock.currency === "USD").reduce((s, r) => s + r.h.value, 0);
      return [{ id: "KR", label: "국내", value: kr, color: "#007AFF" }, ...(us > 0 ? [{ id: "US", label: "해외", value: us, color: "#AF52DE" }] : [])];
    }
    const map: Record<string, number> = {};
    view.rows.forEach(r => { map[r.stock.sector] = (map[r.stock.sector] || 0) + r.h.value; });
    if (view.cash) map["현금"] = view.cash;
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ id: k, label: k, value: v, color: SECTOR_COLORS[k] || "#5AC8FA" }));
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 16px 20px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 0 10px" }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: C.label }}>자산 배분</h1>
        <div style={{ position: "relative" }}>
          <button onClick={() => setDropOpen(o => !o)}
            style={{ display: "flex", alignItems: "center", gap: 4, border: "none", background: C.fill, borderRadius: 8, padding: "5px 12px", fontSize: 13, fontWeight: 600, color: C.blue, cursor: "pointer", fontFamily: FONT }}>
            {filter}
            <svg width="8" height="5" viewBox="0 0 10 6" style={{ transform: dropOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }}><path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.6" fill="none" strokeLinecap="round" /></svg>
          </button>
          {dropOpen && (<>
            <div onClick={() => setDropOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
            <div style={{ position: "absolute", top: "calc(100% + 4px)", right: 0, zIndex: 50, minWidth: 120, background: C.card, borderRadius: 12, padding: "4px 0", boxShadow: "0 8px 30px rgba(0,0,0,0.18)" }}>
              {FILTERS.map((fl, i) => (
                <div key={fl} onClick={() => { setFilter(fl); setDropOpen(false); }}
                  style={{ padding: "10px 14px", fontSize: 14, cursor: "pointer", borderTop: i ? `0.5px solid ${C.sep}` : "none", color: C.label, fontWeight: filter === fl ? 600 : 400 }}>{fl}</div>
              ))}
            </div>
          </>)}
        </div>
      </div>

      <div style={{ background: C.card, borderRadius: 12, padding: "14px 14px 10px", marginBottom: 20 }}>
        <AssetBars items={getItems()} />
      </div>

      <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700, color: C.label }}>계좌별 성과</h2>
      <div style={{ background: C.card, borderRadius: 12, padding: "4px 14px", marginBottom: 80 }}>
        {accounts.length === 0 ? (
          <p style={{ padding: "20px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>계좌 데이터가 없습니다.</p>
        ) : accounts.map((a, i) => {
          const col = a.pct >= 0 ? C.red : C.blue;
          return (
            <div key={a.name} style={{ padding: "11px 0", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 15, fontWeight: 600, color: C.label }}>{a.name}</span>
                <span style={{ ...NUM, fontSize: 15, fontWeight: 700, color: col }}>{a.pct >= 0 ? "+" : ""}{a.pct.toFixed(2)}%</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                <span style={{ ...NUM, fontSize: 12, color: C.sec }}>투입 {a.inv}</span>
                <span style={{ ...NUM, fontSize: 12, fontWeight: 600, color: col }}>{a.gain}</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: C.fill, margin: "6px 0 0", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${Math.min(Math.abs(a.pct) / 5, 100)}%`, borderRadius: 2, background: col }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
