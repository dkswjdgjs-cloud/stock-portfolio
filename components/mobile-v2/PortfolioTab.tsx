"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { C, FONT, NUM } from "@/lib/glow-theme";
import { fmtAvg, fmtN, fmtPrice, fmtW, holdingOf, PL_MODES, type MockStock, type PortfolioSummary, type PortfolioView } from "@/lib/tabletV2Helpers";
import { Badge } from "./ui";

interface SearchResult { ticker: string; name: string; market: "KR" | "US"; }

export default function PortfolioTab({ view, stocks, summary, acctSel, onAcct, onSelect, onRefresh, refreshing, cycleTheme, theme }: {
  view: PortfolioView; stocks: MockStock[]; summary: PortfolioSummary;
  acctSel: string; onAcct: (a: string) => void;
  onSelect: (s: MockStock) => void; onRefresh: () => void; refreshing: boolean;
  cycleTheme: () => void; theme: string;
}) {
  const [viewMode, setViewMode] = useState("시세");
  const [plIdx, setPlIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [apiResults, setApiResults] = useState<SearchResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isSearching = query.trim().length > 0;

  const doSearch = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) { setApiResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      try { const r = await fetch("/api/stock-search?q=" + encodeURIComponent(q.trim())); setApiResults(await r.json()); } catch { setApiResults([]); }
    }, 250);
  }, []);
  useEffect(() => { doSearch(query); }, [query, doSearch]);

  const localMatch = isSearching ? view.rows.map(r => r.stock).filter(s =>
    s.name.toLowerCase().includes(query.trim().toLowerCase()) || s.code.toLowerCase().includes(query.trim().toLowerCase())
  ) : [];
  const localTickers = new Set(localMatch.map(s => s.code));
  const apiExtra = apiResults.filter(sr => !localTickers.has(sr.ticker)).map((sr): MockStock => ({
    id: sr.ticker, code: sr.ticker, name: sr.name, market: sr.market === "US" ? "해외" : "국내",
    currency: sr.market === "US" ? "USD" : "KRW", price: 0, dayPct: 0, dailyChangeKRW: 0,
    sector: "기타", country: sr.market === "US" ? "미국" : "한국",
    color: "#8E8E93", holdings: {}, stats: {}, trades: [],
  }));
  const searchResults = [...localMatch, ...apiExtra];

  const profits = [
    { amt: summary.cumulativeProfit, pct: summary.cumulativeReturn },
    { amt: summary.annualProfit, pct: summary.annualReturn },
    { amt: summary.monthlyProfit, pct: summary.monthlyReturn },
    { amt: summary.dailyProfit, pct: summary.dailyReturn },
  ];
  const pl = profits[plIdx];
  const plCol = pl.amt >= 0 ? C.red : C.blue;

  const renderRow = (s: MockStock, i: number) => {
    const h = holdingOf(s, acctSel);
    return (
      <div key={s.id} onClick={() => onSelect(s)} style={{ display: "flex", alignItems: "center", padding: "12px 14px", cursor: "pointer", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.label, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</p>
          <p style={{ ...NUM, margin: "2px 0 0", fontSize: 12, color: C.sec }}>
            {h ? (viewMode === "시세" ? `평균 ${fmtAvg(s, h.avg)}` : `${fmtN(h.qty)}주 보유`) : s.code}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          {s.price > 0 ? (<>
            <p style={{ ...NUM, margin: 0, fontSize: 16, fontWeight: 600, color: C.label }}>{h && viewMode === "평가" ? fmtW(h.value) : fmtPrice(s)}</p>
            {h && viewMode === "평가" ? (
              <p style={{ ...NUM, margin: "2px 0 0", fontSize: 13, fontWeight: 600, color: h.pl >= 0 ? C.red : C.blue }}>{h.pl >= 0 ? "+" : ""}{fmtW(h.pl)} ({h.plPct >= 0 ? "+" : ""}{h.plPct.toFixed(1)}%)</p>
            ) : <div style={{ marginTop: 3 }}><Badge pct={s.dayPct} /></div>}
          </>) : <p style={{ ...NUM, margin: 0, fontSize: 13, color: C.gray }}>시세 조회</p>}
        </div>
      </div>
    );
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", WebkitOverflowScrolling: "touch", padding: "0 16px 20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 0 2px" }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, color: C.label }}>GLOW</h1>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={cycleTheme} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: C.fill, fontSize: 15, cursor: "pointer" }}>
            {theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🌓"}
          </button>
          <button onClick={onRefresh} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: C.fill, color: C.blue, fontSize: 16, cursor: "pointer" }}>↻</button>
        </div>
      </div>

      <p style={{ ...NUM, margin: "6px 0 0", fontSize: 32, fontWeight: 700, letterSpacing: "-0.03em", color: C.label }}>{fmtW(view.totalValue)}</p>
      <div onClick={() => setPlIdx(i => (i + 1) % 4)} style={{ display: "flex", gap: 8, alignItems: "center", margin: "4px 0 12px", cursor: "pointer" }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: C.sec, background: C.fill, borderRadius: 5, padding: "2px 7px" }}>{PL_MODES[plIdx]}수익금</span>
        <span style={{ ...NUM, fontSize: 17, fontWeight: 700, color: plCol }}>{pl.amt >= 0 ? "+" : ""}{fmtW(pl.amt)}</span>
        <span style={{ ...NUM, fontSize: 13, fontWeight: 600, color: plCol }}>({pl.pct >= 0 ? "+" : ""}{pl.pct.toFixed(1)}%)</span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7, background: C.search, borderRadius: 10, padding: "9px 11px", marginBottom: 10 }}>
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><circle cx="6.8" cy="6.8" r="5.3" stroke="rgba(60,60,67,0.6)" strokeWidth="1.5" /><path d="M11 11l3.6 3.6" stroke="rgba(60,60,67,0.6)" strokeWidth="1.5" strokeLinecap="round" /></svg>
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="종목명 · 코드 검색"
          style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 16, fontFamily: FONT, color: C.label, minWidth: 0 }} />
        {isSearching && <button onClick={() => setQuery("")} style={{ border: "none", background: "rgba(60,60,67,0.3)", color: "#fff", width: 18, height: 18, borderRadius: "50%", fontSize: 11, cursor: "pointer", display: "grid", placeItems: "center" }}>✕</button>}
      </div>

      {!isSearching && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <div style={{ display: "flex", background: C.search, borderRadius: 8, padding: 2 }}>
            {["시세", "평가"].map(m => (
              <button key={m} onClick={() => setViewMode(m)}
                style={{ border: "none", padding: "4px 16px", borderRadius: 7, fontSize: 13, fontWeight: viewMode === m ? 600 : 400, cursor: "pointer", background: viewMode === m ? C.card : "transparent", color: C.label, fontFamily: "inherit", boxShadow: viewMode === m ? "0 1px 2px rgba(0,0,0,0.08)" : "none" }}>{m}</button>
            ))}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>계좌 · {acctSel} ▾</span>
        </div>
      )}

      <div style={{ background: C.card, borderRadius: 12, overflow: "hidden", marginBottom: 16 }}>
        {isSearching ? (
          searchResults.length ? searchResults.map((s, i) => renderRow(s, i))
          : <p style={{ padding: "20px 14px", fontSize: 14, color: C.sec, textAlign: "center" }}>검색 결과가 없어요</p>
        ) : (<>
          {view.rows.map(({ stock }, i) => renderRow(stock, i))}
          {view.cash > 0 && (
            <div style={{ display: "flex", alignItems: "center", padding: "12px 14px", borderTop: `0.5px solid ${C.sep}` }}>
              <div style={{ flex: 1 }}><p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: C.label }}>현금성 자산</p><p style={{ margin: "2px 0 0", fontSize: 12, color: C.sec }}>예수금</p></div>
              <p style={{ ...NUM, fontSize: 16, fontWeight: 600, color: C.label, margin: 0 }}>{fmtW(view.cash)}</p>
            </div>
          )}
        </>)}
      </div>
      <p style={{ margin: "0 0 80px", fontSize: 12, color: C.ter, textAlign: "center" }}>GLOW · KIS 실시간 시세</p>
    </div>
  );
}
