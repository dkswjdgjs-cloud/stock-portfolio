'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { AccountHolding, Transaction, CashIncome, CashBalance } from '@/types';
import { calcHoldings } from '@/lib/calcHoldings';
import { calcSummary } from '@/lib/dataService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

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
  const [viewMode, setViewMode] = useState<'시세' | '평가'>('시세');
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
      const calcedSummary = calcSummary(transData, snapshotData || []);
      const cashIncomeTotal = incomeData.reduce((s: number, c: any) => s + c.amount, 0);
      calcedSummary.cumulativeProfit += cashIncomeTotal;
      setSummary(calcedSummary);
      const base = calcHoldings(transData, '전체');
      const withPrices = await fetchPrices(base);
      allHoldings.current = withPrices;
      const filtered = applyFilter(withPrices, accountFilter);
      setHoldings(filtered);
      if (!selectedHolding && filtered.length > 0) setSelectedHolding(filtered[0]);
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
                  <p style={{ fontSize: 20, fontWeight: 600, color: pos(cur.profit), margin: '2px 0 0' }}>{cur.profit >= 0 ? '+' : ''}{formatWFull(cur.profit)}</p>
                </>
              );
            })()}
          </div>
        </div>
      </div>

      {/* 가운데 영역 */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* 왼쪽 패널 */}
      <div style={{ width: 400, display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '8px', gap: 4 }}>

        {/* 필터 + 종목 리스트 하나의 박스 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'white', borderRadius: 10, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
          {/* 계좌 필터 */}
          <div style={{ padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid #f3f4f6', flexShrink: 0 }}>
            <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 16, padding: 2, flexShrink: 0 }}>
              {(['시세', '평가'] as const).map(m => (
                <button key={m} onClick={() => setViewMode(m)}
                  style={{ fontSize: 11, padding: '3px 10px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: viewMode === m ? '#111827' : 'transparent',
                    color: viewMode === m ? 'white' : '#9ca3af', fontWeight: viewMode === m ? 600 : 500 }}>{m}</button>
              ))}
            </div>
            <select value={accountFilter} onChange={e => handleAccountFilter(e.target.value)}
              style={{ flex: 1, fontSize: 12, border: '1px solid #e5e7eb', borderRadius: 7, padding: '4px 8px', color: '#111827', background: 'white', outline: 'none' }}>
              {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          {/* 종목 리스트 */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
          {holdings.map((h, i) => {
            const ic = getIcon(h.ticker, h.stock_name);
            const isSelected = selectedHolding?.ticker === h.ticker;
            return (
              <div key={i} onClick={() => setSelectedHolding(h)}
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
                        {pct(h.return_rate)}
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
        {selectedHolding ? (
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
                          <td style={{ padding: '6px 6px', color: '#6b7280' }}>{t.trade_date}</td>
                          <td style={{ padding: '6px 6px', color: '#6b7280' }}>{t.account}</td>
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
      </div>{/* 가운데 영역 끝 */}

      {/* 전체 하단 합계 */}
      <div style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', background: 'white', flexShrink: 0, marginTop: 'auto' }}>
        <p style={{ fontSize: 12, color: '#9ca3af', margin: '0 0 4px' }}>선택 합계 · {holdings.length}종목 + 현금</p>
        <p style={{ fontSize: 18, fontWeight: 600, color: '#111827', margin: 0 }}>{formatWFull(Math.round(totalEval))}</p>
      </div>
    </div>
  );
}
