"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import "../tablet-v2/glow-tokens.css";
import { C, FONT } from "@/lib/glow-theme";
import { buildView, holdingOf, type MockStock } from "@/lib/tabletV2Helpers";
import { useTabletV2Data } from "@/lib/tabletV2Data";
import { loadFavorites, saveFavorites, toggleFav, type FavEntry } from "@/lib/tabletV2Favorites";
import PortfolioTab from "@/components/mobile-v2/PortfolioTab";
import AssetTab from "@/components/mobile-v2/AssetTab";
import PerfTab from "@/components/mobile-v2/PerfTab";
import StockDetail from "@/components/mobile-v2/StockDetail";
import { BottomTabBar } from "@/components/mobile-v2/ui";

export default function MobileV2Page() {
  const [tab, setTab] = useState(0);
  const [acctSel, setAcctSel] = useState("전체");
  const [detail, setDetail] = useState<MockStock | null>(null);
  const [theme, setTheme] = useState<"auto"|"light"|"dark">("auto");
  const [favs, setFavs] = useState<FavEntry[]>([]);

  useEffect(() => { setFavs(loadFavorites()); }, []);
  useEffect(() => { if (favs.length > 0 || localStorage.getItem("glow-favorites")) saveFavorites(favs); }, [favs]);
  useEffect(() => {
    const saved = localStorage.getItem("glow-theme");
    if (saved === "light" || saved === "dark") setTheme(saved);
  }, []);
  const cycleTheme = () => setTheme(t => {
    const next = t === "auto" ? "dark" : t === "dark" ? "light" : "auto";
    if (next === "auto") localStorage.removeItem("glow-theme"); else localStorage.setItem("glow-theme", next);
    return next;
  });
  const themeAttr = theme === "auto" ? undefined : theme;

  const handleToggleFav = useCallback((s: MockStock) => {
    setFavs(prev => toggleFav(prev, { ticker: s.code, market: s.currency === "USD" ? "US" : "KR", name: s.name }));
  }, []);

  const { stocks, cash, perfDays, agg, accounts, summary, loading, error, refresh } = useTabletV2Data();
  const view = useMemo(() => buildView(stocks, cash, acctSel), [stocks, cash, acctSel]);

  if (loading && stocks.length === 0) {
    return (
      <div className="glow-v2" data-theme={themeAttr} style={{ height: "100dvh", display: "grid", placeItems: "center", fontFamily: FONT, background: C.bgGrouped, color: C.sec }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: C.label, marginBottom: 8 }}>GLOW</div>
          <div style={{ fontSize: 14 }}>실시간 시세 불러오는 중…</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glow-v2" data-theme={themeAttr}
      style={{ height: "100dvh", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: FONT, background: C.bgGrouped, color: C.label, letterSpacing: "-0.022em", position: "relative" }}>
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        {tab === 0 && <PortfolioTab view={view} stocks={stocks} summary={summary} acctSel={acctSel} onAcct={setAcctSel} onSelect={setDetail} onRefresh={refresh} refreshing={loading} cycleTheme={cycleTheme} theme={theme} />}
        {tab === 1 && <AssetTab view={view} stocks={stocks} accounts={accounts} acctSel={acctSel} />}
        {tab === 2 && <PerfTab perfDays={perfDays} agg={agg} />}
        {detail && <StockDetail stock={detail} holding={holdingOf(detail, acctSel)} acctSel={acctSel} totalValue={view.totalValue} onBack={() => setDetail(null)} />}
      </div>
      <BottomTabBar tab={tab} onTab={(t) => { setTab(t); setDetail(null); }} />
    </div>
  );
}
