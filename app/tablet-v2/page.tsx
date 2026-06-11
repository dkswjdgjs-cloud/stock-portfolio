"use client";
import { useMemo, useRef, useState } from "react";
import "./glow-tokens.css";
import { C, FONT } from "@/lib/glow-theme";
import { STOCKS, buildView, holdingOf } from "@/lib/tabletV2Mock";
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
  const [sbOpen, setSbOpen] = useState(true); // 사이드바 보임/숨김

  // ===== 계좌 필터 기준 파생 데이터 =====
  const view = useMemo(() => buildView(acctSel), [acctSel]);

  const sel = selected ? STOCKS.find((s) => s.id === selected) ?? null : null;
  const selH = sel ? holdingOf(sel, acctSel) : null;

  // 종목 클릭: 같은 종목 다시 클릭하면 초기 화면 복귀, 현금은 상세 없음
  const pick = (id: string) => {
    if (id === "CASH") return;
    setSelected((prev) => (prev === id ? null : id));
  };

  const sbBtn = <SidebarToggle open={sbOpen} onToggle={() => setSbOpen((o) => !o)} />;

  return (
    <div
      className="glow-v2"
      style={{
        height: "100dvh", display: "flex", overflow: "hidden",
        fontFamily: FONT, background: C.bgGrouped, color: C.label,
        letterSpacing: "-0.022em",
      }}>
      {/* ===== 사이드바 (고정 + 독립 스크롤 + 토글 슬라이드) ===== */}
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

      {/* ===== 디테일 패널: 종목 선택 시 상세 / 평소엔 스와이프 2페이지 ===== */}
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
            // 가로 스와이프 의도가 분명할 때만 포인터 캡처 (버튼/세그먼트 클릭 보호)
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
          {/* 페이지 도트 */}
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
            {/* 페이지 1: 포트폴리오 (내부 스크롤 + 거래내역 시트 오버레이) */}
            <div style={{ width: "50%", flexShrink: 0, height: "100%", position: "relative", overflow: "hidden" }}>
              <PortfolioPage view={view} acctSel={acctSel} sbOpen={sbOpen} topLeft={sbBtn} />
            </div>
            {/* 페이지 2: 성과 추이 (내부 스크롤) */}
            <div style={{ width: "50%", flexShrink: 0, height: "100%", overflowY: "auto" }}>
              <PerfPage topLeft={sbBtn} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
