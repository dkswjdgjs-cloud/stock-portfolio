'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Transaction, AccountHolding, SummaryData, CashIncome, CashBalance } from '@/types';
import { calcSummary } from '@/lib/dataService';
import { calcHoldings } from '@/lib/calcHoldings';

const ACCOUNTS = ['전체', 'ISA', 'IRP', '연금저축', 'DC형 연금', '일반직투1', '일반직투2'];
const COLORS = ['#6366f1', '#a78bfa', '#3b82f6', '#2dd4bf', '#22d3ee', '#818cf8', '#67e8f9'];

const PIE_FILTERS = ['종목별', '계좌별', '국가별', '섹터별'] as const;
type PieFilter = typeof PIE_FILTERS[number];

function formatW(v: number) {
  if (Math.abs(v) >= 100_000_000) return `${(v / 100_000_000).toFixed(1)}억`;
  if (Math.abs(v) >= 10_000) return `${Math.round(v / 10_000).toLocaleString()}만`;
  return `₩${Math.round(v).toLocaleString()}`;
}
function formatWFull(v: number) {
  return `₩${Math.round(v).toLocaleString('ko-KR')}`;
}
function pct(v: number) {
  return `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
}
function pos(v: number) {
  return v >= 0 ? '#10b981' : '#ef4444';
}


type SettlementMode = '누적' | '년도별' | '월별' | '일별';

function calcSettlementData(snapshots: any[], mode: SettlementMode) {
  if (!snapshots.length) return [];
  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));

  if (mode === '누적') return sorted;

  if (mode === '년도별') {
    const years = [...new Set(sorted.map(s => s.snapshot_date.slice(0, 4)))];
    return years.map((year, yi) => {
      const yearSnaps = sorted.filter(s => s.snapshot_date.startsWith(year));
      const last = yearSnaps[yearSnaps.length - 1];
      const prevYearSnaps = yi === 0 ? [] : sorted.filter(s => s.snapshot_date.startsWith(years[yi - 1]));
      const prevLast = prevYearSnaps.length ? prevYearSnaps[prevYearSnaps.length - 1] : null;
      const prevVal = prevLast ? prevLast.total_valuation || 0 : 0;
      const prevInv = prevLast ? prevLast.total_invested || 0 : 0;
      const currVal = last.total_valuation || 0;
      const currInv = last.total_invested || 0;
      const profit = currVal - prevVal - (currInv - prevInv);
      return { label: `${year}년`, profit, valuation: currVal };
    });
  }

  if (mode === '월별') {
    const months = [...new Set(sorted.map(s => s.snapshot_date.slice(0, 7)))];
    return months.map((month, mi) => {
      const monthSnaps = sorted.filter(s => s.snapshot_date.startsWith(month));
      const last = monthSnaps[monthSnaps.length - 1];
      const prevMonthSnaps = mi === 0 ? [] : sorted.filter(s => s.snapshot_date.startsWith(months[mi - 1]));
      const prevLast = prevMonthSnaps.length ? prevMonthSnaps[prevMonthSnaps.length - 1] : null;
      const prevVal = prevLast ? prevLast.total_valuation || 0 : 0;
      const prevInv = prevLast ? prevLast.total_invested || 0 : 0;
      const currVal = last.total_valuation || 0;
      const currInv = last.total_invested || 0;
      const profit = currVal - prevVal - (currInv - prevInv);
      return { label: month, profit, valuation: currVal };
    });
  }

  if (mode === '일별') {
    return sorted.map((s, i) => {
      const prev = i === 0 ? null : sorted[i - 1];
      const prevVal = prev ? prev.total_valuation || 0 : 0;
      const prevInv = prev ? prev.total_invested || 0 : 0;
      const currVal = s.total_valuation || 0;
      const currInv = s.total_invested || 0;
      const profit = currVal - prevVal - (currInv - prevInv);
      return { label: s.snapshot_date, profit, valuation: currVal };
    });
  }

  return [];
}

function SettlementTab({ snapshots }: { snapshots: any[] }) {
  const [mode, setMode] = useState<SettlementMode>('누적');
  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const data = calcSettlementData(snapshots, mode);
  const reversed = [...data].reverse();

  const renderGraph = () => {
    if (!data.length) return <div style={{ height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 14 }}>데이터 없음</div>;

    if (mode === '누적') {
      const vals = sorted.map(s => s.total_valuation || 0);
      const invs = sorted.map(s => s.total_invested || 0);
      const maxV = Math.max(...vals, ...invs, 1);
      const minV = Math.min(...vals, ...invs, 0);
      const range = maxV - minV || 1;
      const toY = (v: number) => 120 - ((v - minV) / range) * 110;
      const toX = (i: number) => (i / (sorted.length - 1 || 1)) * 280 + 10;
      const evalPts = sorted.map((s, i) => `${toX(i)},${toY(s.total_valuation || 0)}`).join(' ');
      const invPts = sorted.map((s, i) => `${toX(i)},${toY(s.total_invested || 0)}`).join(' ');
      return (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 20, height: 2, background: '#3b82f6', borderRadius: 1 }} /><span style={{ fontSize: 11, color: '#6b7280' }}>평가액</span></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 20, height: 2, background: '#10b981', borderRadius: 1 }} /><span style={{ fontSize: 11, color: '#6b7280' }}>투자원금</span></div>
          </div>
          <svg width="100%" height="130" viewBox="0 0 300 130" preserveAspectRatio="none">
            <line x1="0" y1="20" x2="300" y2="20" stroke="#f3f4f6" strokeWidth="1" />
            <line x1="0" y1="65" x2="300" y2="65" stroke="#f3f4f6" strokeWidth="1" />
            <line x1="0" y1="110" x2="300" y2="110" stroke="#f3f4f6" strokeWidth="1" />
            <polyline points={invPts} fill="none" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <polyline points={evalPts} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </>
      );
    }

    // 막대 그래프 (년/월/일)
    const profits = data.map(d => d.profit);
    const maxAbs = Math.max(...profits.map(Math.abs), 1);
    const barW = Math.max(2, Math.floor(260 / data.length) - 2);
    const midY = 65;
    return (
      <>
        <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, background: '#10b981', borderRadius: 2 }} /><span style={{ fontSize: 11, color: '#6b7280' }}>수익</span></div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}><div style={{ width: 12, height: 12, background: '#ef4444', borderRadius: 2 }} /><span style={{ fontSize: 11, color: '#6b7280' }}>손실</span></div>
        </div>
        <svg width="100%" height="130" viewBox="0 0 300 130" preserveAspectRatio="none">
          <line x1="0" y1={midY} x2="300" y2={midY} stroke="#e5e7eb" strokeWidth="1" />
          <line x1="0" y1="20" x2="300" y2="20" stroke="#f3f4f6" strokeWidth="0.5" />
          <line x1="0" y1="110" x2="300" y2="110" stroke="#f3f4f6" strokeWidth="0.5" />
          {data.map((d, i) => {
            const x = 20 + (i / (data.length || 1)) * 260;
            const barH = Math.abs(d.profit) / maxAbs * 50;
            const color = d.profit >= 0 ? '#10b981' : '#ef4444';
            const y = d.profit >= 0 ? midY - barH : midY;
            return <rect key={i} x={x - barW / 2} y={y} width={barW} height={barH} fill={color} rx="1" />;
          })}
        </svg>
      </>
    );
  };

  const renderTable = () => {
    if (mode === '누적') {
      return (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '7px 4px', borderBottom: '1px solid #f3f4f6' }}>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>날짜</span>
            <span style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>평가액</span>
            <span style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>수익금</span>
          </div>
          <div style={{ maxHeight: 220, overflowY: 'auto' }}>
            {[...sorted].reverse().map((s, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '9px 4px', borderBottom: '0.5px solid #f9fafb' }}>
                <span style={{ fontSize: 12, color: '#374151' }}>{s.snapshot_date}</span>
                <span style={{ fontSize: 12, color: '#374151', textAlign: 'right' }}>{formatW(s.total_valuation || 0)}</span>
                <span style={{ fontSize: 12, color: pos(s.total_profit || 0), textAlign: 'right' }}>
                  {(s.total_profit || 0) >= 0 ? '+' : ''}{formatW(s.total_profit || 0)}
                </span>
              </div>
            ))}
          </div>
        </>
      );
    }
    return (
      <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '7px 4px', borderBottom: '1px solid #f3f4f6' }}>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>기간</span>
          <span style={{ fontSize: 11, color: '#9ca3af', textAlign: 'right' }}>수익금</span>
        </div>
        <div style={{ maxHeight: 220, overflowY: 'auto' }}>
          {reversed.map((d, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '9px 4px', borderBottom: '0.5px solid #f9fafb' }}>
              <span style={{ fontSize: 12, color: '#374151' }}>{d.label}</span>
              <span style={{ fontSize: 12, color: pos(d.profit), textAlign: 'right' }}>
                {d.profit >= 0 ? '+' : ''}{formatW(d.profit)}
              </span>
            </div>
          ))}
        </div>
      </>
    );
  };

  const cardStyle: React.CSSProperties = { background: 'white', margin: '8px 12px', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 14 };
  return (
    <>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, margin: 0 }}>성과 추이</p>
        </div>
        {renderGraph()}
      </div>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <p style={{ fontSize: 13, color: '#6b7280', fontWeight: 500, margin: 0 }}>결산 데이터</p>
          <select value={mode} onChange={e => setMode(e.target.value as SettlementMode)}
            style={{ fontSize: 12, border: '0.5px solid #e5e7eb', borderRadius: 7, padding: '4px 8px', color: '#374151', background: '#f9fafb', outline: 'none' }}>
            {(['누적', '년도별', '월별', '일별'] as SettlementMode[]).map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        {renderTable()}
      </div>
    </>
  );
}

export default function MobilePage() {
  const [tab, setTab] = useState<'account' | 'summary' | 'settlement'>('account');
  const [viewMode, setViewMode] = useState<'시세' | '평가'>('시세');
  const [accountFilter, setAccountFilter] = useState('전체');
  const [pieFilter, setPieFilter] = useState<PieFilter>('종목별');
  const [profitIdx, setProfitIdx] = useState(0);

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashBalances, setCashBalances] = useState<CashBalance[]>([]);
  const [cashIncomes, setCashIncomes] = useState<CashIncome[]>([]);
  const [holdings, setHoldings] = useState<AccountHolding[]>([]);
  const [allHoldings, setAllHoldings] = useState<AccountHolding[]>([]);
  const [snapshots, setSnapshots] = useState<any[]>([]);
  const [summary, setSummary] = useState<SummaryData>({
    prevMonthValue: 0, currMonthInvestment: 0, currMonthValue: 0,
    cumulativeProfit: 0, cumulativeReturn: 0, annualProfit: 0,
    annualReturn: 0, monthlyProfit: 0, monthlyReturn: 0,
    dailyProfit: 0, dailyReturn: 0, totalInvested: 0,
    prevYearValuation: 0, prevYearInvested: 0, prevMonthValuation: 0, prevMonthInvested: 0,
  });
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  const priceCache = useRef<Map<string, { price: number; priceOriginal: number; dailyChange: number; exchangeRate: number; ts: number }>>(new Map());

  const fetchPrices = useCallback(async (baseH: AccountHolding[], force = false): Promise<AccountHolding[]> => {
    const tickers = [...new Set(baseH.map(h => h.ticker))];
    const now = Date.now();
    const TTL = 60_000;
    await Promise.all(tickers.map(async ticker => {
      const cached = priceCache.current.get(ticker);
      if (!force && cached && now - cached.ts < TTL) return;
      try {
        const market = baseH.find(h => h.ticker === ticker)?.currency === 'USD' ? 'US' : 'KR';
        const res = await fetch(`/api/stock?ticker=${ticker}&market=${market}`);
        const data = await res.json();
        if (data.price) {
          const rate = market === 'US' && data.exchangeRate ? data.exchangeRate : 1;
          priceCache.current.set(ticker, { price: data.price * rate, priceOriginal: data.price, dailyChange: (data.dailyChange || 0) * rate, exchangeRate: rate, ts: now });
        }
      } catch {}
    }));
    return baseH.map(h => {
      const pd = priceCache.current.get(h.ticker);
      if (!pd) return h;
      const rate = pd.exchangeRate || 1;
      const avgKRW = h.currency === 'USD' ? h.avg_price * rate : h.avg_price;
      const valuation = pd.price * h.quantity;
      const profit = (pd.price - avgKRW) * h.quantity;
      const return_rate = avgKRW > 0 ? ((pd.price - avgKRW) / avgKRW) * 100 : 0;
      return { ...h, curr_price: pd.priceOriginal, valuation, profit, return_rate, daily_change: pd.dailyChange };
    });
  }, []);

  const loadAll = useCallback(async () => {
    try {
      const [transRes, incomeRes, balanceRes, snapRes] = await Promise.all([
        fetch('/api/transactions'), fetch('/api/cash-income'),
        fetch('/api/cash-balance'), fetch('/api/snapshot'),
      ]);
      const [transData, incomeData, balanceData, snapData]: [Transaction[], CashIncome[], CashBalance[], any[]] = await Promise.all([
        transRes.json(), incomeRes.json(), balanceRes.json(), snapRes.json(),
      ]);
      setTransactions(transData);
      setCashIncomes(incomeData);
      setCashBalances(balanceData);
      setSnapshots(snapData || []);

      const cashIncomeTotal = incomeData.reduce((s: number, c: CashIncome) => s + c.amount, 0);

      const baseAll = calcHoldings(transData, '전체');
      const allWithPrices = await fetchPrices(baseAll);
      setAllHoldings(allWithPrices);
      setHoldings(allWithPrices);

      const totalVal = allWithPrices.reduce((s, h) => s + h.valuation, 0);
      const cashTotal = balanceData.reduce((s: number, b: CashBalance) => s + b.balance, 0);
      const currMonthValue = totalVal + cashTotal;
      const totalInvested = transData.filter((t: any) => t.account_transfer).reduce((sum: number, t: any) => {
        return t.account_transfer === '입금' ? sum + (t.transfer_amount || 0) : sum - (t.transfer_amount || 0);
      }, 0);

      setSummary(() => {
        const calcedWithSnap = calcSummary(transData, snapData || []);
        const { prevYearValuation = 0, prevYearInvested = 0, prevMonthValuation = 0, prevMonthInvested = 0 } = calcedWithSnap;
        const cumulativeProfit = currMonthValue - totalInvested + cashIncomeTotal;
        const cumulativeReturn = totalInvested > 0 ? (cumulativeProfit / totalInvested) * 100 : 0;
        const annualProfit = currMonthValue - prevYearValuation - (totalInvested - prevYearInvested);
        const annualBase = prevYearValuation + (totalInvested - prevYearInvested);
        const annualReturn = annualBase > 0 ? (annualProfit / annualBase) * 100 : 0;
        const monthlyProfit = currMonthValue - prevMonthValuation - (totalInvested - prevMonthInvested);
        const monthlyBase = prevMonthValuation + (totalInvested - prevMonthInvested);
        const monthlyReturn = monthlyBase > 0 ? (monthlyProfit / monthlyBase) * 100 : 0;
        const dailyProfit = allWithPrices.reduce((s, h) => s + (h.daily_change || 0) * (h.quantity || 0), 0);
        const dailyReturn = currMonthValue > 0 ? (dailyProfit / (currMonthValue - dailyProfit)) * 100 : 0;
        return { ...calcedWithSnap, currMonthValue, totalInvested, cumulativeProfit, cumulativeReturn, annualProfit, annualReturn, monthlyProfit, monthlyReturn, dailyProfit, dailyReturn };
      });
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }
  }, [fetchPrices]);

  useEffect(() => {
    loadAll();
    const iv = setInterval(loadAll, 60_000);
    return () => clearInterval(iv);
  }, [loadAll]);

  const handleAccountFilter = useCallback(async (filter: string) => {
    setAccountFilter(filter);
    if (filter === '전체') {
      setHoldings(allHoldings);
    } else {
      const base = calcHoldings(transactions, filter);
      const withPrices = await fetchPrices(base);
      setHoldings(withPrices);
    }
  }, [allHoldings, transactions, fetchPrices]);

  const totalCash = cashBalances.reduce((s, b) => s + b.balance, 0);
  const totalVal = holdings.reduce((s, h) => s + h.valuation, 0);
  const accountCash = accountFilter === '전체' ? totalCash : (cashBalances.find(b => b.account === accountFilter)?.balance || 0);
  const totalEval = totalVal + accountCash;
  const totalProfit = holdings.reduce((s, h) => s + h.profit, 0);

  const profitItems = [
    { label: '누적 수익금', amt: summary.cumulativeProfit, rate: summary.cumulativeReturn },
    { label: '연 수익금', amt: summary.annualProfit, rate: summary.annualReturn },
    { label: '월 수익금', amt: summary.monthlyProfit, rate: summary.monthlyReturn },
    { label: '일 수익금', amt: summary.dailyProfit, rate: summary.dailyReturn },
  ];
  const currentProfit = profitItems[profitIdx];

  const getPieData = () => {
    if (pieFilter === '종목별') {
      const map = new Map<string, { name: string; ticker: string; value: number }>();
      allHoldings.forEach(h => {
        const ex = map.get(h.ticker);
        if (ex) ex.value += h.valuation;
        else map.set(h.ticker, { name: h.stock_name, ticker: h.ticker, value: h.valuation });
      });
      const arr = Array.from(map.values());
      if (totalCash > 0) arr.push({ name: '현금성 자산', ticker: 'CASH', value: totalCash });
      return arr;
    }
    if (pieFilter === '계좌별') {
      const map = new Map<string, number>();
      allHoldings.forEach(h => map.set(h.account, (map.get(h.account) || 0) + h.valuation));
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
    }
    if (pieFilter === '국가별') {
      const map = new Map<string, number>();
      allHoldings.forEach(h => {
        const k = h.currency === 'USD' ? '해외' : '국내';
        map.set(k, (map.get(k) || 0) + h.valuation);
      });
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
    }
    if (pieFilter === '섹터별') {
      const map = new Map<string, number>();
      allHoldings.forEach(h => map.set(h.sector || '기타', (map.get(h.sector || '기타') || 0) + h.valuation));
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
    }
    return [];
  };
  const pieData = getPieData();
  const pieTotal = pieData.reduce((s, d) => s + d.value, 0);

  const makeConic = (data: { value: number }[]) => {
    let cum = 0;
    const parts = data.map((d, i) => {
      const p = pieTotal > 0 ? (d.value / pieTotal) * 100 : 0;
      const from = cum;
      cum += p;
      return `${COLORS[i % COLORS.length]} ${from.toFixed(1)}% ${cum.toFixed(1)}%`;
    });
    return `conic-gradient(${parts.join(',')})` ;
  };

  const cagr = (() => {
    const firstSnap = snapshots[0];
    if (!firstSnap || summary.totalInvested <= 0) return 0;
    const years = (Date.now() - new Date(firstSnap.snapshot_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years <= 0) return 0;
    return (Math.pow(summary.currMonthValue / summary.totalInvested, 1 / years) - 1) * 100;
  })();

  const mdd = (() => {
    let peak = 0, mddVal = 0;
    snapshots.forEach(s => {
      const val = s.total_valuation || 0;
      if (val > peak) peak = val;
      const dd = peak > 0 ? (val - peak) / peak * 100 : 0;
      if (dd < mddVal) mddVal = dd;
    });
    return mddVal;
  })();

  const iconColors: Record<string, { bg: string; color: string }> = {
    'SOL': { bg: '#e0e7ff', color: '#3730a3' },
    'KDX': { bg: '#fef3c7', color: '#b45309' },
    '삼성': { bg: '#dbeafe', color: '#1d4ed8' },
    'SK': { bg: '#fce7f3', color: '#9d174d' },
    'K200': { bg: '#dcfce7', color: '#15803d' },
    'DRAM': { bg: '#ede9fe', color: '#6d28d9' },
  };

  const getIcon = (ticker: string, name: string) => {
    const key = Object.keys(iconColors).find(k => ticker.includes(k) || name.includes(k));
    const c = key ? iconColors[key] : { bg: '#f3f4f6', color: '#6b7280' };
    return { bg: c.bg, color: c.color, label: ticker.slice(0, 4) };
  };

  if (loading) {
    return (
      <div style={{ height: '100dvh', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 17 }}>
        로딩 중...
      </div>
    );
  }

  const S: Record<string, React.CSSProperties> = {
    wrap: { height: '100dvh', display: 'flex', flexDirection: 'column', background: '#f3f4f6', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', },
    header: { background: 'white', padding: '12px 18px 0', paddingTop: 'calc(env(safe-area-inset-top) + 12px)', flexShrink: 0 },
    liveBox: { display: 'flex', alignItems: 'center', gap: 4, background: '#f3f4f6', borderRadius: 20, padding: '3px 8px' },
    scroll: { flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch' },
    tabBar: { background: 'white', borderTop: '0.5px solid #e5e7eb', display: 'flex', flexShrink: 0, paddingBottom: 'env(safe-area-inset-bottom)' },
    tabItem: { flex: 1, textAlign: 'center', padding: '8px 0', cursor: 'pointer', border: 'none', background: 'transparent' },
    card: { background: 'white', margin: '8px 12px', borderRadius: 12, border: '0.5px solid #e5e7eb', padding: 14 },
    srow: { display: 'flex', alignItems: 'center', padding: '13px 16px', borderBottom: '0.5px solid #f3f4f6' },
    sicon: { width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, marginRight: 12 },
    metricCard: { background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 11, padding: 12, flex: 1 },
    legendRow: { display: 'flex', alignItems: 'center', gap: 9, padding: '11px 13px' },
    drow: { display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '9px 4px', borderBottom: '0.5px solid #f9fafb' },
  };

  return (
    <div style={S.wrap}>
      {/* 헤더 — 글씨 크기 유지 */}
      <div style={S.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ color: '#9ca3af', fontSize: 11, letterSpacing: '0.08em' }}>
            WEALTHFLOW · {tab === 'account' ? '계좌 내역' : tab === 'summary' ? '종합 내역' : '일일 결산'}
          </span>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={S.liveBox}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ color: '#10b981', fontSize: 9 }}>LIVE</span>
            </div>
            <span style={{ color: '#6b7280', fontSize: 10 }}>
              {lastUpdated?.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) ?? '--:--'}
            </span>
          </div>
        </div>
        <p style={{ color: '#9ca3af', fontSize: 11, marginBottom: 2 }}>현재 평가액</p>
        <p style={{ color: '#111827', fontSize: 28, fontWeight: 600, letterSpacing: -1, marginBottom: 10 }}>{formatWFull(summary.currMonthValue)}</p>
        <div style={{ paddingTop: 10, borderTop: '1px solid #e5e7eb', paddingBottom: 14, cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setProfitIdx(i => (i + 1) % 4)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
            <span style={{ color: '#9ca3af', fontSize: 11 }}>{currentProfit.label} <span style={{ color: '#4b5563', fontSize: 9 }}>↻ 탭</span></span>
            <span style={{ fontSize: 13, fontWeight: 600, color: pos(currentProfit.rate) }}>{pct(currentProfit.rate)}</span>
          </div>
          <p style={{ fontSize: 20, fontWeight: 600, color: pos(currentProfit.amt), margin: 0 }}>
            {currentProfit.amt >= 0 ? '+' : ''}{formatWFull(currentProfit.amt)}
          </p>
        </div>
      </div>

      {/* 스크롤 영역 */}
      <div style={S.scroll}>

        {/* 탭1: 계좌 내역 */}
        {tab === 'account' && (
          <>
            <div style={{ background: 'white', padding: '11px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #f3f4f6' }}>
              <div style={{ display: 'flex', background: '#f3f4f6', borderRadius: 20, padding: 3, gap: 2 }}>
                {(['시세', '평가'] as const).map(m => (
                  <button key={m} onClick={() => setViewMode(m)} style={{ fontSize: 13, padding: '5px 16px', borderRadius: 18, border: 'none', cursor: 'pointer', background: viewMode === m ? '#111827' : 'transparent', color: viewMode === m ? 'white' : '#9ca3af', fontWeight: viewMode === m ? 600 : 500 }}>{m}</button>
                ))}
              </div>
              <select value={accountFilter} onChange={e => handleAccountFilter(e.target.value)}
                style={{ fontSize: 14, border: '0.5px solid #e5e7eb', borderRadius: 20, padding: '6px 14px', color: '#111827', background: 'white', outline: 'none', textAlign: 'center' }}>
                {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>

            <div style={{ background: 'white' }}>
              {holdings.map((h, i) => {
                const ic = getIcon(h.ticker, h.stock_name);
                return (
                  <div key={i} style={S.srow}>
                    <div style={{ ...S.sicon, background: ic.bg, color: ic.color }}>{ic.label}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 15, fontWeight: 500, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{h.stock_name}</p>
                      <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3, margin: '3px 0 0' }}>
                        {viewMode === '시세'
                          ? `평균 ${h.avg_price.toLocaleString('ko-KR', { maximumFractionDigits: 2 })}${h.currency === 'KRW' ? '원' : '$'}`
                          : `${h.quantity.toLocaleString()}주`}
                      </p>
                    </div>
                    {viewMode === '시세' ? (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>
                          {h.curr_price.toLocaleString('ko-KR', { maximumFractionDigits: 0 })}
                        </p>
                        <p style={{ fontSize: 13, color: pos(h.daily_change), marginTop: 3, margin: '3px 0 0' }}>
                          {h.curr_price > 0 ? pct((h.daily_change / (h.curr_price - h.daily_change || 1)) * 100) : '-'}
                        </p>
                      </div>
                    ) : (
                      <div style={{ textAlign: 'right', flexShrink: 0, maxWidth: '55%' }}>
                        <p style={{ fontSize: 14, fontWeight: 600, color: '#111827', margin: 0 }}>{formatWFull(h.valuation)}</p>
                        <p style={{ fontSize: 12, color: pos(h.profit), marginTop: 3, margin: '3px 0 0' }}>
                          {h.profit >= 0 ? '+' : ''}{formatWFull(h.profit)}({pct(h.return_rate)})
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* 현금성 자산 */}
              <div style={{ ...S.srow, background: '#f9fafb' }}>
                <div style={{ ...S.sicon, background: '#e0f2fe', color: '#0369a1', fontSize: 18 }}>💰</div>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 15, fontWeight: 500, color: '#374151', margin: 0 }}>현금성 자산</p>
                  <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3, margin: '3px 0 0' }}>{accountFilter === '전체' ? '전체 계좌' : accountFilter}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontSize: 15, fontWeight: 600, color: '#111827', margin: 0 }}>{formatWFull(accountCash)}</p>
                  <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 3, margin: '3px 0 0' }}>-</p>
                </div>
              </div>
            </div>

            {/* 합계 */}
            <div style={{ background: 'white', padding: '13px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #f3f4f6', marginBottom: 8 }}>
              <p style={{ fontSize: 13, color: '#9ca3af', margin: 0 }}>선택 합계 · {holdings.length}종목 + 현금</p>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 17, fontWeight: 700, color: '#111827', margin: 0 }}>{formatWFull(totalEval)}</p>
                <p style={{ fontSize: 13, color: pos(totalProfit), marginTop: 2, margin: '2px 0 0' }}>
                  {totalProfit >= 0 ? '+' : ''}{formatWFull(totalProfit)}
                </p>
              </div>
            </div>
          </>
        )}

        {/* 탭2: 종합 내역 */}
        {tab === 'summary' && (
          <>


            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>ASSET ALLOCATION</p>
                <select value={pieFilter} onChange={e => setPieFilter(e.target.value as PieFilter)}
                  style={{ fontSize: 12, border: '0.5px solid #e5e7eb', borderRadius: 7, padding: '4px 8px', color: '#374151', background: '#f9fafb', outline: 'none' }}>
                  {PIE_FILTERS.map(f => <option key={f}>{f}</option>)}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
                <div style={{ width: 230, height: 230, borderRadius: '50%', background: makeConic(pieData), display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <div style={{ width: 115, height: 115, background: 'white', borderRadius: '50%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10, color: '#9ca3af' }}>총 자산</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{formatW(summary.currMonthValue)}</span>
                  </div>
                </div>
              </div>

              <div style={{ background: '#f9fafb', border: '0.5px solid #e5e7eb', borderRadius: 11, overflow: 'hidden' }}>
                {pieData.map((d, i) => (
                  <div key={i} style={{ ...S.legendRow, borderBottom: i < pieData.length - 1 ? '0.5px solid #e5e7eb' : 'none' }}>
                    <div style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: '#374151', fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{d.name}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#111827', flexShrink: 0 }}>{pieTotal > 0 ? ((d.value / pieTotal) * 100).toFixed(1) : 0}%</span>
                    <span style={{ fontSize: 12, color: '#9ca3af', minWidth: 50, textAlign: 'right', flexShrink: 0 }}>{formatW(d.value)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* 탭3: 일일 결산 */}
        {tab === 'settlement' && (
          <SettlementTab snapshots={snapshots} />
        )}

        <div style={{ height: 8 }} />
      </div>

      {/* 탭바 */}
      <div style={S.tabBar}>
        {([
          { key: 'account', icon: '🏦', label: '계좌' },
          { key: 'summary', icon: '⊞', label: '종합' },
          { key: 'settlement', icon: '⏱', label: '결산' },
        ] as const).map(t => (
          <button key={t.key} style={S.tabItem} onClick={() => setTab(t.key)}>
            <div style={{ fontSize: 22 }}>{t.icon}</div>
            <p style={{ fontSize: 11, color: tab === t.key ? '#2563eb' : '#9ca3af', fontWeight: tab === t.key ? 500 : 400, margin: '2px 0 0' }}>{t.label}</p>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        select { -webkit-appearance: none; appearance: none; }
      `}</style>
    </div>
  );
}
