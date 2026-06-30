// =============================================================
// tablet-v2 실데이터 fetch hook
// /api/transactions, /api/cash-balance, /api/snapshot, /api/stock 호출 후
// tabletV2Helpers의 타입에 맞게 변환해 반환.
// =============================================================

"use client";

import { useCallback, useEffect, useState } from "react";
import { calcHoldings } from "./calcHoldings";
import {
  ACCT_LIST_EX_ALL,
  FX,
  buildAgg,
  type AcctPerf,
  type AggUnit,
  type MockStock,
  type PerfPoint,
  type PortfolioSummary,
} from "./tabletV2Helpers";

// ===== 색 팔레트 (iOS 차트 톤) =====
const PALETTE = [
  "#5856D6", "#30B0C7", "#007AFF", "#AF52DE",
  "#00C7BE", "#34C759", "#5AC8FA", "#FFCC00",
  "#7B68EE", "#4A90D9", "#48D1CC", "#88D498",
];
function colorFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = ((h << 5) - h + key.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length];
}

// ===== 시장 라벨 =====
function marketOf(ticker: string, currency: "KRW" | "USD"): string {
  if (currency === "USD") return "해외";
  // 6자리 숫자 ticker: KOSPI/KOSDAQ — 정확한 구분 없이 단순 "국내"로 표시
  return /^\d+$/.test(ticker) ? "국내" : "국내 ETF";
}

// ===== hook 반환 타입 =====
export interface TabletV2DataResult {
  stocks: MockStock[];
  cash: Record<string, number>;
  perfDays: PerfPoint[];
  agg: Record<AggUnit, () => PerfPoint[]>;
  accounts: AcctPerf[];
  acctInvested: Record<string, number>;
  allTrades: import("./tabletV2Helpers").TradeRow[];
  summary: PortfolioSummary;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// 임의 raw transaction 타입 (types/index.ts 동기화 부담 줄이려고 any 친화적으로)
interface RawTx {
  id: number;
  trade_date: string;
  account: string;
  ticker?: string | null;
  stock_name?: string | null;
  trade_type?: "매수" | "매도" | null;
  account_transfer?: "입금" | "출금" | null;
  transfer_amount?: number | null;
  quantity?: number | null;
  buy_price?: number | null;
  sell_price?: number | null;
}

interface RawCashBalance {
  account: string;
  balance: number;
}

interface RawSnapshot {
  snapshot_date: string;
  total_valuation?: number | null;
  total_invested?: number | null;
  total_profit?: number | null;
}

interface RawCashIncome {
  account?: string;
  amount: number;
}

export function useTabletV2Data(): TabletV2DataResult {
  const [stocks, setStocks] = useState<MockStock[]>([]);
  const [cash, setCash] = useState<Record<string, number>>({});
  const [perfDays, setPerfDays] = useState<PerfPoint[]>([]);
  const [accounts, setAccounts] = useState<AcctPerf[]>([]);
  const [acctInvested, setAcctInvested] = useState<Record<string, number>>({});
  const [allTrades, setAllTrades] = useState<import("./tabletV2Helpers").TradeRow[]>([]);
  const [summary, setSummary] = useState<PortfolioSummary>({
    currValue: 0, totalInvested: 0,
    cumulativeProfit: 0, cumulativeReturn: 0,
    annualProfit: 0, annualReturn: 0, annualBase: 0,
    monthlyProfit: 0, monthlyReturn: 0, monthlyBase: 0,
    dailyProfit: 0, dailyReturn: 0, dailyBase: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [txRes, balRes, snapRes, incRes] = await Promise.all([
        fetch("/api/transactions"),
        fetch("/api/cash-balance"),
        fetch("/api/snapshot"),
        fetch("/api/cash-income"),
      ]);
      const [transactions, cashBalances, snapshots, cashIncomes] = (await Promise.all([
        txRes.json(),
        balRes.json(),
        snapRes.json(),
        incRes.json(),
      ])) as [RawTx[], RawCashBalance[], RawSnapshot[], RawCashIncome[]];

      // 1. 계좌별 calcHoldings로 종목별 보유 추출 (같은 ticker는 holdings에 계좌 키로 누적)
      const stocksMap = new Map<string, MockStock>();
      for (const acct of ACCT_LIST_EX_ALL) {
        const hs = calcHoldings(transactions as any, acct);
        for (const h of hs as any[]) {
          if (!h.quantity || h.quantity <= 0) continue;
          let s = stocksMap.get(h.ticker);
          if (!s) {
            s = {
              id: h.ticker,
              code: h.ticker,
              name: h.stock_name,
              market: marketOf(h.ticker, h.currency),
              currency: h.currency,
              price: 0,
              dayPct: 0,
              dailyChangeKRW: 0,
              sector: h.sector || "기타",
              country: h.currency === "USD" ? "미국" : "한국",
              color: colorFor(h.ticker),
              holdings: {},
              stats: {},
              trades: [],
            };
            stocksMap.set(h.ticker, s);
          }
          s.holdings[acct] = { qty: h.quantity, avg: h.avg_price };
        }
      }

      const stocksArr = Array.from(stocksMap.values());

      // 2. 실시간 가격 fetch (병렬, 실패해도 다른 종목은 진행)
      await Promise.all(
        stocksArr.map(async (s) => {
          try {
            const market = s.currency === "USD" ? "US" : "KR";
            const r = await fetch(`/api/stock?ticker=${s.code}&market=${market}`);
            const d = await r.json();
            const price = Number(d.price) || 0;
            const dayChg = Number(d.dailyChange) || 0;
            s.price = price;
            if (s.currency === "USD") {
              // 해외 종목: API가 내려준 전일종가(prevClose)로 현재가 - 전일종가 직접 계산
              const prevClose = Number(d.prevClose) || 0;
              s.dayPct = prevClose > 0 ? ((price - prevClose) / prevClose) * 100 : 0;
            } else {
              const prev = price - dayChg;
              s.dayPct = prev > 0 ? (dayChg / prev) * 100 : 0;
            }
            // USD 종목: KIS 응답의 실시간 환율 보관 (없으면 FX 폴백)
            if (s.currency === "USD" && d.exchangeRate) {
              s.exchangeRate = Number(d.exchangeRate);
            }
            // 일일 등락 금액 (KRW 환산)
            const rate = s.exchangeRate || FX;
            s.dailyChangeKRW = s.currency === "USD" ? dayChg * rate : dayChg;
          } catch {
            // 가격 실패 시 0으로 두고 다음 종목 진행
          }
        }),
      );

      // 3. transactions에서 종목별 거래 내역 채우기 (날짜 내림차순)
      for (const t of transactions) {
        if (!t.ticker || !t.trade_type) continue;
        const s = stocksMap.get(t.ticker);
        if (!s) continue;
        const unitPrice = t.trade_type === "매수" ? t.buy_price : t.sell_price;
        const unit =
          s.currency === "USD"
            ? `$${(unitPrice ?? 0).toFixed(2)}`
            : `${Math.round(unitPrice ?? 0).toLocaleString("ko-KR")}원`;
        s.trades.push({
          date: t.trade_date,
          acct: t.account,
          type: t.trade_type,
          qty: t.quantity ?? 0,
          unit,
        });
      }
      for (const s of stocksArr) {
        s.trades.sort((a, b) => b.date.localeCompare(a.date));
      }

      // 4. 계좌별 예수금 맵 (현금소득 포함)
      const cashMap: Record<string, number> = {};
      for (const b of cashBalances) cashMap[b.account] = b.balance;
      for (const c of cashIncomes) {
        if (c.account) cashMap[c.account] = (cashMap[c.account] || 0) + c.amount;
      }

      // 5. snapshots → PerfPoint[] (날짜 오름차순)
      const sortedSnaps = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
      const perf: PerfPoint[] = sortedSnaps.map((s) => ({
        date: new Date(s.snapshot_date),
        label: s.snapshot_date,
        invested: s.total_invested || 0,
        value: s.total_valuation || 0,
        profit: s.total_profit || 0,
      }));

      // 6. 계좌별 성과 (현재 가격 기준 평가액 + 예수금 - 누적 투입금)
      const accts: AcctPerf[] = ACCT_LIST_EX_ALL.map((acct) => {
        let val = 0;
        for (const s of stocksArr) {
          const h = s.holdings[acct];
          if (!h) continue;
          val += s.currency === "USD" ? h.qty * s.price * (s.exchangeRate || FX) : h.qty * s.price;
        }
        val += cashMap[acct] || 0;
        const invested = transactions
          .filter((t) => t.account === acct && t.account_transfer)
          .reduce(
            (sum, t) =>
              t.account_transfer === "입금"
                ? sum + (t.transfer_amount || 0)
                : sum - (t.transfer_amount || 0),
            0,
          );
        const gain = val - invested;
        const pct = invested > 0 ? (gain / invested) * 100 : 0;
        return {
          name: acct,
          val: "₩" + Math.round(val).toLocaleString("ko-KR"),
          inv: "₩" + Math.round(invested).toLocaleString("ko-KR"),
          gain: (gain >= 0 ? "+" : "-") + "₩" + Math.round(Math.abs(gain)).toLocaleString("ko-KR"),
          pct,
        };
      })
        // 평가액 0원 계좌는 숨김 (한 번도 안 쓴 계좌)
        .filter((a) => {
          const n = Number(a.val.replace(/[^\d-]/g, ""));
          return n > 0;
        })
        // 수익률 내림차순
        .sort((a, b) => b.pct - a.pct);

      // 7. 정확한 수익금 계산 (snapshot 기반)
      const totalCash = Object.values(cashMap).reduce((a, b) => a + b, 0);
      let totalVal = 0;
      let totalDailyProfit = 0;
      for (const st of stocksArr) {
        const totalQty = Object.values(st.holdings).reduce((sum, h) => sum + h.qty, 0);
        const priceKRW = st.currency === "USD" ? st.price * (st.exchangeRate || FX) : st.price;
        totalVal += priceKRW * totalQty;
        totalDailyProfit += st.dailyChangeKRW * totalQty;
      }
      const currValue = totalVal + totalCash;
      const totalInvested = transactions
        .filter((t) => t.account_transfer)
        .reduce((sum, t) => t.account_transfer === "입금" ? sum + (t.transfer_amount || 0) : sum - (t.transfer_amount || 0), 0);
      const cashIncomeTotal = cashIncomes.reduce((sum: number, c: RawCashIncome) => sum + c.amount, 0);
      const cumulativeProfit = currValue - totalInvested + cashIncomeTotal;
      const cumulativeReturn = totalInvested > 0 ? (cumulativeProfit / totalInvested) * 100 : 0;

      // 연/월 수익: snapshot 기반
      const thisYear = new Date().getFullYear();
      const thisMonth = new Date().getMonth() + 1;
      const prevYearSnap = [...sortedSnaps].filter((sp) => sp.snapshot_date.startsWith(`${thisYear - 1}`)).pop();
      const prevMonthStr = thisMonth === 1 ? `${thisYear - 1}-12` : `${thisYear}-${String(thisMonth - 1).padStart(2, "0")}`;
      const prevMonthSnap = [...sortedSnaps].filter((sp) => sp.snapshot_date.startsWith(prevMonthStr)).pop();

      const prevYearVal = prevYearSnap?.total_valuation || 0;
      const prevYearInv = prevYearSnap?.total_invested || 0;
      const prevMonthVal = prevMonthSnap?.total_valuation || 0;
      const prevMonthInv = prevMonthSnap?.total_invested || 0;

      const annualProfit = currValue - prevYearVal - (totalInvested - prevYearInv);
      const annualBase = prevYearVal + (totalInvested - prevYearInv);
      const annualReturn = annualBase > 0 ? (annualProfit / annualBase) * 100 : 0;
      const monthlyProfit = currValue - prevMonthVal - (totalInvested - prevMonthInv);
      const monthlyBase = prevMonthVal + (totalInvested - prevMonthInv);
      const monthlyReturn = monthlyBase > 0 ? (monthlyProfit / monthlyBase) * 100 : 0;
      const dailyReturn = currValue > 0 ? (totalDailyProfit / (currValue - totalDailyProfit)) * 100 : 0;

      const dailyBase = currValue - totalDailyProfit;
      setSummary({
        currValue, totalInvested,
        cumulativeProfit, cumulativeReturn,
        annualProfit, annualReturn, annualBase,
        monthlyProfit, monthlyReturn, monthlyBase,
        dailyProfit: totalDailyProfit, dailyReturn, dailyBase,
      });

      // 8. 전체 거래 내역 (매수/매도/입금/출금 모두 포함)
      const trades: import("./tabletV2Helpers").TradeRow[] = [];
      for (const t of transactions) {
        if (t.trade_type && t.ticker) {
          const st = stocksMap.get(t.ticker);
          const cur = st?.currency || "KRW";
          const up = t.trade_type === "매수" ? t.buy_price : t.sell_price;
          const unit = cur === "USD" ? "$" + (up ?? 0).toFixed(2) : Math.round(up ?? 0).toLocaleString("ko-KR") + "원";
          trades.push({ id: t.id, date: t.trade_date, acct: t.account, type: t.trade_type as "매수"|"매도", stockName: t.stock_name || t.ticker, ticker: t.ticker || undefined, qty: t.quantity ?? 0, unit, buyPrice: t.buy_price || undefined, sellPrice: t.sell_price || undefined, profitLoss: (t as any).profit_loss || undefined, profitRate: (t as any).profit_rate || undefined });
        } else if (t.account_transfer) {
          trades.push({ id: t.id, date: t.trade_date, acct: t.account, type: t.account_transfer as "입금"|"출금", stockName: "-", qty: 0, unit: Math.round(t.transfer_amount ?? 0).toLocaleString("ko-KR") + "원", transferAmount: t.transfer_amount || undefined });
        }
      }
      trades.sort((a, b) => b.date.localeCompare(a.date));
      setAllTrades(trades);

      // 계좌별 누적 투입금
      const investedMap: Record<string, number> = {};
      for (const acct of ACCT_LIST_EX_ALL) {
        investedMap[acct] = transactions
          .filter((t) => t.account === acct && t.account_transfer)
          .reduce((sum, t) => t.account_transfer === "입금" ? sum + (t.transfer_amount || 0) : sum - (t.transfer_amount || 0), 0);
      }
      setAcctInvested(investedMap);

      setStocks(stocksArr);
      setCash(cashMap);
      setPerfDays(perf);
      setAccounts(accts);
      setLoading(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "데이터 로드 실패";
      setError(msg);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return {
    stocks,
    acctInvested,
    allTrades,
    cash,
    perfDays,
    agg: buildAgg(perfDays),
    accounts,
    summary,
    loading,
    error,
    refresh: load,
  };
}
