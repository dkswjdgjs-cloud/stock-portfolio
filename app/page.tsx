'use client';
import { useState, useEffect, useCallback, useRef, startTransition } from 'react';
import Dashboard from '@/components/Dashboard';
import { Transaction, AccountHolding, SummaryData, DailySettlement, CashIncome, CashBalance } from '@/types';
import { calcSummary, calcDailySettlement } from '@/lib/dataService';
import { calcHoldings } from '@/lib/calcHoldings';

export default function Home() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashIncomes, setCashIncomes] = useState<CashIncome[]>([]);
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([]);
  const [holdings, setHoldings] = useState<AccountHolding[]>([]);
  const [accountFilter, setAccountFilter] = useState('전체');
  const [summary, setSummary] = useState<SummaryData>({
    prevMonthValue: 0, currMonthInvestment: 0, currMonthValue: 0,
    cumulativeProfit: 0, cumulativeReturn: 0, annualProfit: 0,
    annualReturn: 0, monthlyProfit: 0, monthlyReturn: 0,
    dailyProfit: 0, dailyReturn: 0, totalInvested: 0,
    prevYearValuation: 0, prevYearInvested: 0, prevMonthValuation: 0, prevMonthInvested: 0,
  });
  const [dailySettlement, setDailySettlement] = useState<DailySettlement[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  const priceCache = useRef<Map<string, { price: number; priceOriginal: number; dailyChange: number; exchangeRate: number; ts: number }>>(new Map());
  const allHoldingsRef = useRef<AccountHolding[]>([]);
  const accountFilterRef = useRef<string>('전체');
  const isLoadingRef = useRef<boolean>(false);
  const loadAllRef = useRef<((forceRefresh?: boolean) => Promise<void>) | undefined>(undefined);

  useEffect(() => { setMounted(true); setLastUpdated(new Date()); }, []);
  useEffect(() => { accountFilterRef.current = accountFilter; }, [accountFilter]);

  const applyFilter = useCallback((allH: AccountHolding[], filter: string): AccountHolding[] => {
    const filtered = filter === '전체' ? allH : allH.filter(h => h.account === filter);
    const totalVal = filtered.reduce((s, h) => s + h.valuation, 0);
    return filtered.map(h => ({ ...h, weight: totalVal > 0 ? (h.valuation / totalVal) * 100 : 0 }));
  }, []);

  const fetchPrices = useCallback(async (baseHoldings: AccountHolding[], forceRefresh = false): Promise<AccountHolding[]> => {
    const uniqueTickers = [...new Set(baseHoldings.map(h => h.ticker))];
    const now = Date.now();
    const CACHE_TTL = 60 * 1000;
    await Promise.all(uniqueTickers.map(async ticker => {
      const cached = priceCache.current.get(ticker);
      if (!forceRefresh && cached && now - cached.ts < CACHE_TTL) return;
      try {
        const market = baseHoldings.find(h => h.ticker === ticker)?.currency === 'USD' ? 'US' : 'KR';
        const res = await fetch(`/api/stock?ticker=${ticker}&market=${market}`);
        const data = await res.json();
        if (data.price) {
          const rate = (market === 'US' && data.exchangeRate) ? data.exchangeRate : 1;
          priceCache.current.set(ticker, {
            price: data.price * rate, priceOriginal: data.price,
            dailyChange: (data.dailyChange || 0) * rate,
            exchangeRate: rate, ts: now,
          });
        }
      } catch {}
    }));
    return baseHoldings.map(h => {
      const priceData = priceCache.current.get(h.ticker);
      if (!priceData) return h;
      const isUSD = h.currency === 'USD';
      const rate = priceData.exchangeRate || 1;
      const curr_price = priceData.priceOriginal || priceData.price;
      const valuationKRW = priceData.price * h.quantity;
      const avgPriceKRW = isUSD ? h.avg_price * rate : h.avg_price;
      const profit = (priceData.price - avgPriceKRW) * h.quantity;
      const return_rate = avgPriceKRW > 0 ? ((priceData.price - avgPriceKRW) / avgPriceKRW) * 100 : 0;
      const dailyChangeKRW = priceData.dailyChange;
      const prevPriceKRW = priceData.price - dailyChangeKRW;
      const daily_change_rate = prevPriceKRW > 0 ? (dailyChangeKRW / prevPriceKRW) * 100 : 0;
      return { ...h, curr_price, valuation: valuationKRW, profit, return_rate, daily_change: priceData.dailyChange, daily_change_rate };
    });
  }, []);

  const loadSnapshots = useCallback(async () => {
    const res = await fetch('/api/snapshot');
    const data = await res.json();
    setSnapshots(data || []);
  }, []);

  const loadAll = useCallback(async (forceRefresh = false) => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      const [transRes, incomeRes, balanceRes, snapRes] = await Promise.all([
        fetch('/api/transactions'), fetch('/api/cash-income'),
        fetch('/api/cash-balance'), fetch('/api/snapshot'),
      ]);
      const [transData, incomeData, balanceData, currentSnapshots]: [Transaction[], CashIncome[], CashBalance[], any[]] = await Promise.all([
        transRes.json(), incomeRes.json(), balanceRes.json(), snapRes.json(),
      ]);
      setTransactions(transData);
      setCashIncomes(incomeData);
      setCashBalances(balanceData);
      setSnapshots(currentSnapshots || []);

      const cashIncomeTotal = incomeData.reduce((s, c) => s + c.amount, 0);
      const calcedSummary = calcSummary(transData, currentSnapshots || []);
      calcedSummary.cumulativeProfit += cashIncomeTotal;
      setSummary(calcedSummary);
      setDailySettlement(calcDailySettlement(transData));

      const baseHoldingsAll = calcHoldings(transData, '전체');
      const holdingsAllWithPrices = await fetchPrices(baseHoldingsAll, forceRefresh);
      allHoldingsRef.current = holdingsAllWithPrices;

      const totalValAll = holdingsAllWithPrices.reduce((s, h) => s + h.valuation, 0);
      const cashTotal = balanceData.reduce((s, b) => s + b.balance, 0);
      const currMonthValue = totalValAll + cashTotal;

      if (accountFilterRef.current === '전체') {
        setHoldings(applyFilter(holdingsAllWithPrices, '전체'));
      } else {
        const baseH = calcHoldings(transData, accountFilterRef.current);
        const holdingsFiltered = await fetchPrices(baseH, forceRefresh);
        const totalVal = holdingsFiltered.reduce((s, h) => s + h.valuation, 0);
        setHoldings(holdingsFiltered.map(h => ({
          ...h,
          weight: totalVal > 0 ? (h.valuation / totalVal) * 100 : 0,
        })));
      }

      const totalInvested = transData
        .filter((t: any) => t.account_transfer)
        .reduce((sum: number, t: any) => {
          const amount = t.transfer_amount || 0;
          return t.account_transfer === '입금' ? sum + amount : sum - amount;
        }, 0);

      setSummary(prev => {
        const { prevYearValuation = 0, prevYearInvested = 0, prevMonthValuation = 0, prevMonthInvested = 0 } = prev;
        const cumulativeProfit = currMonthValue - totalInvested;
        const cumulativeReturn = totalInvested > 0 ? (cumulativeProfit / totalInvested) * 100 : 0;
        const annualProfit = currMonthValue - prevYearValuation - (totalInvested - prevYearInvested);
        const annualBase = prevYearValuation + (totalInvested - prevYearInvested);
        const annualReturn = annualBase > 0 ? (annualProfit / annualBase) * 100 : 0;
        const monthlyProfit = currMonthValue - prevMonthValuation - (totalInvested - prevMonthInvested);
        const monthlyBase = prevMonthValuation + (totalInvested - prevMonthInvested);
        const monthlyReturn = monthlyBase > 0 ? (monthlyProfit / monthlyBase) * 100 : 0;
        const dailyProfit = holdingsAllWithPrices.reduce((sum: number, h: any) => sum + (h.daily_change || 0) * (h.quantity || 0), 0);
        const dailyReturn = currMonthValue > 0 ? (dailyProfit / (currMonthValue - dailyProfit)) * 100 : 0;
        return {
          ...prev, currMonthValue, totalInvested,
          cumulativeProfit, cumulativeReturn,
          annualProfit, annualReturn,
          monthlyProfit, monthlyReturn,
          dailyProfit, dailyReturn,
        };
      });
      setLastUpdated(new Date());
      await loadSnapshots();
    } finally {
      isLoadingRef.current = false;
    }
  }, [fetchPrices, loadSnapshots, applyFilter]);

  useEffect(() => {
    if (!mounted) return;
    loadAll();
    const interval = setInterval(() => loadAll(), 60000);
    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, loadAll]);

  const handleRefresh = async () => { setIsRefreshing(true); await loadAll(true); setIsRefreshing(false); };
  const handleAddTransaction = async (t: Omit<Transaction, 'id' | 'created_at' | 'profit_loss' | 'profit_rate'>) => {
    await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
    await loadAll(true);
  };
  const handleUpdateTransaction = async (t: Transaction) => {
    await fetch('/api/transactions', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
    await loadAll(true);
  };
  const handleDeleteTransaction = async (id: string) => {
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
    await loadAll(true);
  };
  const handleAddCashIncome = async (c: Omit<CashIncome, 'id' | 'created_at'>) => {
    await fetch('/api/cash-income', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    await loadAll(true);
  };
  const handleDeleteCashIncome = async (id: string) => {
    await fetch(`/api/cash-income?id=${id}`, { method: 'DELETE' });
    await loadAll(true);
  };
  const handleUpdateCashBalance = async (account: string, balance: number) => {
    await fetch('/api/cash-balance', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ account, balance }) });
    await loadAll(true);
  };
  const handleSaveSnapshot = async () => {
    const res = await fetch('/api/snapshot-save', { method: 'POST' });
    const data = await res.json();
    if (data.success) await loadSnapshots();
    alert('스냅샷 저장 완료!');
  };
  const handleAddSnapshot = async (data: { date: string; valuation: number; totalInvested: number; cumulativeProfit: number }) => {
    await fetch('/api/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    await loadSnapshots();
  };
  const handleUploadCSV = async (csvInput: string) => {
    const lines = csvInput.trim().split('\n').filter(l => l.trim());
    const rows = lines.map(line => {
      const parts = line.split(',');
      return {
        date: parts[0]?.trim().replace(/[^0-9-]/g, ''),
        valuation: parseFloat(parts[1]?.trim()) || 0,
        totalInvested: parseFloat(parts[2]?.trim()) || 0,
        cumulativeProfit: parseFloat(parts[3]?.trim()) || 0,
      };
    }).filter(r => r.date && r.date.length === 10);
    await fetch('/api/snapshot', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rows) });
    await loadSnapshots();
    alert(`${rows.length}개 데이터 업로드 완료!`);
  };
  const handleDeleteSnapshot = async (date: string) => {
    await fetch(`/api/snapshot?date=${date}`, { method: 'DELETE' });
    await loadSnapshots();
  };
  const handleAccountFilterChange = async (filter: string) => {
    setAccountFilter(filter);
    accountFilterRef.current = filter;
    if (allHoldingsRef.current.length === 0) return;
    if (filter === '전체') {
      // 전체: allHoldingsRef 그대로 사용 (ticker 기준 합산)
      setHoldings(applyFilter(allHoldingsRef.current, '전체'));
    } else {
      // 개별 계좌: transactions에서 해당 계좌만 재계산 후 가격 적용
      const baseHoldings = calcHoldings(transactions, filter);
      const holdingsWithPrices = await fetchPrices(baseHoldings); // 캐시 사용
      const totalVal = holdingsWithPrices.reduce((s, h) => s + h.valuation, 0);
      setHoldings(holdingsWithPrices.map(h => ({
        ...h,
        weight: totalVal > 0 ? (h.valuation / totalVal) * 100 : 0,
      })));
    }
  };

  if (!mounted) return null;

  return (
    <Dashboard
      transactions={transactions}
      cashIncomes={cashIncomes}
      cashBalances={cashBalances}
      summary={summary}
      holdings={holdings}
      dailySettlement={dailySettlement}
      onAddTransaction={handleAddTransaction}
      onUpdateTransaction={handleUpdateTransaction}
      onDeleteTransaction={handleDeleteTransaction}
      onAddCashIncome={handleAddCashIncome}
      onDeleteCashIncome={handleDeleteCashIncome}
      onUpdateCashBalance={handleUpdateCashBalance}
      snapshots={snapshots}
      onSaveSnapshot={handleSaveSnapshot}
      onAddSnapshot={handleAddSnapshot}
      onUploadCSV={handleUploadCSV}
      onDeleteSnapshot={handleDeleteSnapshot}
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      lastUpdated={lastUpdated}
      accountFilter={accountFilter}
      onAccountFilterChange={handleAccountFilterChange}
    />
  );
}
