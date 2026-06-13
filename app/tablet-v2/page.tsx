"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./glow-tokens.css";
import { C, FONT } from "@/lib/glow-theme";
import { buildView, holdingOf, type MockStock } from "@/lib/tabletV2Helpers";
import { useTabletV2Data } from "@/lib/tabletV2Data";
import { loadFavorites, saveFavorites, toggleFav, type FavEntry } from "@/lib/tabletV2Favorites";
import Sidebar from "@/components/tablet-v2/Sidebar";
import PortfolioPage from "@/components/tablet-v2/PortfolioPage";
import PerfPage from "@/components/tablet-v2/PerfPage";
import StockDetail from "@/components/tablet-v2/StockDetail";
import { SidebarToggle } from "@/components/tablet-v2/ui";

export default function TabletV2Page() {
  const [tab, setTab] = useState("시세");
  const [acctSel, setAcctSel] = useState("전체");
  const [selected, setSelected] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [sbOpen, setSbOpen] = useState(true);

  // Safari safe area 배경색 맞추기
  useEffect(() => {
    const orig = document.body.style.background;
    const update = () => {
      const isDark = document.querySelector('.glow-v2')?.getAttribute('data-theme') === 'dark'
        || (!(document.querySelector('.glow-v2')?.getAttribute('data-theme')) && window.matchMedia('(prefers-color-scheme: dark)').matches);
      document.body.style.background = isDark ? '#000000' : '#F2F2F7';
    };
    update();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', update);
    const observer = new MutationObserver(update);
    observer.observe(document.querySelector('.glow-v2') || document.body, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { document.body.style.background = orig; mq.removeEventListener('change', update); observer.disconnect(); };
  }, []);
  const [theme, setTheme] = useState<"auto"|"light"|"dark">("auto");

  // 다크모드 localStorage 저장/로드
  useEffect(() => {
    const saved = localStorage.getItem("glow-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);
  const cycleTheme = () => {
    setTheme((t) => {
      const next = t === "auto" ? "dark" : t === "dark" ? "light" : "auto";
      if (next === "auto") localStorage.removeItem("glow-theme");
      else localStorage.setItem("glow-theme", next);
      return next;
    });
  };
  const themeAttr = theme === "auto" ? undefined : theme;

  // ===== 검색 + 즐겨찾기 =====
  const [query, setQuery] = useState("");
  const [listMode, setListMode] = useState("보유"); // 보유 | 즐겨찾기
  const [favs, setFavs] = useState<FavEntry[]>([]);
  const [favStocks, setFavStocks] = useState<MockStock[]>([]);

  // localStorage 로드
  useEffect(() => { setFavs(loadFavorites()); }, []);

  // favs 변경 시 저장
  useEffect(() => { if (favs.length > 0 || localStorage.getItem("glow-favorites")) saveFavorites(favs); }, [favs]);

  const handleToggleFav = useCallback((s: MockStock) => {
    const entry: FavEntry = { ticker: s.code, market: s.currency === "USD" ? "US" : "KR", name: s.name };
    setFavs((prev) => toggleFav(prev, entry));
  }, []);

  // ===== 실데이터 fetch =====
  const { stocks, cash, perfDays, agg, accounts, allTrades, summary, loading, error, refresh } = useTabletV2Data();

  // 즐겨찾기 중 미보유 종목 가격 fetch
  useEffect(() => {
    if (!favs.length || !stocks.length) { setFavStocks([]); return; }
    const heldTickers = new Set(stocks.map((s) => s.code));
    const missing = favs.filter((f) => !heldTickers.has(f.ticker));
    if (!missing.length) { setFavStocks([]); return; }

    Promise.all(missing.map(async (fav) => {
      try {
        const r = await fetch(`/api/stock?ticker=${fav.ticker}&market=${fav.market}`);
        const d = await r.json();
        const price = Number(d.price) || 0;
        const dayChg = Number(d.dailyChange) || 0;
        const prev = price - dayChg;
        return {
          id: fav.ticker, code: fav.ticker, name: fav.name,
          market: fav.market === "US" ? "해외" : "국내",
          currency: fav.market === "US" ? "USD" : "KRW",
          price, dayPct: prev > 0 ? (dayChg / prev) * 100 : 0,
          dailyChangeKRW: 0, sector: "기타", country: fav.market === "US" ? "미국" : "한국",
          color: "#8E8E93", holdings: {}, stats: {}, trades: [],
        } as MockStock;
      } catch { return null; }
    })).then((results) => setFavStocks(results.filter(Boolean) as MockStock[]));
  }, [favs, stocks]);

  // ===== 계좌 필터 기준 파생 데이터 =====
  const view = useMemo(() => buildView(stocks, cash, acctSel), [stocks, cash, acctSel]);

  // 선택 종목: held + favStocks 합산에서 찾기
  const allStocks = useMemo(() => [...stocks, ...favStocks.filter((fs) => !stocks.some((s) => s.id === fs.id))], [stocks, favStocks]);
  const sel = selected ? allStocks.find((s) => s.id === selected) ?? null : null;
  const selH = sel ? holdingOf(sel, acctSel) : null;

  const pick = (id: string) => {
    if (id === "CASH" || !id) return;
    setSelected((prev) => (prev === id ? null : id));
  };

  const sbBtn = <SidebarToggle open={sbOpen} onToggle={() => setSbOpen((o) => !o)} />;

  // 즐겨찾기 모드 빈 상태
  const showFavEmpty = !sel && listMode === "즐겨찾기" && !query.trim();

  // ===== 로딩 / 에러 =====
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
      data-theme={themeAttr}
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
        query={query}
        onQuery={setQuery}
        listMode={listMode}
        onListMode={setListMode}
        favs={favs}
        onToggleFav={handleToggleFav}
        favStocks={favStocks}
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
      ) : sel && !selH ? (
        /* 미보유 즐겨찾기 종목 — 간단 시세 뷰 */
        <div style={{ flex: 1, minWidth: 0, height: "100%", overflowY: "auto" }}>
          <StockDetail
            key={sel.id}
            stock={sel}
            holding={null}
            acctSel={acctSel}
            totalValue={view.totalValue}
            topLeft={sbBtn}
            onBack={() => setSelected(null)}
          />
        </div>
      ) : showFavEmpty ? (
        <div style={{ flex: 1, minWidth: 0, height: "100%", display: "grid", placeItems: "center", padding: 40 }}>
          <div style={{ textAlign: "center", maxWidth: 360 }}>
            <div style={{ width: 72, height: 72, borderRadius: 20, background: C.fill, display: "grid", placeItems: "center", margin: "0 auto 18px" }}>
              <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke={C.orange} strokeWidth="1.6" strokeLinejoin="round">
                <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 18.6 6 20.8l1.1-6.6L2.4 9.5l6.6-.9z" />
              </svg>
            </div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>관심 종목을 골라보세요</h2>
            <p style={{ margin: "8px 0 0", fontSize: 15, color: C.sec, lineHeight: 1.5 }}>
              왼쪽 즐겨찾기 목록에서 종목을 선택하면<br />여기에 실시간 시세와 차트가 표시됩니다.
            </p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minWidth: 0, height: "100%", display: "flex", flexDirection: "column", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px 0", flexShrink: 0, background: C.card }}>
            {sbBtn}
            <div style={{ display: "inline-flex", background: "rgba(120,120,128,0.12)", borderRadius: 9, padding: 2 }}>
              {["포트폴리오", "성과 추이"].map((label, p) => (
                <button key={label} onClick={() => setPage(p)}
                  style={{
                    border: "none", padding: "5px 20px", borderRadius: 7, fontSize: 13,
                    fontFamily: "inherit", fontWeight: page === p ? 600 : 500, cursor: "pointer",
                    background: page === p ? "#fff" : "transparent",
                    boxShadow: page === p ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
                    color: "#000", transition: "all .15s",
                  }}>{label}</button>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={cycleTheme} title={theme === "auto" ? "시스템 테마" : theme === "dark" ? "다크 모드" : "라이트 모드"}
                style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: C.fill, color: C.blue, fontSize: 17, cursor: "pointer" }}>
                {theme === "dark" ? "🌙" : theme === "light" ? "☀️" : "🌓"}
              </button>
              <button onClick={refresh} style={{ width: 34, height: 34, borderRadius: "50%", border: "none", background: C.fill, color: C.blue, fontSize: 17, cursor: "pointer" }} title="새로고침">↻</button>
            </div>
          </div>
          {page === 0 ? (
            <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
              <PortfolioPage
                view={view}
                acctSel={acctSel}
                sbOpen={sbOpen}
                topLeft={sbBtn}
                stocks={stocks}
                accounts={accounts}
                allTrades={allTrades}
                summary={summary}
                onRefresh={refresh}
                refreshing={loading}
              />
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: "auto" }}>
              <PerfPage
                topLeft={sbBtn}
                perfDays={perfDays}
                agg={agg}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
