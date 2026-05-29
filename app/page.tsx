'use client';
import { useState, useEffect, useCallback } from 'react';
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
  const [csvInput, setCsvInput] = useState('');
  const [snapshotForm, setSnapshotForm] = useState({
    date: new Date().toISOString().split('T')[0],
    valuation: '',
    totalInvested: '',
    cumulativeProfit: '',
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLastUpdated(new Date());
  }, []);

  const fetchPrices = useCallback(async (baseHoldings: AccountHolding[]) => {
    const uniqueTickers = [...new Set(baseHoldings.map(h => h.ticker))];
    const priceMap = new Map<string, { price: number; priceOriginal: number; dailyChange: number; exchangeRate: number }>();

    await Promise.all(uniqueTickers.map(async ticker => {
      try {
        const market = baseHoldings.find(h => h.ticker === ticker)?.currency === 'USD' ? 'US' : 'KR';
        const res = await fetch(`/api/stock?ticker=${ticker}&market=${market}`);
        const data = await res.json();
        if (data.price) {
            const rate = (market === 'US' && data.exchangeRate) ? data.exchangeRate : 1;
            priceMap.set(ticker, { price: data.price * rate, priceOriginal: data.price, dailyChange: data.dailyChange * rate, exchangeRate: rate });
          }
      } catch {}
    }));

    return baseHoldings.map(h => {
      const priceData = priceMap.get(h.ticker);
      if (!priceData) return h;
      const isUSD = h.currency === 'USD';
      const rate = priceData.exchangeRate || 1;
      const curr_price = priceData.priceOriginal || priceData.price; // 표시용: 달러 그대로
      const valuationKRW = priceData.price * h.quantity; // 원화 평가액
      const avgPriceKRW = isUSD ? h.avg_price * rate : h.avg_price;
      const profit = (priceData.price - avgPriceKRW) * h.quantity;
      const return_rate = avgPriceKRW > 0 ? ((priceData.price - avgPriceKRW) / avgPriceKRW) * 100 : 0;
      return { ...h, curr_price, valuation: valuationKRW, profit, return_rate, daily_change: priceData.dailyChange };
    });
  }, []);

  const loadSnapshots = useCallback(async () => {
    const res = await fetch('/api/snapshot');
    const data = await res.json();
    setSnapshots(data || []);
  }, []);

  const loadAll = useCallback(async () => {
    const [transRes, incomeRes, balanceRes, snapRes] = await Promise.all([
      fetch('/api/transactions'),
      fetch('/api/cash-income'),
      fetch('/api/cash-balance'),
      fetch('/api/snapshot'),
    ]);

    const [transData, incomeData, balanceData, currentSnapshots]: [Transaction[], CashIncome[], CashBalance[], any[]] = await Promise.all([
      transRes.json(),
      incomeRes.json(),
      balanceRes.json(),
      snapRes.json(),
    ]);

    setTransactions(transData);
    setCashIncomes(incomeData);
    setCashBalances(balanceData);
    setSnapshots(currentSnapshots || []);

    // 현금 소득을 수익금에 합산
    const cashIncomeTotal = incomeData.reduce((s, c) => s + c.amount, 0);
    const calcedSummary = calcSummary(transData, currentSnapshots || []);
    calcedSummary.cumulativeProfit += cashIncomeTotal;

    // 현재 평가액은 holdings 계산 후 채워짐 (아래에서 설정)
    setSummary(calcedSummary);
    setDailySettlement(calcDailySettlement(transData));

    const baseHoldings = calcHoldings(transData, '전체');
    const holdingsWithPrices = await fetchPrices(baseHoldings);
    const totalVal = holdingsWithPrices.reduce((s, h) => s + h.valuation, 0);
    const cashTotal = balanceData.reduce((s, b) => s + b.balance, 0);
    const finalHoldings = holdingsWithPrices.map(h => ({
      ...h,
      weight: totalVal > 0 ? (h.valuation / totalVal) * 100 : 0,
    }));
    setHoldings(finalHoldings);

    // 현재 평가액 = 보유종목 평가액 합계 + 현금성 자산
    const currMonthValue = totalVal + cashTotal;

    // 누적 투입액
    const totalInvested = transData
      .filter((t: any) => t.account_transfer)
      .reduce((sum: number, t: any) => {
        const amount = t.transfer_amount || 0;
        return t.account_transfer === '입금' ? sum + amount : sum - amount;
      }, 0);

    setSummary(prev => {
      const prevYearValuation = prev.prevYearValuation || 0;
      const prevYearInvested = prev.prevYearInvested || 0;
      const prevMonthValuation = prev.prevMonthValuation || 0;
      const prevMonthInvested = prev.prevMonthInvested || 0;

      // 누적수익금 = 현재평가액 - 현재투자원금
      const cumulativeProfit = currMonthValue - totalInvested;
      const cumulativeReturn = totalInvested > 0 ? (cumulativeProfit / totalInvested) * 100 : 0;

      // 연수익금 = 현재평가액 - 전년도말 평가액 - (현재투자원금 - 전년도말 투자원금)
      const annualProfit = currMonthValue - prevYearValuation - (totalInvested - prevYearInvested);
      const annualBase = prevYearValuation + (totalInvested - prevYearInvested);
      const annualReturn = annualBase > 0 ? (annualProfit / annualBase) * 100 : 0;

      // 월수익금 = 현재평가액 - 전월말 평가액 - (현재투자원금 - 전월말 투자원금)
      const monthlyProfit = currMonthValue - prevMonthValuation - (totalInvested - prevMonthInvested);
      const monthlyBase = prevMonthValuation + (totalInvested - prevMonthInvested);
      const monthlyReturn = monthlyBase > 0 ? (monthlyProfit / monthlyBase) * 100 : 0;

      // 일수익금 = 보유종목 일일등락금액 * 수량 합계
      const dailyProfit = holdingsWithPrices.reduce((sum: number, h: any) => {
        return sum + (h.daily_change || 0) * (h.quantity || 0);
      }, 0);
      const dailyReturn = currMonthValue > 0 ? (dailyProfit / (currMonthValue - dailyProfit)) * 100 : 0;

      return {
        ...prev,
        currMonthValue,
        totalInvested,
        cumulativeProfit,
        cumulativeReturn,
        annualProfit,
        annualReturn,
        monthlyProfit,
        monthlyReturn,
        dailyProfit,
        dailyReturn,
      };
    });
    setLastUpdated(new Date());
    await loadSnapshots();
  }, [fetchPrices, loadSnapshots]);

  useEffect(() => {
    if (mounted) {
      loadAll();
      const interval = setInterval(loadAll, 60000);
      return () => clearInterval(interval);
    }
  }, [mounted, loadAll]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAll();
    setIsRefreshing(false);
  };

  const handleAddTransaction = async (t: Omit<Transaction, 'id' | 'created_at' | 'profit_loss' | 'profit_rate'>) => {
    await fetch('/api/transactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    });
    await loadAll();
  };

  const handleUpdateTransaction = async (t: Transaction) => {
    await fetch('/api/transactions', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(t),
    });
    await loadAll();
  };

  const handleDeleteTransaction = async (id: string) => {
    await fetch(`/api/transactions?id=${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const handleAddCashIncome = async (c: Omit<CashIncome, 'id' | 'created_at'>) => {
    await fetch('/api/cash-income', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(c),
    });
    await loadAll();
  };

  const handleDeleteCashIncome = async (id: string) => {
    await fetch(`/api/cash-income?id=${id}`, { method: 'DELETE' });
    await loadAll();
  };

  const handleUpdateCashBalance = async (account: string, balance: number) => {
    await fetch('/api/cash-balance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account, balance }),
    });
    await loadAll();
  };

  const handleSaveSnapshot = async () => {
    const res = await fetch('/api/snapshot-save', { method: 'POST' });
    const data = await res.json();
    if (data.success) await loadSnapshots();
    alert('스냅샷 저장 완료!');
  };

  const handleAddSnapshot = async (data: {date: string; valuation: number; totalInvested: number; cumulativeProfit: number}) => {
    await fetch('/api/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
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
    console.log('CSV rows sample:', rows.slice(0, 3));
    await fetch('/api/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rows),
    });
    await loadSnapshots();
    setCsvInput('');
    alert(`${rows.length}개 데이터 업로드 완료!`);
  };

  const handleDeleteSnapshot = async (date: string) => {
    await fetch(`/api/snapshot?date=${date}`, { method: 'DELETE' });
    await loadSnapshots();
  };

  const handleAccountFilterChange = async (filter: string) => {
    setAccountFilter(filter);
    const baseHoldings = calcHoldings(transactions, filter);
    const holdingsWithPrices = await fetchPrices(baseHoldings);
    const totalVal = holdingsWithPrices.reduce((s, h) => s + h.valuation, 0);
    setHoldings(holdingsWithPrices.map(h => ({
      ...h,
      weight: totalVal > 0 ? (h.valuation / totalVal) * 100 : 0,
    })));
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
