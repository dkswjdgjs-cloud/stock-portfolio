"use client";
import { useMemo, useState, type ReactNode } from "react";
import { C, COUNTRY_COLOR, NUM, SECTOR_COLOR } from "@/lib/glow-theme";
import {
  PL_MODES, allTradesOf, fmtW,
  type AcctPerf, type MockStock, type PortfolioSummary, type PortfolioView,
} from "@/lib/tabletV2Helpers";
import { AcctBar, Donut, type DonutItem } from "./charts";
import { Segment } from "./ui";

function todayLabel() {
  const d = new Date();
  const day = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  return `${d.getMonth() + 1}월 ${d.getDate()}일 ${day}요일`;
}

export default function PortfolioPage({
  view, acctSel, sbOpen, topLeft, stocks, accounts, summary, onRefresh, refreshing,
}: {
  view: PortfolioView;
  acctSel: string;
  sbOpen: boolean;
  topLeft: ReactNode;
  stocks: MockStock[];
  accounts: AcctPerf[];
  summary: PortfolioSummary;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const [pieMode, setPieMode] = useState("종목별");
  const [pieActive, setPieActive] = useState<string | null>(null);
  const [plMode, setPlMode] = useState(0);
  const [showTrades, setShowTrades] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [spin, setSpin] = useState(false);

  const pieItems: DonutItem[] = useMemo(() => {
    if (pieMode === "종목별") {
      return [
        ...view.rows.map((r) => ({ key: r.stock.id, label: r.stock.name, value: r.h.value, color: r.stock.color })),
        ...(view.cash ? [{ key: "CASH", label: "현금성 자산", value: view.cash, color: C.green }] : []),
      ];
    }
    const groupKey = pieMode === "섹터별" ? ("sector" as const) : ("country" as const);
    const colors = pieMode === "섹터별" ? SECTOR_COLOR : COUNTRY_COLOR;
    const map: Record<string, number> = {};
    view.rows.forEach((r) => {
      const g = r.stock[groupKey];
      map[g] = (map[g] || 0) + r.h.value;
    });
    if (view.cash) map[pieMode === "섹터별" ? "현금" : "현금"] = (map["현금"] || 0) + view.cash;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([g, v]) => ({ key: g, label: g, value: v, color: colors[g] || C.gray }));
  }, [view, pieMode]);

  const pieTotal = pieItems.reduce((s, it) => s + it.value, 0) || 1;

  // 전체 거래 내역 (계좌 필터 적용)
  const allTrades = useMemo(() => allTradesOf(stocks, acctSel), [stocks, acctSel]);

  // 계좌별 성과: 전체 보기일 땐 모두, 특정 계좌 선택 시 그 계좌만
  const acctCards = acctSel === "전체" ? accounts : accounts.filter((a) => a.name === acctSel);
  const maxPct = acctCards.length ? Math.max(...acctCards.map((a) => Math.abs(a.pct)), 1) : 1;

  const mode = PL_MODES[plMode];
  const profits = [
    { amt: summary.cumulativeProfit, pct: summary.cumulativeReturn },
    { amt: summary.annualProfit, pct: summary.annualReturn },
    { amt: summary.monthlyProfit, pct: summary.monthlyReturn },
    { amt: summary.dailyProfit, pct: summary.dailyReturn },
  ];
  const plAmt = profits[plMode].amt;
  const plPct = profits[plMode].pct;
  const plCol = plAmt >= 0 ? C.red : C.blue;

  const handleRefresh = () => {
    setSpin(true);
    onRefresh();
    setTimeout(() => setSpin(false), 700);
  };

  return (
    <>
      <main style={{ height: "100%", overflowY: "auto", padding: "20px 28px 40px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 4 }}>
          {topLeft}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={handleRefresh} disabled={refreshing}
              style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: C.fill, color: C.blue, fontSize: 17, cursor: refreshing ? "wait" : "pointer", transform: spin ? "rotate(360deg)" : "none", transition: "transform .7s", opacity: refreshing ? 0.6 : 1 }}
              title="새로고침">↻</button>
            <button style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: C.fill, color: C.blue, fontSize: 17, cursor: "pointer" }}>↑</button>
          </div>
        </div>

        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.026em" }}>
          포트폴리오{acctSel !== "전체" ? ` · ${acctSel}` : ""}
        </h1>
        <p style={{ margin: "3px 0 0", fontSize: 15, color: C.sec }}>
          <span style={{ display: "inline-block", width: 7, height: 7, borderRadius: "50%", background: C.green, marginRight: 5, verticalAlign: 1 }} />
          실시간 · {todayLabel()}
        </p>

        <p style={{ ...NUM, margin: "14px 0 0", fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em" }}>{fmtW(view.totalValue)}</p>
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

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>자산 배분</h2>
          <Segment compact items={["종목별", "섹터별", "국가별"]} value={pieMode} onChange={(m) => { setPieMode(m); setPieActive(null); }} />
        </div>
        <div style={{ background: C.card, borderRadius: 16, padding: 22, marginBottom: 26 }}>
          <div style={{ display: "flex", gap: 30, alignItems: "center" }}>
            <div style={{ position: "relative", width: sbOpen ? 210 : 300, height: sbOpen ? 210 : 300, flexShrink: 0, transition: "width .34s, height .34s" }}>
              <Donut items={pieItems} active={pieActive} size={sbOpen ? 210 : 300}
                onPick={(key) => setPieActive((p) => (p === key ? null : key))} />
              <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
                <div style={{ maxWidth: sbOpen ? 98 : 145 }}>
                  <p style={{ margin: 0, fontSize: sbOpen ? 10 : 11, color: C.sec, letterSpacing: "0.05em", lineHeight: 1.3 }}>
                    {pieActive ? pieItems.find((it) => it.key === pieActive)?.label : "MARKET VALUE"}
                  </p>
                  <p style={{ ...NUM, margin: "2px 0 0", fontSize: sbOpen ? 13.5 : 18, fontWeight: 700 }}>
                    {pieActive ? fmtW(pieItems.find((it) => it.key === pieActive)?.value || 0) : fmtW(view.totalValue)}
                  </p>
                </div>
              </div>
            </div>
            <div style={{ flex: 1 }}>
              {pieItems.map((it, i) => (
                <div key={it.key}
                  onClick={() => setPieActive((p) => (p === it.key ? null : it.key))}
                  style={{
                    display: "flex", alignItems: "center", gap: 10, padding: "8px 6px",
                    cursor: "pointer", borderTop: i ? `0.5px solid ${C.sep}` : "none",
                    opacity: pieActive && pieActive !== it.key ? 0.4 : 1, transition: "opacity .2s",
                  }}>
                  <span style={{ width: 10, height: 10, borderRadius: "50%", background: it.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: 15 }}>{it.label}</span>
                  <span style={{ ...NUM, fontSize: 15, fontWeight: 600 }}>{fmtW(it.value)}</span>
                  <span style={{ ...NUM, fontSize: 13, color: C.sec, width: 58, textAlign: "right" }}>
                    {((it.value / pieTotal) * 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {sbOpen ? (
          <>
            <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>계좌별 성과</h2>
            <div style={{ background: C.card, borderRadius: 16, padding: "8px 22px 10px", marginBottom: 26, minHeight: 80, maxHeight: 330, overflowY: "auto" }}>
              {acctCards.length === 0 ? (
                <p style={{ padding: "20px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>계좌 데이터가 없습니다.</p>
              ) : (
                acctCards.map((a, i) => <AcctBar key={a.name + acctSel} a={a} max={maxPct} delay={i * 80} />)
              )}
            </div>

            <button onClick={() => setShowTrades(true)}
              style={{ display: "block", width: "100%", textAlign: "center", background: C.card, borderRadius: 10, padding: 13, fontSize: 17, color: C.blue, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
              전체 거래 내역 보기 · {allTrades.length}건
            </button>
          </>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
            <div>
              <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>계좌별 성과</h2>
              <div style={{ background: C.card, borderRadius: 16, padding: "8px 22px 10px", height: 384, overflowY: "auto", boxSizing: "border-box" }}>
                {acctCards.length === 0 ? (
                  <p style={{ padding: "20px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>계좌 데이터가 없습니다.</p>
                ) : (
                  acctCards.map((a, i) => <AcctBar key={a.name + acctSel + "w"} a={a} max={maxPct} delay={i * 80} />)
                )}
              </div>
            </div>
            <div>
              <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>전체 거래 내역{acctSel !== "전체" ? ` · ${acctSel}` : ""}</h2>
              <div
                style={{
                  background: C.card, borderRadius: 16, overflow: "hidden",
                  height: tradesOpen ? 384 : 46, transition: "height .36s cubic-bezier(.32,.72,.25,1)",
                  display: "flex", flexDirection: "column", boxSizing: "border-box",
                }}>
                <div onClick={() => setTradesOpen((o) => !o)}
                  style={{ height: 46, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px", cursor: "pointer", userSelect: "none" }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: tradesOpen ? C.label : C.blue }}>
                    {tradesOpen ? `${allTrades.length}건` : "거래 내역 펼치기"}
                  </span>
                  <svg width="13" height="8" viewBox="0 0 14 8" style={{ transform: tradesOpen ? "rotate(180deg)" : "none", transition: "transform .3s" }}>
                    <path d="M1 1l6 6 6-6" stroke={C.blue} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "88px 1fr 44px 52px 86px", gap: 8, padding: "9px 18px", background: C.fill }}>
                  {["날짜", "종목", "구분", "수량", "단가"].map((h) => (
                    <span key={h} style={{ fontSize: 11.5, fontWeight: 600, color: C.sec, textAlign: h === "수량" || h === "단가" ? "right" : "left" }}>{h}</span>
                  ))}
                </div>
                <div style={{ flex: 1, overflowY: "auto", padding: "0 18px 10px" }}>
                  {allTrades.map((t, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "88px 1fr 44px 52px 86px", gap: 8, alignItems: "center", padding: "10px 0", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
                      <span style={{ ...NUM, fontSize: 12.5 }}>{t.date}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.stockName}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, textAlign: "center", padding: "2px 0", borderRadius: 5, color: t.type === "매수" ? C.red : C.blue, background: t.type === "매수" ? "rgba(255,59,48,0.10)" : "rgba(0,122,255,0.10)" }}>{t.type}</span>
                      <span style={{ ...NUM, fontSize: 12.5, textAlign: "right" }}>{t.qty}주</span>
                      <span style={{ ...NUM, fontSize: 12.5, textAlign: "right" }}>{t.unit}</span>
                    </div>
                  ))}
                  {allTrades.length === 0 && <p style={{ padding: "14px 0", fontSize: 14, color: C.sec }}>거래 내역이 없습니다.</p>}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* 슬라이드업 거래 내역 시트 */}
      <div onClick={() => setShowTrades(false)}
        style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 90,
          opacity: showTrades ? 1 : 0, pointerEvents: showTrades ? "auto" : "none", transition: "opacity .3s",
        }} />
      <div
        style={{
          position: "absolute", left: 16, right: 16, bottom: 0, zIndex: 100,
          height: "min(680px, calc(100% - 90px))",
          background: C.card, borderRadius: "18px 18px 0 0",
          boxShadow: "0 -10px 50px rgba(0,0,0,0.22)",
          transform: showTrades ? "translateY(0)" : "translateY(105%)",
          transition: "transform .42s cubic-bezier(.32,.72,.25,1)",
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: "rgba(60,60,67,0.25)", margin: "8px auto 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px 10px" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>전체 거래 내역{acctSel !== "전체" ? ` · ${acctSel}` : ""}</h2>
          <button onClick={() => setShowTrades(false)}
            style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: C.fill, color: C.sec, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "104px 1fr 110px 58px 64px 104px", gap: 8, padding: "9px 24px", background: C.fill }}>
          {["날짜", "종목", "계좌", "구분", "수량", "단가"].map((h) => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: C.sec, textAlign: h === "수량" || h === "단가" ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 20px" }}>
          {allTrades.map((t, i) => (
            <div key={i} style={{ display: "grid", gridTemplateColumns: "104px 1fr 110px 58px 64px 104px", gap: 8, alignItems: "center", padding: "12px 0", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
              <span style={{ ...NUM, fontSize: 14 }}>{t.date}</span>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.stockName}</span>
              <span style={{ fontSize: 14 }}>{t.acct}</span>
              <span style={{ fontSize: 12, fontWeight: 600, textAlign: "center", padding: "2px 0", borderRadius: 5, color: t.type === "매수" ? C.red : C.blue, background: t.type === "매수" ? "rgba(255,59,48,0.10)" : "rgba(0,122,255,0.10)" }}>{t.type}</span>
              <span style={{ ...NUM, fontSize: 14, textAlign: "right" }}>{t.qty}주</span>
              <span style={{ ...NUM, fontSize: 14, textAlign: "right" }}>{t.unit}</span>
            </div>
          ))}
          {allTrades.length === 0 && <p style={{ padding: "18px 0", fontSize: 15, color: C.sec }}>거래 내역이 없습니다.</p>}
        </div>
      </div>
    </>
  );
}
