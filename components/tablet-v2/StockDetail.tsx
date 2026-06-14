"use client";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { C, NUM } from "@/lib/glow-theme";
import {
  dailyChangeColor, fmtAvg, fmtDailyChangeFull, fmtN, fmtPrice, fmtW, type HoldingView, type MockStock,
} from "@/lib/tabletV2Helpers";
import { PriceChart, type ChartPoint } from "./charts";
import StockNewsGrid from "./StockNewsGrid";
import { Segment } from "./ui";

const PERIODS: { label: string; range: string }[] = [
  { label: "1주", range: "1W" },
  { label: "1개월", range: "1M" },
  { label: "3개월", range: "3M" },
  { label: "6개월", range: "1Y" },
  { label: "1년", range: "3Y" },
];

interface StockInfoData {
  mktCap?: string; per?: string; pbr?: string; eps?: string;
  avgVol?: string; roe?: string; w52High?: number; w52Low?: number;
}

export default function StockDetail({
  stock, holding, acctSel, totalValue, topLeft, onBack,
}: {
  stock: MockStock;
  holding: HoldingView | null;
  acctSel: string;
  totalValue: number;
  topLeft: ReactNode;
  onBack: () => void;
}) {
  const [periodIdx, setPeriodIdx] = useState(1);
  const [detailTab, setDetailTab] = useState("관련뉴스");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [info, setInfo] = useState<StockInfoData | null>(null);

  const market = stock.currency === "USD" ? "US" : "KR";
  const owned = !!holding;

  const fetchChart = useCallback(async (range: string) => {
    setChartLoading(true);
    try {
      const r = await fetch(`/api/stock-chart?ticker=${stock.code}&market=${market}&range=${range}`);
      const d = await r.json();
      setChartData(d.chartData || []);
    } catch { setChartData([]); }
    finally { setChartLoading(false); }
  }, [stock.code, market]);

  useEffect(() => {
    if (market !== "KR") { setInfo(null); return; }
    fetch(`/api/stock-info?ticker=${stock.code}&market=KR`)
      .then((r) => r.json())
      .then((d) => setInfo(d.info || null))
      .catch(() => setInfo(null));
  }, [stock.code, market]);

  useEffect(() => { fetchChart(PERIODS[periodIdx].range); }, [periodIdx, fetchChart]);

  const last = chartData.length > 0 ? chartData[chartData.length - 1] : null;
  const fmtOhlc = (v: number | undefined) => {
    if (v == null) return "—";
    return stock.currency === "USD" ? `$${v.toLocaleString()}` : v.toLocaleString("ko-KR");
  };
  const ohlcv: [string, string][] = last ? [
    ["시가", fmtOhlc(last.open)],
    ["고가", fmtOhlc(last.high)],
    ["저가", fmtOhlc(last.low)],
    ["거래량", last.volume?.toLocaleString("ko-KR") ?? "—"],
  ] : [["시가", "—"], ["고가", "—"], ["저가", "—"], ["거래량", "—"]];

  // 종목 정보 — 보유 vs 미보유
  const infoRows: [string, string, string?][] = owned && holding ? [
    ["보유 수량", fmtN(holding.qty) + "주"],
    ["평균 단가", fmtAvg(stock, holding.avg)],
    ["평가 금액", fmtW(holding.value)],
    ["평가 손익", (holding.pl >= 0 ? "+" : "") + fmtW(holding.pl), holding.pl >= 0 ? C.red : C.blue],
    ["포트폴리오 비중", ((holding.value / totalValue) * 100).toFixed(2) + "%"],
    ...(info?.mktCap && info.mktCap !== "-" ? [["시가총액", info.mktCap] as [string, string]] : []),
    ...(info?.per && info.per !== "-" ? [["PER", info.per] as [string, string]] : []),
    ...(info?.pbr && info.pbr !== "-" ? [["PBR", info.pbr] as [string, string]] : []),
    ...(info?.eps && info.eps !== "-" ? [["EPS", info.eps] as [string, string]] : []),
    ...(info?.roe && info.roe !== "-" ? [["ROE", info.roe] as [string, string]] : []),
    ...(info?.avgVol && info.avgVol !== "-" ? [["평균거래량", info.avgVol] as [string, string]] : []),
    ...(info?.w52High ? [["52주 최고", fmtN(info.w52High) + "원"] as [string, string]] : []),
    ...(info?.w52Low ? [["52주 최저", fmtN(info.w52Low) + "원"] as [string, string]] : []),
  ] : [
    ["현재가", fmtPrice(stock) + (stock.currency === "KRW" ? "원" : "")],
    ["등락률", (stock.dayPct >= 0 ? "+" : "") + stock.dayPct.toFixed(2) + "%", stock.dayPct >= 0 ? C.red : C.blue],
    ["섹터", stock.sector],
    ["시장", stock.market],
    ["국가", stock.country],
    ...(info?.mktCap && info.mktCap !== "-" ? [["시가총액", info.mktCap] as [string, string]] : []),
    ...(info?.per && info.per !== "-" ? [["PER", info.per] as [string, string]] : []),
    ...(info?.pbr && info.pbr !== "-" ? [["PBR", info.pbr] as [string, string]] : []),
    ...(info?.roe && info.roe !== "-" ? [["ROE", info.roe] as [string, string]] : []),
  ];

  const trades = stock.trades.filter((t) => acctSel === "전체" || t.acct === acctSel);

  return (
    <main style={{ padding: "20px 28px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
        {topLeft}
        <button onClick={onBack}
          style={{ display: "inline-flex", alignItems: "center", gap: 4, border: "none", background: "transparent", color: C.blue, fontSize: 17, fontFamily: "inherit", cursor: "pointer", padding: "4px 0" }}>
          <svg width="12" height="20" viewBox="0 0 12 20">
            <path d="M10 2L3 10l7 8" stroke={C.blue} strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {owned ? "포트폴리오" : "목록"}
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.026em" }}>{stock.name}</h1>
          <p style={{ margin: "3px 0 0", fontSize: 15, color: C.sec }}>
            {stock.code} · {stock.market}{owned && acctSel !== "전체" ? ` · ${acctSel}` : ""}
          </p>
        </div>
        {owned && holding ? (
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 12, color: C.sec }}>평가수익률</p>
            <p style={{ ...NUM, margin: "2px 0 0", fontSize: 22, fontWeight: 700, color: holding.pl >= 0 ? C.red : C.blue }}>
              {holding.pl >= 0 ? "+" : ""}{holding.plPct.toFixed(2)}%
            </p>
            <p style={{ ...NUM, margin: 0, fontSize: 13, color: C.sec }}>{holding.pl >= 0 ? "+" : ""}{fmtW(holding.pl)}</p>
          </div>
        ) : (
          <div style={{ textAlign: "right" }}>
            <p style={{ margin: 0, fontSize: 12, color: C.sec }}>관심종목</p>
            <p style={{ ...NUM, margin: "2px 0 0", fontSize: 13, color: C.ter }}>미보유</p>
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0 18px" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
          <span style={{ ...NUM, fontSize: 44, fontWeight: 700, letterSpacing: "-0.03em" }}>
            {fmtPrice(stock)}{stock.currency === "KRW" ? "원" : ""}
          </span>
          <span style={{ ...NUM, fontSize: 17, fontWeight: 600, color: dailyChangeColor(stock) }}>
            {fmtDailyChangeFull(stock)}
          </span>
        </div>
        <Segment compact items={["관련뉴스", "종목정보"]} value={detailTab} onChange={setDetailTab} />
      </div>

      <div style={{ background: C.card, borderRadius: 16, padding: 22, marginBottom: 26 }}>
        <div style={{ marginBottom: 14 }}>
          <Segment compact items={PERIODS.map((p) => p.label)} value={PERIODS[periodIdx].label}
            onChange={(v) => setPeriodIdx(PERIODS.findIndex((p) => p.label === v))} />
        </div>
        {chartLoading ? (
          <div style={{ height: 220, display: "grid", placeItems: "center", color: C.sec, fontSize: 14 }}>차트 로딩 중…</div>
        ) : (
          <PriceChart data={chartData} currency={stock.currency} />
        )}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16, background: C.fill, borderRadius: 10, padding: "12px 16px" }}>
          {ohlcv.map(([k, v]) => (
            <div key={k}>
              <p style={{ margin: 0, fontSize: 12, color: C.sec }}>{k}</p>
              <p style={{ ...NUM, margin: "2px 0 0", fontSize: 15, fontWeight: 600 }}>{v}</p>
            </div>
          ))}
        </div>
      </div>

      {detailTab === "관련뉴스" ? (
        <>
          <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>관련 뉴스</h2>
          <StockNewsGrid target={{ id: stock.id, name: stock.name }} fetchCount={20} />
        </>
      ) : (
        <>
          <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>종목 정보{owned && acctSel !== "전체" ? ` · ${acctSel}` : ""}</h2>
          <div style={{ background: C.card, borderRadius: 16, padding: "4px 22px", marginBottom: 26 }}>
            {infoRows.map(([k, v, col], i) => (
              <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
                <span style={{ fontSize: 15, color: C.sec }}>{k}</span>
                <span style={{ ...NUM, fontSize: 15, fontWeight: 600, color: col || C.label }}>{v}</span>
              </div>
            ))}
          </div>

          {owned && trades.length > 0 && (
            <>
              <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>거래 내역</h2>
              <div style={{ background: C.card, borderRadius: 16, overflow: "hidden" }}>
                <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 64px 70px 110px", gap: 8, padding: "10px 22px", background: C.fill }}>
                  {["날짜", "계좌", "구분", "수량", "단가"].map((h) => (
                    <span key={h} style={{ fontSize: 12, fontWeight: 600, color: C.sec, textAlign: h === "수량" || h === "단가" ? "right" : "left" }}>{h}</span>
                  ))}
                </div>
                {trades.map((t, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 1fr 64px 70px 110px", gap: 8, alignItems: "center", padding: "12px 22px", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
                    <span style={{ ...NUM, fontSize: 14 }}>{t.date}</span>
                    <span style={{ fontSize: 14 }}>{t.acct}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, textAlign: "center", padding: "2px 0", borderRadius: 5, color: t.type === "매수" ? C.red : C.blue, background: t.type === "매수" ? "rgba(255,59,48,0.10)" : "rgba(0,122,255,0.10)" }}>{t.type}</span>
                    <span style={{ ...NUM, fontSize: 14, textAlign: "right" }}>{t.qty}주</span>
                    <span style={{ ...NUM, fontSize: 14, textAlign: "right" }}>{t.unit}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </main>
  );
}
