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
    dailyProfit: 0, dailyReturn: 0,
  });
  const [dailySettlement, setDailySettlement] = useState<DailySettlement[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setLastUpdated(new Date());
  }, []);

  const fetchPrices = useCallback(async (baseHoldings: AccountHolding[]) => {
    const uniqueTickers = [...new Set(baseHoldings.map(h => h.ticker))];
    const priceMap = new Map<string, { price: number; dailyChange: number }>();

    await Promise.all(uniqueTickers.map(async ticker => {
      try {
        const market = baseHoldings.find(h => h.ticker === ticker)?.currency === 'USD' ? 'US' : 'KR';
        const res = await fetch(`/api/stock?ticker=${ticker}&market=${market}`);
        const data = await res.json();
        if (data.price) priceMap.set(ticker, { price: data.price, dailyChange: data.dailyChange });
      } catch {}
    }));

    return baseHoldings.map(h => {
      const priceData = priceMap.get(h.ticker);
      if (!priceData) return h;
      const curr_price = priceData.price;
      const valuation = curr_price * h.quantity;
      const profit = (curr_price - h.avg_price) * h.quantity;
      const return_rate = h.avg_price > 0 ? ((curr_price - h.avg_price) / h.avg_price) * 100 : 0;
      return { ...h, curr_price, valuation, profit, return_rate, daily_change: priceData.dailyChange };
    });
  }, []);

  const loadAll = useCallback(async () => {
    const [transRes, incomeRes, balanceRes] = await Promise.all([
      fetch('/api/transactions'),
      fetch('/api/cash-income'),
      fetch('/api/cash-balance'),
    ]);

    const [transData, incomeData, balanceData]: [Transaction[], CashIncome[], CashBalance[]] = await Promise.all([
      transRes.json(),
      incomeRes.json(),
      balanceRes.json(),
    ]);

    setTransactions(transData);
    setCashIncomes(incomeData);
    setCashBalances(balanceData);

    // 현금 소득을 수익금에 합산
    const cashIncomeTotal = incomeData.reduce((s, c) => s + c.amount, 0);
    const calcedSummary = calcSummary(transData);
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

    setSummary(prev => ({
      ...prev,
      currMonthValue,
      totalInvested,
    }));
    setLastUpdated(new Date());
  }, [fetchPrices]);

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
      onRefresh={handleRefresh}
      isRefreshing={isRefreshing}
      lastUpdated={lastUpdated}
      accountFilter={accountFilter}
      onAccountFilterChange={handleAccountFilterChange}
    />
  );
}
