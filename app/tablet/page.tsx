'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AccountHolding, Transaction, CashIncome, CashBalance } from '@/types';
import { calcHoldings } from '@/lib/calcHoldings';
import { calcSummary } from '@/lib/dataService';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell, ReferenceLine } from 'recharts';

const COLORS = ['#6366f1','#22d3ee','#3b82f6','#a78bfa','#2dd4bf','#f59e0b','#ec4899','#10b981'];
const ACCOUNTS = ['전체', 'ISA', 'IRP', '연금저축', 'DC형 연금', '일반직투1', '일반직투2'];

function getIcon(ticker: string, name: string) {
  const colors = [
    { bg: '#6366f1', color: 'white' }, { bg: '#22d3ee', color: 'white' },
    { bg: '#3b82f6', color: 'white' }, { bg: '#a78bfa', color: 'white' },
    { bg: '#2dd4bf', color: 'white' }, { bg: '#f59e0b', color: 'white' },
  ];
  const label = ticker?.slice(0, 4) || name?.slice(0, 2) || '??';
  const idx = (ticker?.charCodeAt(0) || 0) % colors.length;
  return { label, ...colors[idx] };
}

const formatW = (v: number) => {
  if (Math.abs(v) >= 1e8) return `${(v/1e8).toFixed(1)}억`;
  if (Math.abs(v) >= 1e4) return `${(v/1e4).toFixed(0)}만`;
  return v.toLocaleString('ko-KR');
};
const formatWFull = (v: number) => `₩${Math.abs(v).toLocaleString('ko-KR')}`;
const pos = (v: number) => v >= 0 ? '#E24B4A' : '#378ADD';
const pct = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;

const PERIODS = [
  { label: '1개월', value: '1M' },
  { label: '6개월', value: '1Y' },
  { label: '3년', value: '3Y' },
];

export default function TabletPage() {
  const [holdings, setHoldings] = useState<AccountHolding[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([]);
  const [cashIncomes, setCashIncomes] = useState<CashIncome[]>([]);
  const [accountFilter, setAccountFilter] = useState('전체');
  const [selectedHolding, setSelectedHolding] = useState<AccountHolding | null>(null);
  const [summary, setSummary] = useState<any>({});
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [chartData, setChartData] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [period, setPeriod] = useState('1M');
  const [stockInfo, setStockInfo] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const touchStartX = useRef<number>(0);
  const [targetValue, setTargetValue] = useState(200000000);
  const [viewMode, setViewMode] = useState<'시세' | '평가'>('시세');
  const [showAccountView, setShowAccountView] = useState(true);
  const [pieFilter, setPieFilter] = useState('종목별');
  const [profitMode, setProfitMode] = useState('cumulative');
  const [graphFilter, setGraphFilter] = useState('daily');
  const [snapshotSearch, setSnapshotSearch] = useState('');
  const [highlightDate, setHighlightDate] = useState('');
  const [profitIdx, setProfitIdx] = useState(0);
  const PROFIT_LABELS = ['누적', '연', '월', '일'];
  const allHoldings = useRef<AccountHolding[]>([]);
  const priceCache = useRef<Map<string, any>>(new Map());
  const isLoadingRef = useRef(false);

  const fetchPrices = useCallback(async (base: AccountHolding[]): Promise<AccountHolding[]> => {
    const now = Date.now();
    const CACHE_TTL = 60 * 1000;
    await Promise.all(base.map(async h => {
      const cached = priceCache.current.get(h.ticker);
      if (cached && now - cached.ts < CACHE_TTL) return;
      try {
        const market = h.currency === 'USD' ? 'US' : 'KR';
        const res = await fetch(`/api/stock?ticker=${h.ticker}&market=${market}`);
        const data = await res.json();
        const rate = (market === 'US' && data.exchangeRate) ? data.exchangeRate : 1;
        priceCache.current.set(h.ticker, {
          price: data.price * rate, priceOriginal: data.price,
          dailyChange: (data.dailyChange || 0) * rate,
          exchangeRate: rate, ts: now,
        });
      } catch {}
    }));
    return base.map(h => {
      const pd = priceCache.current.get(h.ticker);
      if (!pd) return h;
      const isUSD = h.currency === 'USD';
      const rate = pd.exchangeRate || 1;
      const curr_price = pd.priceOriginal || pd.price;
      const valuationKRW = pd.price * h.quantity;
      const avgPriceKRW = isUSD ? h.avg_price * rate : h.avg_price;
      const profit = (pd.price - avgPriceKRW) * h.quantity;
      const return_rate = avgPriceKRW > 0 ? ((pd.price - avgPriceKRW) / avgPriceKRW) * 100 : 0;
      const prevPriceKRW = pd.price - pd.dailyChange;
      const daily_change_rate = prevPriceKRW > 0 ? (pd.dailyChange / prevPriceKRW) * 100 : 0;
      return { ...h, curr_price, valuation: valuationKRW, profit, return_rate, daily_change: pd.dailyChange, daily_change_rate };
    });
  }, []);

  const applyFilter = useCallback((all: AccountHolding[], filter: string) => {
    const filtered = filter === '전체' ? all : all.filter(h => h.account === filter);
    const total = filtered.reduce((s, h) => s + h.valuation, 0);
    return filtered.map(h => ({ ...h, weight: total > 0 ? (h.valuation / total) * 100 : 0 }));
  }, []);

  const loadAll = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    try {
      const [transRes, incomeRes, balanceRes, snapRes] = await Promise.all([
        fetch('/api/transactions'), fetch('/api/cash-income'), fetch('/api/cash-balance'), fetch('/api/snapshot'),
      ]);
      const [transData, incomeData, balanceData, snapshotData] = await Promise.all([
        transRes.json(), incomeRes.json(), balanceRes.json(), snapRes.json(),
      ]);
      setTransactions(transData);
      setCashIncomes(incomeData);
      setCashBalances(balanceData);
      setSnapshots(snapshotData || []);
      const base = calcHoldings(transData, '전체');
      const withPrices = await fetchPrices(base);
      allHoldings.current = withPrices;
      const filtered = applyFilter(withPrices, accountFilter);
      setHoldings(filtered);
      if (!selectedHolding && filtered.length > 0) setSelectedHolding(filtered[0]);

      // 현재가 반영 후 summary 계산
      const totalValAll = withPrices.reduce((s: number, h: any) => s + h.valuation, 0);
      const cashTotal = balanceData.reduce((s: number, b: any) => s + b.balance, 0);
      const currMonthValue = totalValAll + cashTotal;
      const totalInvested = transData
        .filter((t: any) => t.account_transfer)
        .reduce((sum: number, t: any) => t.account_transfer === '입금' ? sum + (t.transfer_amount || 0) : sum - (t.transfer_amount || 0), 0);
      const cashIncomeTotal = incomeData.reduce((s: number, c: any) => s + c.amount, 0);
      const calcedSummary = calcSummary(transData, snapshotData || []);
      calcedSummary.cumulativeProfit += cashIncomeTotal;
      const cumulativeProfit = currMonthValue - totalInvested + cashIncomeTotal;
      const cumulativeReturn = totalInvested > 0 ? (cumulativeProfit / totalInvested) * 100 : 0;
      const dailyProfit = withPrices.reduce((sum: number, h: any) => sum + (h.daily_change || 0) * (h.quantity || 0), 0);
      const dailyReturn = currMonthValue > 0 ? (dailyProfit / (currMonthValue - dailyProfit)) * 100 : 0;
      // 연/월 수익 계산 (snapshot 기반)
      const sortedSnaps = [...(snapshotData || [])].sort((a: any, b: any) => a.snapshot_date.localeCompare(b.snapshot_date));
      const thisYear = new Date().getFullYear();
      const thisMonth = new Date().getMonth() + 1;
      const prevYearSnap = [...sortedSnaps].filter((s: any) => s.snapshot_date.startsWith(`${thisYear - 1}`)).pop();
      const prevMonthStr = thisMonth === 1 ? `${thisYear - 1}-12` : `${thisYear}-${String(thisMonth - 1).padStart(2, '0')}`;
      const prevMonthSnap = [...sortedSnaps].filter((s: any) => s.snapshot_date.startsWith(prevMonthStr)).pop();

      const prevYearVal = prevYearSnap?.total_valuation || 0;
      const prevYearInv = prevYearSnap?.total_invested || 0;
      const prevMonthVal = prevMonthSnap?.total_valuation || 0;
      const prevMonthInv = prevMonthSnap?.total_invested || 0;

      const annualProfit = currMonthValue - prevYearVal - (totalInvested - prevYearInv);
      const annualBase = prevYearVal + (totalInvested - prevYearInv);
      const annualReturn = annualBase > 0 ? (annualProfit / annualBase) * 100 : 0;
      const monthlyProfit = currMonthValue - prevMonthVal - (totalInvested - prevMonthInv);
      const monthlyBase = prevMonthVal + (totalInvested - prevMonthInv);
      const monthlyReturn = monthlyBase > 0 ? (monthlyProfit / monthlyBase) * 100 : 0;

      setSummary({
        ...calcedSummary,
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
      });
    } finally {
      isLoadingRef.current = false;
    }
  }, [fetchPrices, applyFilter, accountFilter, selectedHolding]);

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    if (!selectedHolding) return;
    setChartLoading(true);
    const market = selectedHolding.currency === 'USD' ? 'US' : 'KR';
    fetch(`/api/stock-chart?ticker=${selectedHolding.ticker}&market=${market}&range=${period}`)
      .then(r => r.json())
      .then(d => setChartData(d.chartData || []))
      .finally(() => setChartLoading(false));
  }, [selectedHolding, period]);

  useEffect(() => {
    if (!selectedHolding || selectedHolding.currency === 'USD') { setStockInfo(null); return; }
    fetch(`/api/stock-info?ticker=${selectedHolding.ticker}&market=KR`)
      .then(r => r.json())
      .then(d => setStockInfo(d.info || null));
  }, [selectedHolding]);

  const handleAccountFilter = useCallback((filter: string) => {
    setAccountFilter(filter);
    if (filter === '전체') {
      const filtered = applyFilter(allHoldings.current, '전체');
      setHoldings(filtered);
      if (filtered.length > 0) setSelectedHolding(filtered[0]);
    } else {
      // 특정 계좌는 해당 계좌 transactions으로 재계산
      fetch('/api/transactions')
        .then(r => r.json())
        .then(async transData => {
          const base = calcHoldings(transData, filter);
          const withPrices = await fetchPrices(base);
          const total = withPrices.reduce((s, h) => s + h.valuation, 0);
          const filtered = withPrices.map(h => ({ ...h, weight: total > 0 ? (h.valuation / total) * 100 : 0 }));
          setHoldings(filtered);
          if (filtered.length > 0) setSelectedHolding(filtered[0]);
          else setSelectedHolding(null);
        });
    }
  }, [fetchPrices, applyFilter]);

  const totalVal = holdings.reduce((s, h) => s + h.valuation, 0);
  const totalCash = cashBalances.reduce((s, b) => s + b.balance, 0);
  const totalEval = totalVal + totalCash;

  // 선택 종목 거래 내역
  const stockTransactions = selectedHolding
    ? transactions.filter(t =>
        t.ticker === selectedHolding.ticker &&
        t.trade_type &&
        (accountFilter === '전체' || t.account === accountFilter)
      ).sort((a, b) => b.trade_date.localeCompare(a.trade_date))
    : [];

  const getPieData = () => {
    if (pieFilter === '종목별') {
      const data = holdings.map(h => ({ name: h.stock_name, ticker: h.ticker, value: h.valuation }));
      if (totalCash > 0) data.push({ name: '현금성 자산', ticker: 'CASH', value: totalCash });
      return data;
    }
    if (pieFilter === '섹터별') {
      const map = new Map<string, number>();
      holdings.forEach(h => map.set(h.sector || '기타', (map.get(h.sector || '기타') || 0) + h.valuation));
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
    }
    if (pieFilter === '국가별') {
      const map = new Map<string, number>();
      holdings.forEach(h => {
        const country = h.currency === 'USD' ? '해외' : '국내';
        map.set(country, (map.get(country) || 0) + h.valuation);
      });
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
    }
    return [];
  };

  const minClose = chartData.length > 0 ? Math.min(...chartData.map(d => d.close)) : 0;
  const maxClose = chartData.length > 0 ? Math.max(...chartData.map(d => d.close)) : 0;
  const isChartPos = chartData.length > 1
    ? chartData[chartData.length-1].close >= chartData[0].close : true;
  const formatDate = (d: string) => d ? `${d.slice(4,6)}.${d.slice(6,8)}` : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: '#f8fafc', overflow: 'hidden', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif' }}>

      {/* 전체 상단 헤더 */}
      <div style={{ background: 'white', borderBottom: '1px solid #e5e7eb', padding: '10px 20px', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#9ca3af', letterSpacing: '0.08em' }}>WEALTHFLOW</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f0fdf4', borderRadius: 20, padding: '3px 10px' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ color: '#10b981', fontSize: 9 }}>LIVE</span>
            </div>
            <button onClick={loadAll} style={{ background: '#f3f4f6', border: 'none', borderRadius: 20, padding: '3px 10px', cursor: 'pointer', fontSize: 14 }}>🔄</button>
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{PROFIT_LABELS[profitIdx]} 수익금</div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
          <div>
            <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>현재 평가액</p>
            <p style={{ fontSize: 24, fontWeight: 600, color: '#111827', margin: 0 }}>{formatWFull(Math.round(totalEval))}</p>
          </div>
          <div style={{ textAlign: 'right', cursor: 'pointer', userSelect: 'none' }} onClick={() => setProfitIdx(i => (i + 1) % 4)}>
            {(() => {
              const profits = [
                { profit: summary.cumulativeProfit || 0, rate: summary.cumulativeReturn || 0 },
                { profit: summary.annualProfit || 0, rate: summary.annualReturn || 0 },
                { profit: summary.monthlyProfit || 0, rate: summary.monthlyReturn || 0 },
                { profit: summary.dailyProfit || 0, rate: summary.dailyReturn || 0 },
              ];
              const cur = profits[profitIdx];
              return (
                <>
                  <p style={{ fontSize: 13, color: pos(cur.profit), margin: 0 }}>{cur.rate >= 0 ? '+' : ''}{cur.rate.toFixed(1)}%</p>
                  <p style={{ fontSize: 20, fontWeight: 600, color: pos(cur.profit), margin: '2px 0 0' }}>{cur.profit >= 0 ? '+' : ''}{formatWFull(Math.round(cur.profit))}</p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 가운데 영역 */}
      {/* 스와이프 영역 */}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onTouchStart={e => { touchStartX.current = e.touches[0].clientX; }}
        onTouchEnd={e => {
          const diff = touchStartX.current - e.changedTouches[0].clientX;
          if (diff > 50 && currentPage < 1) setCurrentPage(1);
          if (diff < -50 && currentPage > 0) setCurrentPage(0);
        }}
      >
        <div style={{ display: 'flex', width: '200%', height: '100%', transform: `translateX(${currentPage === 0 ? 0 : -50}%)`, transition: 'transform 0.3s ease' }}>

          {/* 1페이지: 계좌 내역 */}
          <div style={{ width: '50%', height: '100%', display: 'flex', overflow: 'hidden' }}>

      {/* 왼쪽 패널 */}
      <div style={{ width: 400, display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '8px', gap: 4 }}>

        {/* 필터 + 종목 리스트 하나의 박스 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {/* 계좌 필터 */}
          <div style={{ padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 16, padding: 2, flexShrink: 0 }}>
              {(['시세', '평가'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ fontSize: 11, padding: '3px 8px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: viewMode === m ? '#111827' : 'transparent',
                    color: viewMode === m ? 'white' : '#9ca3af', fontWeight: viewMode === m ? 600 : 500 }}>{m}</button>
              ))}
            </div>
            <button onClick={() => { setShowAccountView(true); setSelectedHolding(null); }}
              style={{ fontSize: 11, padding: '3px 8px', borderRadius: 14, border: 'none', cursor: 'pointer',
                background: showAccountView ? '#3b82f6' : '#f3f4f6',
                color: showAccountView ? 'white' : '#9ca3af', fontWeight: showAccountView ? 600 : 500, flexShrink: 0 }}>계좌</button>
            <select value={accountFilter} onChange={e => handleAccountFilter(e.target.value)}
              style={{ flex: 1, fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 7, padding: '3px 6px', color: '#111827', background: 'white', outline: 'none' }}>
              {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          {/* 종목 리스트 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
          {holdings.map((h, i) => {
            const ic = getIcon(h.ticker, h.stock_name);
            const isSelected = selectedHolding?.ticker === h.ticker;
            return (
              <div key={i} onClick={() => { setSelectedHolding(h); setShowAccountView(false); }}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', cursor: 'pointer',
                  background: isSelected ? '#f0f9ff' : 'white',
                  borderBottom: '1px solid #f3f4f6',
                  borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent' }}>
                <div style={{ width: 40, height: 40, borderRadius: 12, background: ic.bg, color: ic.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{ic.label}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.stock_name}</p>
                  <p style={{ fontSize: 12, color: '#9ca3af', margin: '2px 0 0' }}>평균 {h.avg_price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}{h.currency === 'KRW' ? '원' : '$'}</p>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  {viewMode === '시세' ? (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                        {h.currency === 'USD' ? `${h.curr_price.toFixed(2)}$` : h.curr_price.toLocaleString('ko-KR')}
                      </p>
                      <p style={{ fontSize: 12, color: pos(h.daily_change), margin: '2px 0 0' }}>
                        {(() => {
                          const dailyProfit = h.daily_change * h.quantity;
                          const rate = (h as any).daily_change_rate || 0;
                          return `${dailyProfit >= 0 ? '+' : ''}${Math.round(dailyProfit).toLocaleString('ko-KR')}원(${pct(rate)})`;
                        })()}
                      </p>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>
                        {formatWFull(h.valuation)}
                      </p>
                      <p style={{ fontSize: 12, color: pos(h.profit), margin: '2px 0 0' }}>
                        {h.profit >= 0 ? '+' : ''}{formatWFull(Math.round(h.profit))}({pct(h.return_rate)})
                      </p>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {/* 현금 */}
          {totalCash > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid #f3f4f6' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: '#10b981', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>CASH</div>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 500, color: '#111827', margin: 0 }}>현금성 자산</p>
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{formatWFull(totalCash)}</p>
            </div>
          )}
          </div>
        </div>

      </div>{/* 왼쪽 패널 끝 */}




      {/* 오른쪽 패널 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '8px 8px 8px 0', gap: 8, overflow: 'hidden' }}>
        {showAccountView ? (
          /* 계좌 뷰 */
          <>
            {/* 상단: 파이차트 + 구성비율 */}
            <div style={{ flexShrink: 0, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '16px', display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 500 }}>ASSET ALLOCATION</span>
                <select value={pieFilter} onChange={e => setPieFilter(e.target.value)}
                  style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 7, padding: '3px 8px', color: '#111827', background: 'white', outline: 'none' }}>
                  {['종목별', '섹터별', '국가별'].map(f => <option key={f}>{f}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {/* 파이차트 */}
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <PieChart width={240} height={240}>
                    <Pie data={getPieData()} cx={115} cy={115} innerRadius={65} outerRadius={110} dataKey="value" strokeWidth={0}>
                      {getPieData().map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                  </PieChart>
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
                    <p style={{ fontSize: 9, color: '#9ca3af', margin: '0 0 2px', letterSpacing: '0.05em' }}>MARKET VALUE</p>
                    <p style={{ fontSize: 13, fontWeight: 600, color: '#111827', margin: 0 }}>{formatWFull(Math.round(totalEval))}</p>
                  </div>
                </div>
                {/* 구성비율 리스트 */}
                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 220 }}>
                  {getPieData().map((d, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        <span style={{ fontSize: 12, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 12 }}>
                        <p style={{ fontSize: 12, color: '#111827', margin: 0 }}>{formatWFull(d.value)}</p>
                        <p style={{ fontSize: 11, color: '#10b981', margin: 0 }}>{totalEval > 0 ? (d.value / totalEval * 100).toFixed(2) : 0}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* 하단: 전체 거래내역 */}
            <div style={{ flex: 1, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: '0 0 8px', flexShrink: 0 }}>
                {accountFilter === '전체' ? '전체' : accountFilter} 거래 내역
              </p>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      {['날짜', '계좌', '구분', '종목', '수량', '단가', '손익', '수익률'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 6px', color: '#9ca3af', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...transactions]
                      .filter(t => accountFilter === '전체' || t.account === accountFilter)
                      .sort((a, b) => b.trade_date.localeCompare(a.trade_date))
                      .map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px 6px', color: '#6b7280', whiteSpace: 'nowrap' }}>{t.trade_date}</td>
                          <td style={{ padding: '6px 6px', color: '#6b7280', whiteSpace: 'nowrap', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.account}</td>
                          <td style={{ padding: '6px 6px', color: t.trade_type === '매수' ? '#E24B4A' : t.trade_type === '매도' ? '#378ADD' : '#6b7280', fontWeight: 500 }}>{t.trade_type || t.account_transfer || '-'}</td>
                          <td style={{ padding: '6px 6px', color: '#111827', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.stock_name || '-'}</td>
                          <td style={{ padding: '6px 6px', color: '#111827' }}>{t.quantity ? `${t.quantity}주` : '-'}</td>
                          <td style={{ padding: '6px 6px', color: '#111827' }}>{t.buy_price ? `${t.buy_price.toLocaleString('ko-KR')}원` : t.sell_price ? `${t.sell_price.toLocaleString('ko-KR')}원` : t.transfer_amount ? `${t.transfer_amount.toLocaleString('ko-KR')}원` : '-'}</td>
                          <td style={{ padding: '6px 6px', color: pos(t.profit_loss || 0) }}>{t.profit_loss ? formatWFull(t.profit_loss) : '-'}</td>
                          <td style={{ padding: '6px 6px', color: pos(t.profit_rate || 0) }}>{t.profit_rate ? pct(t.profit_rate) : '-'}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </>
        ) : selectedHolding ? (
          <>
            {/* 상단 블럭 - flex:1 */}
            <div style={{ flexShrink: 0, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
              {/* 종목 헤더 */}
              <div style={{ padding: '8px 16px', borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{selectedHolding.stock_name}</span>
                  <span style={{ fontSize: 11, color: '#9ca3af', background: '#f3f4f6', padding: '2px 8px', borderRadius: 6 }}>{selectedHolding.ticker} · {selectedHolding.currency === 'USD' ? '해외' : '국내'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span style={{ fontSize: 24, fontWeight: 600, color: '#111827' }}>
                        {selectedHolding.currency === 'USD' ? `$${selectedHolding.curr_price.toFixed(2)}` : `${selectedHolding.curr_price.toLocaleString('ko-KR')}원`}
                      </span>
                      <span style={{ fontSize: 13, color: pos(selectedHolding.daily_change), fontWeight: 500 }}>
                        {selectedHolding.daily_change >= 0 ? '▲' : '▼'} {pct((selectedHolding as any).daily_change_rate || 0)}
                      </span>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 2px' }}>평가손익</p>
                    <p style={{ fontSize: 24, fontWeight: 600, color: pos(selectedHolding.profit), margin: 0 }}>{pct(selectedHolding.return_rate)}</p>
                    <p style={{ fontSize: 12, color: pos(selectedHolding.profit), margin: '2px 0 0' }}>{selectedHolding.profit >= 0 ? '+' : ''}{formatWFull(selectedHolding.profit)}</p>
                  </div>
                </div>
              </div>
              {/* 차트 + 종목정보 - flex:1 */}
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', flex: 1, overflow: 'hidden' }}>
                {/* 왼쪽: 기간버튼 + 차트 + 시가고가저가거래량 */}
                <div style={{ padding: '12px 16px', borderRight: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexShrink: 0 }}>
                    {PERIODS.map(p => (
                      <button key={p.value} onClick={() => setPeriod(p.value)}
                        style={{ fontSize: 11, padding: '3px 10px', borderRadius: 6,
                          border: period === p.value ? '1px solid #3b82f6' : '1px solid #e5e7eb',
                          background: period === p.value ? '#eff6ff' : 'white',
                          color: period === p.value ? '#3b82f6' : '#6b7280', cursor: 'pointer' }}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div style={{ height: 180, minHeight: 0 }}>
                    {chartLoading ? (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>로딩 중...</div>
                    ) : chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                          <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#9ca3af' }}
                            tickFormatter={formatDate} interval={Math.floor(chartData.length / 4)} />
                          <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} width={45}
                            domain={[minClose * 0.98, maxClose * 1.02]}
                            tickFormatter={v => selectedHolding.currency === 'USD' ? `$${v.toFixed(0)}` : `${(v/1000).toFixed(0)}k`} />
                          <Tooltip contentStyle={{ fontSize: '11px', borderRadius: '8px' }}
                            formatter={(v: any) => [selectedHolding.currency === 'USD' ? `$${Number(v).toFixed(2)}` : `${Number(v).toLocaleString('ko-KR')}원`, '종가']}
                            labelFormatter={(d: any) => String(d)} />
                          <Line type="monotone" dataKey="close" stroke={isChartPos ? '#E24B4A' : '#378ADD'}
                            strokeWidth={2} dot={false} isAnimationActive={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    ) : (
                      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 13 }}>데이터 없음</div>
                    )}
                  </div>
                  {/* 시가/고가/저가/거래량 */}
                  {chartData.length > 0 && (() => {
                    const last = chartData[chartData.length - 1];
                    return (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6, marginTop: 8, flexShrink: 0 }}>
                        {[
                          { label: '시가', value: last.open?.toLocaleString('ko-KR') },
                          { label: '고가', value: last.high?.toLocaleString('ko-KR') },
                          { label: '저가', value: last.low?.toLocaleString('ko-KR') },
                          { label: '거래량', value: last.volume?.toLocaleString('ko-KR') },
                        ].map(item => (
                          <div key={item.label} style={{ background: '#f9fafb', borderRadius: 8, padding: '6px 8px' }}>
                            <p style={{ fontSize: 10, color: '#9ca3af', margin: '0 0 2px' }}>{item.label}</p>
                            <p style={{ fontSize: 12, fontWeight: 500, color: '#111827', margin: 0 }}>{item.value || '-'}</p>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
                {/* 오른쪽: 종목정보 리스트 */}
                <div style={{ padding: '12px 16px', overflowY: 'auto' }}>
                  <p style={{ fontSize: 11, color: '#9ca3af', margin: '0 0 8px', fontWeight: 500 }}>종목 정보</p>
                  {[
                    { label: '보유 수량', value: `${selectedHolding.quantity}주` },
                    { label: '평균 단가', value: selectedHolding.currency === 'USD' ? `$${selectedHolding.avg_price.toFixed(2)}` : `${selectedHolding.avg_price.toLocaleString('ko-KR')}원` },
                    { label: '평가 금액', value: formatWFull(selectedHolding.valuation) },
                    { label: '시가총액', value: stockInfo?.mktCap || '-' },
                    { label: 'PER', value: stockInfo?.per || '-' },
                    { label: 'PBR', value: stockInfo?.pbr || '-' },
                    { label: 'EPS', value: stockInfo?.eps || '-' },
                    { label: '거래량(평균)', value: stockInfo?.avgVol || '-' },
                  ].map(item => (
                    <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #f3f4f6' }}>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>{item.label}</span>
                      <span style={{ fontSize: 12, color: '#111827', fontWeight: 500 }}>{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            {/* 거래 내역 - 고정 높이 박스 */}
            <div style={{ flex: 1, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#111827', margin: '0 0 8px', flexShrink: 0 }}>
                {selectedHolding.stock_name} 거래 내역
                {accountFilter !== '전체' && ` · ${accountFilter}`}
              </p>
              {stockTransactions.length === 0 ? (
                <p style={{ fontSize: 12, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>거래 내역이 없습니다</p>
              ) : (
                <div style={{ overflowY: 'auto', flex: 1 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                        {['날짜', '계좌', '구분', '수량', '단가', '손익', '수익률'].map(h => (
                          <th key={h} style={{ textAlign: 'left', padding: '6px 6px', color: '#9ca3af', fontWeight: 500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {stockTransactions.map((t, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px 6px', color: '#6b7280', whiteSpace: 'nowrap' }}>{t.trade_date}</td>
                          <td style={{ padding: '6px 6px', color: '#6b7280', whiteSpace: 'nowrap', maxWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.account}</td>
                          <td style={{ padding: '6px 6px', color: t.trade_type === '매수' ? '#E24B4A' : '#378ADD', fontWeight: 500 }}>{t.trade_type}</td>
                          <td style={{ padding: '6px 6px', color: '#111827' }}>{t.quantity}주</td>
                          <td style={{ padding: '6px 6px', color: '#111827' }}>{t.trade_type === '매수' ? `${(t.buy_price || 0).toLocaleString('ko-KR')}원` : `${(t.sell_price || 0).toLocaleString('ko-KR')}원`}</td>
                          <td style={{ padding: '6px 6px', color: pos(t.profit_loss || 0) }}>{t.profit_loss ? formatWFull(t.profit_loss) : '-'}</td>
                          <td style={{ padding: '6px 6px', color: pos(t.profit_rate || 0) }}>{t.profit_rate ? pct(t.profit_rate) : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af' }}>
            <p>종목을 선택해주세요</p>
          </div>
        )}
      </div>
          </div>{/* 1페이지 끝 */}

          {/* 2페이지: 일일 결산 */}
          <div style={{ width: '50%', height: '100%', display: 'flex', flexDirection: 'column', padding: '8px', gap: 8, overflow: 'hidden' }}>
            {/* 그래프 박스 */}
            <div style={{ flexShrink: 0, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>성과 추이 MATRIX</span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <select value={profitMode} onChange={e => setProfitMode(e.target.value)}
                    style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', color: '#1a1a1a', background: 'white', outline: 'none' }}>
                    <option value="cumulative">누적</option>
                    <option value="yearly">년도별</option>
                    <option value="monthly">월별</option>
                    <option value="daily">일별</option>
                  </select>
                  {profitMode === 'cumulative' && (
                    <select value={graphFilter} onChange={e => setGraphFilter(e.target.value)}
                      style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', color: '#1a1a1a', background: 'white', outline: 'none' }}>
                      <option value="daily">일별</option>
                      <option value="monthly">월별</option>
                      <option value="quarterly">분기별</option>
                      <option value="yearly">년도별</option>
                    </select>
                  )}
                </div>
              </div>
              {(() => {
                const sorted = [...snapshots].sort((a,b) => a.snapshot_date.localeCompare(b.snapshot_date));
                const calcProfitData = () => {
                  if (profitMode === 'yearly') {
                    const years = [...new Set(sorted.map((s:any) => s.snapshot_date.slice(0,4)))];
                    return years.map((year:any, yi:number) => {
                      const yearSnaps = sorted.filter((s:any) => s.snapshot_date.startsWith(year));
                      const last = yearSnaps[yearSnaps.length-1] as any;
                      const prevYearSnaps = yi === 0 ? [] : sorted.filter((s:any) => s.snapshot_date.startsWith((years as any)[yi-1]));
                      const prevLast = prevYearSnaps.length ? prevYearSnaps[prevYearSnaps.length-1] as any : null;
                      const prevVal = prevLast ? prevLast.total_valuation||0 : 0;
                      const prevInv = prevLast ? prevLast.total_invested||0 : 0;
                      const profit = (last.total_valuation||0) - prevVal - ((last.total_invested||0) - prevInv);
                      return { label: `${year}년`, profit };
                    });
                  }
                  if (profitMode === 'monthly') {
                    const months = [...new Set(sorted.map((s:any) => s.snapshot_date.slice(0,7)))];
                    return months.map((month:any, mi:number) => {
                      const monthSnaps = sorted.filter((s:any) => s.snapshot_date.startsWith(month));
                      const last = monthSnaps[monthSnaps.length-1] as any;
                      const prevMonthSnaps = mi === 0 ? [] : sorted.filter((s:any) => s.snapshot_date.startsWith((months as any)[mi-1]));
                      const prevLast = prevMonthSnaps.length ? prevMonthSnaps[prevMonthSnaps.length-1] as any : null;
                      const prevVal = prevLast ? prevLast.total_valuation||0 : 0;
                      const prevInv = prevLast ? prevLast.total_invested||0 : 0;
                      const profit = (last.total_valuation||0) - prevVal - ((last.total_invested||0) - prevInv);
                      return { label: month, profit };
                    });
                  }
                  if (profitMode === 'daily') {
                    return sorted.map((s:any, i:number) => {
                      const prev = i === 0 ? null : sorted[i-1] as any;
                      const prevVal = prev ? prev.total_valuation||0 : 0;
                      const prevInv = prev ? prev.total_invested||0 : 0;
                      const profit = (s.total_valuation||0) - prevVal - ((s.total_invested||0) - prevInv);
                      return { label: s.snapshot_date, profit };
                    });
                  }
                  return [];
                };
                if (profitMode !== 'cumulative') {
                  const profitData = calcProfitData();
                  return (
                    <ResponsiveContainer width="100%" height={280}>
                      <BarChart data={profitData} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 9 }} interval={profitMode === 'daily' ? 30 : 0} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v:any) => `${(v/1000000).toFixed(0)}M`} />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" />
                        <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }}
                          formatter={(v:any) => [<span style={{ color: Number(v) >= 0 ? '#E24B4A' : '#378ADD' }}>{formatWFull(Number(v))}</span>, '수익금']} />
                        <Bar dataKey="profit" name="수익금" isAnimationActive={false} fill="#E24B4A" label={false}>
                          {profitData.map((d:any, i:number) => (
                            <Cell key={i} fill={d.profit >= 0 ? '#E24B4A' : '#378ADD'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                }
                const filterSnapshots = () => {
                  if (graphFilter === 'daily') return snapshots;
                  const map = new Map<string, any>();
                  snapshots.forEach((s:any) => {
                    const d = new Date(s.snapshot_date);
                    let key = '';
                    if (graphFilter === 'monthly') key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
                    else if (graphFilter === 'quarterly') { const q = Math.floor(d.getMonth()/3); key = `${d.getFullYear()}-Q${q+1}`; }
                    else if (graphFilter === 'yearly') key = `${d.getFullYear()}`;
                    if (!map.has(key) || s.snapshot_date > map.get(key).snapshot_date) map.set(key, s);
                  });
                  return Array.from(map.values()).sort((a,b) => a.snapshot_date.localeCompare(b.snapshot_date));
                };
                const filtered = filterSnapshots();
                const xInterval = graphFilter === 'daily' ? 30 : 0;
                const xFormatter = (v:string) => {
                  if (graphFilter === 'yearly') return v?.slice(0,4);
                  return v?.slice(0,7);
                };
                return (
                  <ResponsiveContainer width="100%" height={280}>
                    <AreaChart data={filtered} margin={{ top: 5, right: 5, left: 5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="snapshot_date" tick={{ fill: '#64748b', fontSize: 9 }} interval={xInterval} tickFormatter={xFormatter} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 9 }} tickFormatter={(v:any) => `${(v/1000000).toFixed(0)}M`}
                        domain={[-10000000, (dataMax: number) => Math.ceil(dataMax * 1.05 / 10000000) * 10000000]} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" />
                      <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }}
                        formatter={(v:any) => formatWFull(Number(v))} />
                      <Area isAnimationActive={false} type="monotone" dataKey="total_valuation" name="평가액" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
                      <Area isAnimationActive={false} type="monotone" dataKey="total_invested" name="투자금" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                      <Area isAnimationActive={false} type="monotone" dataKey="total_profit" name="누적수익금" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>
            {/* 결산 데이터 박스 */}
            <div style={{ flex: 1, background: 'white', borderRadius: 12, border: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: '#1a1a1a', fontWeight: 500 }}>결산 데이터</span>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input type="date" value={snapshotSearch}
                    onChange={e => { setSnapshotSearch(e.target.value); setHighlightDate(e.target.value); }}
                    style={{ fontSize: 11, border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', color: '#1a1a1a', outline: 'none' }} />
                  <button onClick={() => { setSnapshotSearch(''); setHighlightDate(''); }}
                    style={{ fontSize: 11, color: '#9ca3af', background: 'none', border: 'none', cursor: 'pointer' }}>초기화</button>
                </div>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'white' }}>
                    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                      {['날짜', '평가액', '누적투자금', '누적수익금'].map(h => (
                        <th key={h} style={{ textAlign: 'left', padding: '6px 8px', color: '#9ca3af', fontWeight: 500 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[...snapshots]
                      .filter((s:any) => !snapshotSearch || s.snapshot_date.includes(snapshotSearch))
                      .sort((a:any, b:any) => b.snapshot_date.localeCompare(a.snapshot_date))
                      .map((s:any, i:number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f3f4f6' }}>
                          <td style={{ padding: '6px 8px', color: highlightDate === s.snapshot_date ? '#3b82f6' : '#6b7280', fontWeight: highlightDate === s.snapshot_date ? 600 : 400 }}>{s.snapshot_date}</td>
                          <td style={{ padding: '6px 8px', color: '#111827' }}>{formatWFull(s.total_valuation || 0)}</td>
                          <td style={{ padding: '6px 8px', color: '#111827' }}>{formatWFull(s.total_invested || 0)}</td>
                          <td style={{ padding: '6px 8px', color: pos(s.total_profit || 0) }}>{formatWFull(s.total_profit || 0)}</td>
                        </tr>
                      ))
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>{/* 2페이지 끝 */}

        </div>{/* 슬라이드 컨테이너 끝 */}
      </div>{/* 스와이프 영역 끝 */}
      {/* 전체 하단 합계 */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: 'white', flexShrink: 0, marginTop: 'auto' }}>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>선택 합계 · {holdings.length}종목 + 현금</p>
        <p style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>{formatWFull(Math.round(totalEval))}</p>
      </div>
    </div>
  );
}
