"use client";
import { C, NUM } from "@/lib/glow-theme";
import { fmtAvg, fmtN, fmtPrice, fmtW, type PortfolioView } from "@/lib/tabletV2Helpers";
import { AcctDropdown, Badge, Segment } from "./ui";

export default function Sidebar({
  open, view, tab, onTab, acctSel, onAcct, selected, onPick, onHome,
}: {
  open: boolean;
  view: PortfolioView;
  tab: string;
  onTab: (t: string) => void;
  acctSel: string;
  onAcct: (a: string) => void;
  selected: string | null;
  onPick: (id: string) => void;
  onHome: () => void;
}) {
  return (
    <aside
      style={{
        width: open ? 375 : 0, flexShrink: 0, overflow: "hidden",
        background: C.bgSidebar, borderRight: open ? `0.5px solid ${C.sep}` : "none",
        transition: "width .34s cubic-bezier(.32,.72,.25,1)",
      }}>
      <div style={{ width: 375, height: "100%", overflowY: "auto", padding: "20px 16px 24px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.026em", cursor: "pointer" }} onClick={onHome}>
            GLOW
          </h1>
          <button style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: C.fill, color: C.sec, fontSize: 18, cursor: "pointer" }}>⋯</button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 7, background: C.search, borderRadius: 10, padding: "8px 10px", marginBottom: 14, color: C.sec, fontSize: 17 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <circle cx="6.8" cy="6.8" r="5.3" stroke="rgba(60,60,67,0.6)" strokeWidth="1.6" />
            <path d="M11 11l3.6 3.6" stroke="rgba(60,60,67,0.6)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          종목 검색
        </div>

        {/* 시세/평가 세그먼트 + 계좌 드롭다운 (분리 배치) */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <Segment compact items={["시세", "평가"]} value={tab} onChange={onTab} />
          <AcctDropdown value={acctSel} onChange={onAcct} />
        </div>

        <div style={{ background: C.card, borderRadius: 10, overflow: "hidden" }}>
          {view.rows.map(({ stock: s, h }, i) => (
            <div key={s.id} onClick={() => onPick(s.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", cursor: "pointer",
                borderTop: i ? `0.5px solid ${C.sep}` : "none",
                background: selected === s.id ? "#E4E4E9" : "transparent",
                transition: "background .15s",
              }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</p>
                <p style={{ ...NUM, margin: "1px 0 0", fontSize: 13, color: C.sec }}>
                  {tab === "시세" ? `평균 ${fmtAvg(s, h.avg)}` : `${fmtN(h.qty)}주 보유`}
                </p>
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <p style={{ ...NUM, margin: 0, fontSize: 17, fontWeight: 600 }}>
                  {tab === "시세" ? fmtPrice(s) : fmtW(h.value)}
                </p>
                <div style={{ marginTop: 3, height: 27, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  {tab === "시세" ? (
                    <Badge pct={s.dayPct} />
                  ) : (
                    <span style={{ ...NUM, fontSize: 12, fontWeight: 600, color: h.pl >= 0 ? C.red : C.blue }}>
                      {h.pl >= 0 ? "+" : ""}{fmtW(h.pl)} ({h.pl >= 0 ? "+" : ""}{h.plPct.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}

          {/* 현금성 자산 — 상세 없음 */}
          {view.cash > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: `0.5px solid ${C.sep}` }}>
              <div style={{ flex: 1 }}>
                <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>현금성 자산</p>
                <p style={{ margin: "1px 0 0", fontSize: 13, color: C.sec }}>예수금</p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ ...NUM, margin: 0, fontSize: 17, fontWeight: 600 }}>{fmtW(view.cash)}</p>
                <div style={{ marginTop: 3, height: 27 }} />
              </div>
            </div>
          )}
        </div>

        <p style={{ margin: "14px 0 0", fontSize: 13, color: C.ter, textAlign: "center" }}>GLOW · KIS 실시간 시세</p>
      </div>
    </aside>
  );
}
