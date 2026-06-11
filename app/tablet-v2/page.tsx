"use client";
import { useMemo, useRef, useState } from "react";
import "./glow-tokens.css";
import { C, FONT } from "@/lib/glow-theme";
import { buildView, holdingOf } from "@/lib/tabletV2Helpers";
import { useTabletV2Data } from "@/lib/tabletV2Data";
import Sidebar from "@/components/tablet-v2/Sidebar";
import PortfolioPage from "@/components/tablet-v2/PortfolioPage";
import PerfPage from "@/components/tablet-v2/PerfPage";
import StockDetail from "@/components/tablet-v2/StockDetail";
import { SidebarToggle } from "@/components/tablet-v2/ui";

interface DragState {
  x: number;
  y: number;
  active: boolean;
  captured: boolean;
  id: number;
  el: HTMLDivElement;
}

export default function TabletV2Page() {
  const [tab, setTab] = useState("시세"); // 시세 | 평가
  const [acctSel, setAcctSel] = useState("전체"); // 계좌 필터
  const [selected, setSelected] = useState<string | null>(null); // 선택 종목
  const [page, setPage] = useState(0); // 0 포트폴리오 | 1 성과 추이
  const [drag, setDrag] = useState(0);
  const dragRef = useRef<DragState | null>(null);
  const [sbOpen, setSbOpen] = useState(true);

  // ===== 실데이터 fetch =====
  const { stocks, cash, perfDays, agg, accounts, loading, error, refresh } = useTabletV2Data();

  // ===== 계좌 필터 기준 파생 데이터 =====
  const view = useMemo(() => buildView(stocks, cash, acctSel), [stocks, cash, acctSel]);

  const sel = selected ? stocks.find((s) => s.id === selected) ?? null : null;
  const selH = sel ? holdingOf(sel, acctSel) : null;

  const pick = (id: string) => {
    if (id === "CASH") return;
    setSelected((prev) => (prev === id ? null : id));
  };

  const sbBtn = <SidebarToggle open={sbOpen} onToggle={() => setSbOpen((o) => !o)} />;

  // ===== 초기 로딩 / 에러 화면 =====
  if (loading && stocks.length === 0) {
    return (
      <div className="glow-v2" style={{ height: "100dvh", display: "grid", placeItems: "center", fontFamily: FONT, background: C.bgGrouped, color: C.sec, letterSpacing: "-0.022em" }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.label, marginBottom: 8 }}>GLOW</div>
          <div style={{ fontSize: 14 }}>실시간 시세 불러오는 중…</div>
        </div>
      </div>
    );
  }

  if (error && stocks.length === 0) {
    return (
      <div className="glow-v2" style={{ height: "100dvh", display: "grid", placeItems: "center", fontFamily: FONT, background: C.bgGrouped, color: C.sec, letterSpacing: "-0.022em", padding: 24 }}>
        <div style={{ textAlign: "center", maxWidth: 360 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.red, marginBottom: 8 }}>데이터 로드 실패</div>
          <div style={{ fontSize: 14, marginBottom: 20 }}>{error}</div>
          <button onClick={refresh}
            style={{ background: C.blue, color: "white", border: "none", borderRadius: 10, padding: "10px 22px", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="glow-v2"
      style={{
        height: "100dvh", display: "flex", overflow: "hidden",
        fontFamily: FONT, background: C.bgGrouped, color: C.label,
        letterSpacing: "-0.022em",
      }}>
      <Sidebar
        open={sbOpen}
        view={view}
        tab={tab}
        onTab={setTab}
        acctSel={acctSel}
        onAcct={(a) => { setAcctSel(a); setSelected(null); }}
        selected={selected}
        onPick={pick}
        onHome={() => setSelected(null)}
      />

      {sel && selH ? (
        <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto" }}>
          <StockDetail
            key={sel.id}
            stock={sel}
            holding={selH}
            acctSel={acctSel}
            totalValue={view.totalValue}
            topLeft={sbBtn}
            onBack={() => setSelected(null)}
          />
        </div>
      ) : (
        <div
          style={{ position: "relative", overflow: "hidden", flex: 1, minWidth: 0, height: "100%" }}
          onPointerDown={(e) => {
            dragRef.current = { x: e.clientX, y: e.clientY, active: true, captured: false, id: e.pointerId, el: e.currentTarget };
          }}
          onPointerMove={(e) => {
            const d = dragRef.current;
            if (!d?.active) return;
            const dx = e.clientX - d.x;
            const dy = e.clientY - d.y;
            if (!d.captured && Math.abs(dx) > 14 && Math.abs(dx) > Math.abs(dy)) {
              d.captured = true;
              try { d.el.setPointerCapture(d.id); } catch {}
            }
            if (d.captured) setDrag(Math.max(-200, Math.min(200, dx)));
          }}
          onPointerUp={() => {
            if (drag < -70 && page === 0) setPage(1);
            else if (drag > 70 && page === 1) setPage(0);
            setDrag(0);
            dragRef.current = null;
          }}
          onPointerCancel={() => { setDrag(0); dragRef.current = null; }}
        >
          <div style={{ position: "absolute", top: 14, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 7, zIndex: 30 }}>
            {[0, 1].map((p) => (
              <span key={p} onClick={() => setPage(p)}
                style={{
                  width: 7, height: 7, borderRadius: "50%", cursor: "pointer",
                  background: page === p ? "rgba(60,60,67,0.65)" : "rgba(60,60,67,0.22)",
                  transition: "background .2s",
                }} />
            ))}
          </div>

          <div
            style={{
              display: "flex", width: "200%", height: "100%",
              transform: `translateX(calc(${page * -50}% + ${drag}px))`,
              transition: drag !== 0 ? "none" : "transform .38s cubic-bezier(.32,.72,.25,1)",
              touchAction: "pan-y",
            }}>
            <div style={{ width: "50%", flexShrink: 0, height: "100%", position: "relative", overflow: "hidden" }}>
              <PortfolioPage
                view={view}
                acctSel={acctSel}
                sbOpen={sbOpen}
                topLeft={sbBtn}
                stocks={stocks}
                accounts={accounts}
                onRefresh={refresh}
                refreshing={loading}
              />
            </div>
            <div style={{ width: "50%", flexShrink: 0, height: "100%", overflowY: "auto" }}>
              <PerfPage
                topLeft={sbBtn}
                perfDays={perfDays}
                agg={agg}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
