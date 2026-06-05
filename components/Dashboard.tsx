'use client';
import React, { useState, useRef, useEffect } from 'react';
import {
  RefreshCw, Plus, LayoutDashboard, Building2, Clock,
  Sun, Moon, TrendingUp, ChevronRight,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine,
} from 'recharts';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import StockModal from './StockModal';
import { AccountHolding, SummaryData, DailySettlement, Transaction, CashIncome, CashBalance } from '@/types';

const ACCOUNTS = ['전체', 'ISA', 'IRP', '연금저축', 'DC형 연금', '일반직투1', '일반직투2'];
const COLORS = ['#3b82f6', '#6366f1', '#22d3ee', '#a78bfa', '#2dd4bf', '#818cf8', '#67e8f9', '#c4b5fd'];
const PIE_FILTERS = ['종목별', '계좌별', '섹터별', '국가별'];
const INCOME_TYPES = ['배당금', '이자', '기타'];

const THEMES = {
  light: {
    '--bg': '#F2F2F7', '--surface': '#FFFFFF', '--surface-2': '#F8F8FA',
    '--border': 'rgba(60,60,67,0.12)', '--border-strong': 'rgba(60,60,67,0.22)',
    '--label': '#1C1C1E', '--label-2': 'rgba(60,60,67,0.60)', '--label-3': 'rgba(60,60,67,0.35)',
    '--accent': '#2563eb', '--accent-soft': 'rgba(37,99,235,0.10)',
    '--up': '#16a34a', '--down': '#dc2626', '--hover': 'rgba(0,0,0,0.04)',
    '--sidebar': '#FFFFFF', '--sidebar-border': 'rgba(60,60,67,0.10)',
    '--card-shadow': '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.06)',
    '--header-bg': '#FFFFFF',
  },
  dark: {
    '--bg': '#0a0a0f', '--surface': '#16161e', '--surface-2': '#1e1e2a',
    '--border': 'rgba(255,255,255,0.08)', '--border-strong': 'rgba(255,255,255,0.14)',
    '--label': '#FFFFFF', '--label-2': 'rgba(235,235,245,0.55)', '--label-3': 'rgba(235,235,245,0.28)',
    '--accent': '#3b82f6', '--accent-soft': 'rgba(59,130,246,0.18)',
    '--up': '#22c55e', '--down': '#f87171', '--hover': 'rgba(255,255,255,0.05)',
    '--sidebar': '#111118', '--sidebar-border': 'rgba(255,255,255,0.07)',
    '--card-shadow': '0 1px 3px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.4)',
    '--header-bg': '#111118',
  },
};

interface DashboardProps {
  transactions: Transaction[];
  cashIncomes: CashIncome[];
  cashBalances: CashBalance[];
  summary: SummaryData;
  holdings: AccountHolding[];
  dailySettlement: DailySettlement[];
  onAddTransaction: (t: Omit<Transaction, 'id' | 'created_at' | 'profit_loss' | 'profit_rate'>) => Promise<void>;
  onUpdateTransaction: (t: Transaction) => Promise<void>;
  onDeleteTransaction: (id: string) => Promise<void>;
  onAddCashIncome: (c: Omit<CashIncome, 'id' | 'created_at'>) => Promise<void>;
  onDeleteCashIncome: (id: string) => Promise<void>;
  onUpdateCashBalance: (account: string, balance: number) => Promise<void>;
  snapshots: any[];
  onSaveSnapshot: () => Promise<void>;
  onAddSnapshot: (data: { date: string; valuation: number; totalInvested: number; cumulativeProfit: number }) => Promise<void>;
  onUploadCSV: (csv: string) => Promise<void>;
  onDeleteSnapshot: (date: string) => Promise<void>;
  onRefresh: () => void;
  isRefreshing: boolean;
  lastUpdated: Date | null;
  accountFilter: string;
  onAccountFilterChange: (filter: string) => void;
}

export default function Dashboard({
  transactions, cashIncomes, cashBalances, summary, holdings, dailySettlement,
  onAddTransaction, onUpdateTransaction, onDeleteTransaction,
  onAddCashIncome, onDeleteCashIncome, onUpdateCashBalance,
  onRefresh, isRefreshing, lastUpdated, accountFilter, onAccountFilterChange,
  snapshots, onSaveSnapshot, onAddSnapshot, onUploadCSV, onDeleteSnapshot,
}: DashboardProps) {

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') return (localStorage.getItem('wealthflow_theme') as 'light' | 'dark') || 'light';
    return 'light';
  });
  const [activeNav, setActiveNav] = useState<'summary' | 'holdings' | 'settlement'>('summary');
  const [pieFilter, setPieFilter] = useState('종목별');
  const [showForm, setShowForm] = useState(false);
  const [formTab, setFormTab] = useState<'trade' | 'income'>('trade');
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingIdRef = useRef<string | null>(null);
  const [editingCashAccount, setEditingCashAccount] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<'trade' | 'income'>('trade');
  const [cashInput, setCashInput] = useState('');
  const [csvInput, setCsvInput] = useState('');
  const [showCsvForm, setShowCsvForm] = useState(false);
  const [snapshotSearch, setSnapshotSearch] = useState('');
  const [highlightDate, setHighlightDate] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState(1);
  const [graphFilter, setGraphFilter] = useState('daily');
  const [profitMode, setProfitMode] = useState('cumulative');
  const [targetValue, setTargetValue] = useState(0);
  const [targetInput, setTargetInput] = useState('');
  const [showTargetInput, setShowTargetInput] = useState(false);
  const [showTradeTable, setShowTradeTable] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<AccountHolding | null>(null);
  const [profitFilter, setProfitFilter] = useState<'cumulative' | 'annual' | 'monthly' | 'daily'>('cumulative');
  const [showIncomeTable, setShowIncomeTable] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [snapshotForm, setSnapshotForm] = useState({
    date: new Date().toISOString().split('T')[0], valuation: '', totalInvested: '', cumulativeProfit: '',
  });
  const [form, setForm] = useState({
    trade_date: new Date().toISOString().split('T')[0],
    account: 'ISA', account_transfer: '', transfer_amount: '',
    ticker: '', stock_name: '', sector: '', trade_type: '',
    quantity: '', buy_price: '', sell_price: '', currency: 'KRW', memo: '',
  });
  const [incomeForm, setIncomeForm] = useState({
    income_date: new Date().toISOString().split('T')[0],
    account: 'ISA', income_type: '배당금', amount: '', ticker: '', stock_name: '', memo: '',
  });

  useEffect(() => {
    const saved = localStorage.getItem('wealthflow_target');
    if (saved) setTargetValue(parseFloat(saved) || 0);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    localStorage.setItem('wealthflow_theme', next);
  };

  const t = THEMES[theme];
  const isPos = (v: number) => v >= 0;

  const filteredHoldings = holdings;
  const totalCashBalance = cashBalances.reduce((s, b) => s + b.balance, 0);
  const totalValuation = filteredHoldings.reduce((s, h) => s + h.valuation, 0) + totalCashBalance;
  const getCashBalance = (account: string) => cashBalances.find(b => b.account === account)?.balance || 0;

  const sortedHoldings = [...filteredHoldings].sort((a, b) => {
    if (!sortKey) return 0;
    const av = (a as any)[sortKey], bv = (b as any)[sortKey];
    return typeof av === 'number' ? (av - bv) * sortDir : String(av).localeCompare(String(bv)) * sortDir;
  });
  const displayHoldings = sortedHoldings;

  const getPieData = () => {
    if (pieFilter === '종목별') {
      const map = new Map<string, { name: string; ticker: string; value: number }>();
      filteredHoldings.forEach(h => {
        const ex = map.get(h.ticker);
        if (ex) ex.value += h.valuation;
        else map.set(h.ticker, { name: h.stock_name, ticker: h.ticker, value: h.valuation });
      });
      const data = Array.from(map.values());
      if (totalCashBalance > 0) data.push({ name: '현금성 자산', ticker: 'CASH', value: totalCashBalance });
      return data;
    }
    if (pieFilter === '계좌별') {
      const map = new Map<string, number>();
      const priceMap = new Map<string, number>();
      holdings.forEach(h => priceMap.set(h.ticker, h.curr_price || h.avg_price));
      transactions.filter(t => t.trade_type && t.ticker).forEach(t => {
        const cp = priceMap.get(t.ticker!) || t.buy_price || 0;
        const ex = map.get(t.account) || 0;
        if (t.trade_type === '매수') map.set(t.account, ex + (t.quantity || 0) * cp);
        else if (t.trade_type === '매도') map.set(t.account, ex - (t.quantity || 0) * cp);
      });
      return Array.from(map.entries()).filter(([, v]) => v > 0).map(([name, value]) => ({ name, ticker: '', value }));
    }
    if (pieFilter === '섹터별') {
      const map = new Map<string, number>();
      filteredHoldings.forEach(h => map.set(h.sector, (map.get(h.sector) || 0) + h.valuation));
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
    }
    if (pieFilter === '국가별') {
      const map = new Map<string, number>();
      filteredHoldings.forEach(h => {
        const c = h.currency === 'USD' ? '해외' : '국내';
        map.set(c, (map.get(c) || 0) + h.valuation);
      });
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
    }
    return [];
  };
  const pieData = getPieData();

  const resetForm = () => setForm({
    trade_date: new Date().toISOString().split('T')[0],
    account: 'ISA', account_transfer: '', transfer_amount: '',
    ticker: '', stock_name: '', sector: '', trade_type: '',
    quantity: '', buy_price: '', sell_price: '', currency: 'KRW', memo: '',
  });

  const handleSubmit = async () => {
    await onAddTransaction({
      trade_date: form.trade_date, account: form.account,
      account_transfer: form.account_transfer || null, transfer_amount: form.transfer_amount ? parseFloat(form.transfer_amount) : null,
      ticker: form.ticker || null, stock_name: form.stock_name || null, sector: form.sector || null,
      trade_type: form.trade_type || null, quantity: form.quantity ? parseFloat(form.quantity) : null,
      buy_price: form.buy_price ? parseFloat(form.buy_price) : null,
      sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
      currency: form.currency, memo: form.memo || null,
    });
    setShowForm(false); resetForm();
  };

  const handleUpdate = async (updateId: string) => {
    await onUpdateTransaction({
      id: updateId, trade_date: form.trade_date, account: form.account,
      account_transfer: form.account_transfer || null, transfer_amount: form.transfer_amount ? parseFloat(form.transfer_amount) : null,
      ticker: form.ticker || null, stock_name: form.stock_name || null, sector: form.sector || null,
      trade_type: form.trade_type || null, quantity: form.quantity ? parseFloat(form.quantity) : null,
      buy_price: form.buy_price ? parseFloat(form.buy_price) : null,
      sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
      currency: form.currency, memo: form.memo || null,
      profit_loss: null, profit_rate: null, created_at: new Date().toISOString(),
    });
    setShowForm(false); setEditingId(null); editingIdRef.current = null; resetForm();
  };

  const handleIncomeSubmit = async () => {
    await onAddCashIncome({
      income_date: incomeForm.income_date, account: incomeForm.account,
      income_type: incomeForm.income_type, amount: parseFloat(incomeForm.amount),
      ticker: incomeForm.ticker || null, stock_name: incomeForm.stock_name || null, memo: incomeForm.memo || null,
    });
    setShowForm(false);
    setIncomeForm({ income_date: new Date().toISOString().split('T')[0], account: 'ISA', income_type: '배당금', amount: '', ticker: '', stock_name: '', memo: '' });
  };

  const handleExportCSV = () => {
    const headers = ['계좌','TICKER','종목명','평균단가','수량','현재단가','평가액','수익율','수익금','비중','섹터','일일등락'];
    const rows = displayHoldings.map(h => [h.account, h.ticker, h.stock_name, h.avg_price.toFixed(2), h.quantity, h.curr_price.toFixed(2), h.valuation.toFixed(0), h.return_rate.toFixed(2)+'%', h.profit.toFixed(0), h.weight.toFixed(2)+'%', h.sector, (h.daily_change * h.quantity).toFixed(0)]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'holdings_' + new Date().toISOString().slice(0,10) + '.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const handleExportTransCSV = () => {
    const headers = ['날짜','계좌','티커','종목명','입출금','금액','매수/매도','수량','매수단가','매도단가','손익','수익율'];
    const rows = transactions.map(t => [t.trade_date, t.account, t.ticker||'', t.stock_name||'', t.account_transfer||'', t.transfer_amount||'', t.trade_type||'', t.quantity||'', t.buy_price||'', t.sell_price||'', t.profit_loss||'', t.profit_rate||'']);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'transactions_' + new Date().toISOString().slice(0,10) + '.csv'; a.click(); URL.revokeObjectURL(url);
  };

  const profitVal = profitFilter === 'cumulative' ? summary.cumulativeProfit : profitFilter === 'annual' ? summary.annualProfit : profitFilter === 'monthly' ? summary.monthlyProfit : summary.dailyProfit;
  const returnVal = profitFilter === 'cumulative' ? summary.cumulativeReturn : profitFilter === 'annual' ? summary.annualReturn : profitFilter === 'monthly' ? summary.monthlyReturn : summary.dailyReturn;

  const firstSnap = snapshots.length > 0 ? snapshots[0] : null;
  let cagr = 0;
  if (firstSnap && summary.totalInvested > 0) {
    const years = (Date.now() - new Date(firstSnap.snapshot_date).getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    if (years > 0) cagr = (Math.pow(summary.currMonthValue / summary.totalInvested, 1 / years) - 1) * 100;
  }
  let mdd = 0, peak = 0, mddPeakDate = '', mddDate = '';
  snapshots.forEach(s => {
    const val = s.total_valuation || 0;
    if (val > peak) { peak = val; mddPeakDate = s.snapshot_date; }
    const dd = peak > 0 ? (val - peak) / peak * 100 : 0;
    if (dd < mdd) { mdd = dd; mddDate = s.snapshot_date; }
  });
  const targetAchievement = targetValue > 0 ? (summary.currMonthValue / targetValue) * 100 : 0;

  const NAV_ITEMS = [
    { key: 'summary', label: '종합 내역', icon: LayoutDashboard },
    { key: 'holdings', label: '계좌 내역', icon: Building2 },
    { key: 'settlement', label: '일일 결산', icon: Clock },
  ] as const;

  return (
    <div style={{ ...t, minHeight: '100vh', background: 'var(--bg)', color: 'var(--label)', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system,BlinkMacSystemFont,"Pretendard","Apple SD Gothic Neo",sans-serif', WebkitFontSmoothing: 'antialiased', transition: 'background 0.3s,color 0.3s' }}>
      <header style={{ position: 'sticky', top: 0, zIndex: 40, background: 'var(--header-bg)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', height: 56 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingUp size={15} color="#fff" />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.12em' }}>WEALTHFLOW</span>
          <span style={{ fontSize: 12, color: 'var(--accent)', letterSpacing: '0.08em', fontWeight: 500 }}>portfolio analytics</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'var(--accent-soft)', borderRadius: 20, padding: '4px 10px', border: '1px solid var(--accent)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.06em' }}>LIVE</span>
          </div>
          <span style={{ fontSize: 12, color: 'var(--label-2)' }}>{lastUpdated ? lastUpdated.toLocaleTimeString('ko-KR') : '--:--:--'}</span>
          <button onClick={onRefresh} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--label-2)', padding: 4, borderRadius: 6, display: 'flex' }}>
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
          <button onClick={toggleTheme} style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--label-2)', padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 4 }}>
            {theme === 'light' ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <aside style={{ width: 200, flexShrink: 0, background: 'var(--sidebar)', borderRight: '1px solid var(--sidebar-border)', padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4, position: 'sticky', top: 56, height: 'calc(100vh - 56px)', overflowY: 'auto' }}>
          <div style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: 10, padding: '10px 12px', marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 4 }}>총 평가액</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.02em', lineHeight: 1.2 }}>{formatCurrency(summary.currMonthValue)}</div>
            <div style={{ fontSize: 11, fontWeight: 600, marginTop: 4, color: isPos(summary.cumulativeReturn) ? 'var(--up)' : 'var(--down)' }}>
              {isPos(summary.cumulativeReturn) ? '+' : ''}{summary.cumulativeReturn.toFixed(2)}%
            </div>
          </div>
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setActiveNav(key as any)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', background: activeNav === key ? 'var(--accent-soft)' : 'transparent', color: activeNav === key ? 'var(--accent)' : 'var(--label-2)', fontWeight: activeNav === key ? 600 : 400, fontSize: 13, textAlign: 'left', width: '100%', fontFamily: 'inherit' }}>
              <Icon size={15} />{label}
              {activeNav === key && <ChevronRight size={12} style={{ marginLeft: 'auto', opacity: 0.6 }} />}
            </button>
          ))}
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--label-3)', fontWeight: 600, letterSpacing: '0.1em', padding: '0 12px', marginBottom: 6 }}>계좌 필터</div>
            {ACCOUNTS.map(a => (
              <button key={a} onClick={() => onAccountFilterChange(a)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '7px 12px', borderRadius: 7, border: 'none', cursor: 'pointer', background: accountFilter === a ? 'var(--hover)' : 'transparent', color: accountFilter === a ? 'var(--label)' : 'var(--label-2)', fontSize: 12, fontWeight: accountFilter === a ? 600 : 400, fontFamily: 'inherit' }}>
                {a}
              </button>
            ))}
          </div>
        </aside>

        <main style={{ flex: 1, padding: '24px 28px', overflowY: 'auto', maxWidth: 1200 }}>
          {activeNav === 'summary' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card>
                  <div style={{ fontSize: 11, color: 'var(--label-2)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>현재 평가액</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.03em' }}>{formatCurrency(summary.currMonthValue)}</div>
                  <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12, color: 'var(--label-2)' }}>전월 평가액</span>
                    <span style={{ fontSize: 13, color: 'var(--label)' }}>{formatCurrency(summary.prevMonthValue)}</span>
                  </div>
                </Card>
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: 11, color: 'var(--label-2)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>투입금액</div>
                      <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--label)', letterSpacing: '-0.03em' }}>{formatCurrency(summary.totalInvested)}</div>
                      <div style={{ height: 1, background: 'var(--border)', margin: '12px 0' }} />
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                        <span style={{ fontSize: 12, color: 'var(--label-2)' }}>당월 투입액</span>
                        <span style={{ fontSize: 13, color: 'var(--label)' }}>{formatCurrency(summary.currMonthInvestment)}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 12, color: 'var(--label-2)' }}>수익금</span>
                        <select value={profitFilter} onChange={e => setProfitFilter(e.target.value as any)} style={{ fontSize: 11, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 6, padding: '2px 6px', color: 'var(--label)', cursor: 'pointer' }}>
                          <option value="cumulative">누적</option><option value="annual">연</option><option value="monthly">월</option><option value="daily">일</option>
                        </select>
                      </div>
                      <div style={{ fontSize: 22, fontWeight: 700, color: isPos(profitVal) ? 'var(--up)' : 'var(--down)', letterSpacing: '-0.02em' }}>{formatCurrency(profitVal)}</div>
                      <div style={{ fontSize: 13, marginTop: 3, color: isPos(returnVal) ? 'var(--up)' : 'var(--down)', fontWeight: 600 }}>{formatPercent(returnVal)}</div>
                    </div>
                  </div>
                </Card>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
                <Card>
                  <div style={{ fontSize: 11, color: 'var(--label-2)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>CAGR · 연평균 수익률</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: cagr >= 0 ? 'var(--up)' : 'var(--down)', letterSpacing: '-0.02em', margin: '8px 0' }}>{cagr.toFixed(2)}%</div>
                  <span style={{ fontSize: 11, color: 'var(--label-3)' }}>{firstSnap?.snapshot_date ?? '-'} ~ 현재</span>
                </Card>
                <Card>
                  <div style={{ fontSize: 11, color: 'var(--label-2)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>MDD · 최대낙폭</div>
                  <div style={{ fontSize: 26, fontWeight: 700, color: 'var(--down)', letterSpacing: '-0.02em', margin: '8px 0' }}>{mdd.toFixed(2)}%</div>
                  {mddDate && <span style={{ fontSize: 11, color: 'var(--label-3)' }}>{mddPeakDate} → {mddDate}</span>}
                </Card>
                <Card>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ fontSize: 11, color: 'var(--label-2)', fontWeight: 600, letterSpacing: '0.08em', marginBottom: 6 }}>목표 평가액</div>
                    <button onClick={() => setShowTargetInput(v => !v)} style={{ fontSize: 11, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer' }}>설정</button>
                  </div>
                  {showTargetInput && (
                    <div style={{ display: 'flex', gap: 6, margin: '8px 0' }}>
                      <input type="number" value={targetInput} onChange={e => setTargetInput(e.target.value)} placeholder="목표 금액" style={{ flex: 1, fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '5px 8px', color: 'var(--label)', outline: 'none' }} />
                      <button onClick={() => { const v = parseFloat(targetInput)||0; setTargetValue(v); localStorage.setItem('wealthflow_target',String(v)); setShowTargetInput(false); }} style={{ fontSize: 12, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 7, padding: '5px 10px', cursor: 'pointer' }}>확인</button>
                    </div>
                  )}
                  {targetValue > 0 ? (
                    <>
                      <div style={{ fontSize: 26, fontWeight: 700, color: targetAchievement >= 100 ? 'var(--up)' : 'var(--accent)', letterSpacing: '-0.02em', margin: '8px 0' }}>{targetAchievement.toFixed(1)}%</div>
                      <div style={{ fontSize: 11, color: 'var(--label-3)', marginBottom: 8 }}>목표: {formatCurrency(targetValue)}</div>
                      <div style={{ height: 4, background: 'var(--surface-2)', borderRadius: 2, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(targetAchievement,100)}%`, background: targetAchievement >= 100 ? 'var(--up)' : 'var(--accent)', borderRadius: 2 }} />
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: 13, color: 'var(--label-3)', marginTop: 8 }}>목표 금액을 설정하세요</div>
                  )}
                </Card>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <Card style={{ height: 440 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)', letterSpacing: '0.06em' }}>ASSET ALLOCATION</div>
                    <select value={pieFilter} onChange={e => setPieFilter(e.target.value)} style={{ fontSize: 12, background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 8px', color: 'var(--label)', cursor: 'pointer' }}>
                      {PIE_FILTERS.map(f => <option key={f}>{f}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                    <div style={{ position: 'relative' }}>
                      <PieChart width={300} height={300}>
                        <Pie data={pieData} cx={145} cy={145} innerRadius={80} outerRadius={135} dataKey="value" strokeWidth={0}>
                          {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                      </PieChart>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <div style={{ fontSize: 11, color: 'var(--label-2)', marginBottom: 2 }}>MARKET VALUE</div>
                        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--label)' }}>{formatCurrency(totalValuation)}</div>
                      </div>
                    </div>
                  </div>
                </Card>
                <Card style={{ height: 440, overflowY: 'auto' }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)', letterSpacing: '0.06em', marginBottom: 14 }}>ALL HOLDINGS BREAKDOWN</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {pieData.map((d, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, width: 72 }}>{d.ticker || d.name}</span>
                          <span style={{ fontSize: 12, color: 'var(--label-2)' }}>{d.ticker ? d.name : ''}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <span style={{ fontSize: 12, color: 'var(--label)' }}>{formatCurrency(d.value)}</span>
                          <span style={{ fontSize: 12, color: 'var(--up)', fontWeight: 600, minWidth: 48, textAlign: 'right' }}>{totalValuation > 0 ? ((d.value/totalValuation)*100).toFixed(1) : '0.0'}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            </div>
          )}

          {activeNav === 'holdings' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <Card>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--label)', letterSpacing: '0.06em' }}>계좌 상세 내역</div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <SBtn onClick={handleExportCSV}>⬇ 보유종목</SBtn>
                    <SBtn onClick={handleExportTransCSV}>⬇ 거래내역</SBtn>
                  </div>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)' }}>
                        {[['계좌','account'],['TICKER','ticker'],['종목명','stock_name'],['평균단가','avg_price'],['수량','quantity'],['현재단가','curr_price'],['평가액','valuation'],['수익율','return_rate'],['수익금','profit'],['비중','weight'],['섹터','sector'],['일일등락','daily_change']].map(([label,key]) => (
                          <th key={key} onClick={() => { setSortKey(key); setSortDir(sortKey===key ? -sortDir : 1); }} style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--label-2)', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                            {label}{sortKey===key?(sortDir===1?' ↑':' ↓'):''}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {displayHoldings.map((h,i) => (
                        <tr key={i} onClick={() => setSelectedHolding(h)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}
                          onMouseEnter={e=>(e.currentTarget.style.background='var(--hover)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                          <td style={{ padding:'9px 10px',color:'var(--label-2)' }}>{h.account}</td>
                          <td style={{ padding:'9px 10px',color:'var(--accent)',fontWeight:600 }}>{h.ticker}</td>
                          <td style={{ padding:'9px 10px',color:'var(--label)' }}>{h.stock_name}</td>
                          <td style={{ padding:'9px 10px',color:'var(--label)' }}>{formatCurrency(h.avg_price,h.currency)}</td>
                          <td style={{ padding:'9px 10px',color:'var(--label)' }}>{h.quantity}</td>
                          <td style={{ padding:'9px 10px',color:'var(--label)' }}>{formatCurrency(h.curr_price,h.currency)}</td>
                          <td style={{ padding:'9px 10px',color:'var(--label)',fontWeight:600 }}>{formatCurrency(h.valuation)}</td>
                          <td style={{ padding:'9px 10px',color:isPos(h.return_rate)?'var(--up)':'var(--down)',fontWeight:600 }}>{formatPercent(h.return_rate)}</td>
                          <td style={{ padding:'9px 10px',color:isPos(h.profit)?'var(--up)':'var(--down)' }}>{formatCurrency(h.profit)}</td>
                          <td style={{ padding:'9px 10px',color:'var(--label-2)' }}>{h.weight.toFixed(1)}%</td>
                          <td style={{ padding:'9px 10px',color:'var(--label-2)' }}>{h.sector}</td>
                          <td style={{ padding:'9px 10px',color:isPos(h.daily_change)?'var(--up)':'var(--down)' }}>
                            <div>{formatCurrency(h.daily_change*(h.quantity||0))}</div>
                            <div style={{ fontSize:10,opacity:.7 }}>({(h.daily_change_rate??(h.curr_price>0?(h.daily_change/(h.curr_price-h.daily_change))*100:0)).toFixed(2)}%)</div>
                          </td>
                        </tr>
                      ))}
                      {accountFilter==='전체' && cashBalances.length>0 && (
                        <tr style={{ borderBottom:'1px solid var(--border)' }}>
                          <td style={{ padding:'9px 10px',color:'var(--label-2)' }}>전체</td>
                          <td style={{ padding:'9px 10px',color:'var(--label-3)' }}>-</td>
                          <td style={{ padding:'9px 10px',color:'var(--label)' }}>현금성 자산</td>
                          {[...Array(3)].map((_,i)=><td key={i} style={{ padding:'9px 10px',color:'var(--label-3)' }}>-</td>)}
                          <td style={{ padding:'9px 10px',color:'var(--label)' }}>{formatCurrency(totalCashBalance)}</td>
                          {[...Array(4)].map((_,i)=><td key={i} style={{ padding:'9px 10px',color:'var(--label-3)' }}>-</td>)}
                          <td style={{ padding:'9px 10px',color:'var(--label-2)' }}>현금</td>
                          <td style={{ padding:'9px 10px',color:'var(--label-3)' }}>-</td>
                        </tr>
                      )}
                      {accountFilter!=='전체' && (
                        <tr style={{ borderBottom:'1px solid var(--border)' }}>
                          <td style={{ padding:'9px 10px',color:'var(--label-2)' }}>{accountFilter}</td>
                          <td style={{ padding:'9px 10px',color:'var(--label-3)' }}>-</td>
                          <td style={{ padding:'9px 10px',color:'var(--label)' }}>현금성 자산</td>
                          {[...Array(3)].map((_,i)=><td key={i} style={{ padding:'9px 10px',color:'var(--label-3)' }}>-</td>)}
                          <td style={{ padding:'9px 10px' }}>
                            {editingCashAccount===accountFilter ? (
                              <div style={{ display:'flex',gap:4 }}>
                                <input type="number" value={cashInput} onChange={e=>setCashInput(e.target.value)} style={{ width:100,fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:6,padding:'3px 7px',color:'var(--label)',outline:'none' }} />
                                <button onClick={async()=>{ await onUpdateCashBalance(accountFilter,parseFloat(cashInput)||0); setEditingCashAccount(null); }} style={{ fontSize:11,color:'var(--up)',background:'none',border:'none',cursor:'pointer' }}>저장</button>
                                <button onClick={()=>setEditingCashAccount(null)} style={{ fontSize:11,color:'var(--label-3)',background:'none',border:'none',cursor:'pointer' }}>취소</button>
                              </div>
                            ):(
                              <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                                <span style={{ fontSize:12,color:'var(--label)' }}>{formatCurrency(getCashBalance(accountFilter))}</span>
                                <button onClick={()=>{ setEditingCashAccount(accountFilter); setCashInput(getCashBalance(accountFilter).toString()); }} style={{ fontSize:11,color:'var(--accent)',background:'none',border:'none',cursor:'pointer' }}>수정</button>
                              </div>
                            )}
                          </td>
                          {[...Array(5)].map((_,i)=><td key={i} style={{ padding:'9px 10px',color:'var(--label-3)' }}>-</td>)}
                          <td style={{ padding:'9px 10px',color:'var(--label-2)' }}>현금</td>
                          <td style={{ padding:'9px 10px',color:'var(--label-3)' }}>-</td>
                        </tr>
                      )}
                      <tr style={{ borderTop:`2px solid var(--border-strong)`,background:'var(--surface-2)' }}>
                        <td colSpan={6} style={{ padding:'9px 10px',fontSize:11,color:'var(--label-2)',fontWeight:600,letterSpacing:'.05em' }}>SELECTED TOTAL</td>
                        <td style={{ padding:'9px 10px',fontWeight:700,color:'var(--label)' }}>{formatCurrency(displayHoldings.reduce((s,h)=>s+h.valuation,0)+(accountFilter==='전체'?totalCashBalance:getCashBalance(accountFilter)))}</td>
                        <td style={{ padding:'9px 10px',fontWeight:600,color:isPos(displayHoldings.reduce((s,h)=>s+h.return_rate*h.valuation,0)/Math.max(displayHoldings.reduce((s,h)=>s+h.valuation,0),1))?'var(--up)':'var(--down)' }}>
                          {formatPercent(displayHoldings.reduce((s,h)=>s+h.return_rate*h.valuation,0)/Math.max(displayHoldings.reduce((s,h)=>s+h.valuation,0),1))}
                        </td>
                        <td style={{ padding:'9px 10px',fontWeight:600,color:isPos(displayHoldings.reduce((s,h)=>s+h.profit,0))?'var(--up)':'var(--down)' }}>{formatCurrency(displayHoldings.reduce((s,h)=>s+h.profit,0))}</td>
                        <td style={{ padding:'9px 10px',color:'var(--label-2)' }}>100%</td>
                        <td /><td style={{ padding:'9px 10px',fontWeight:600,color:isPos(displayHoldings.reduce((s,h)=>s+h.daily_change*(h.quantity||0),0))?'var(--up)':'var(--down)' }}>{formatCurrency(displayHoldings.reduce((s,h)=>s+h.daily_change*(h.quantity||0),0))}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
                  <div style={{ display:'flex',gap:0,borderBottom:'1px solid var(--border)' }}>
                    {(['trade','income'] as const).map(tab=>(
                      <button key={tab} onClick={()=>setViewTab(tab)} style={{ padding:'8px 16px',fontSize:13,fontWeight:viewTab===tab?600:400,color:viewTab===tab?'var(--accent)':'var(--label-2)',background:'none',border:'none',borderBottom:viewTab===tab?'2px solid var(--accent)':'2px solid transparent',cursor:'pointer',fontFamily:'inherit',marginBottom:-1 }}>
                        {tab==='trade'?'거래 내역':`현금 소득 (${cashIncomes.length})`}
                      </button>
                    ))}
                  </div>
                  <div style={{ display:'flex',gap:8 }}>
                    <SBtn onClick={()=>viewTab==='income'?setShowIncomeTable(v=>!v):setShowTradeTable(v=>!v)}>
                      {viewTab==='income'?(showIncomeTable?'닫기':'열기'):(showTradeTable?'닫기':'열기')}
                    </SBtn>
                    <button onClick={()=>{ setShowForm(!showForm); setFormTab(viewTab==='income'?'income':'trade'); }} style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,padding:'6px 12px',cursor:'pointer',fontFamily:'inherit',fontWeight:600 }}>
                      <Plus size={12} />{viewTab==='income'?'소득 추가':'거래 추가'}
                    </button>
                  </div>
                </div>

                {showForm && (
                  <div style={{ background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:12,padding:16,marginBottom:16 }}>
                    <div style={{ display:'flex',gap:6,marginBottom:12 }}>
                      {(['trade','income'] as const).map(tab=>(
                        <button key={tab} onClick={()=>setFormTab(tab)} style={{ fontSize:12,padding:'5px 12px',borderRadius:7,border:`1px solid ${formTab===tab?'var(--accent)':'var(--border)'}`,cursor:'pointer',fontFamily:'inherit',background:formTab===tab?'var(--accent)':'var(--surface)',color:formTab===tab?'#fff':'var(--label-2)' }}>
                          {tab==='trade'?'거래 내역':'현금 소득'}
                        </button>
                      ))}
                    </div>
                    {formTab==='trade' ? (
                      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
                        {[{label:'날짜',key:'trade_date',type:'date'},{label:'티커',key:'ticker',type:'text'},{label:'종목명',key:'stock_name',type:'text'},{label:'섹터',key:'sector',type:'text'},{label:'수량',key:'quantity',type:'number'},{label:'매수단가',key:'buy_price',type:'number'},{label:'매도단가',key:'sell_price',type:'number'},{label:'입출금금액',key:'transfer_amount',type:'number'},{label:'메모',key:'memo',type:'text'}].map(({label,key,type})=>(
                          <div key={key}>
                            <div style={{ fontSize:11,color:'var(--label-2)',marginBottom:4,fontWeight:500 }}>{label}</div>
                            <input type={type} value={(form as any)[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ width:'100%',fontSize:12,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',color:'var(--label)',outline:'none' }} />
                          </div>
                        ))}
                        {[{label:'계좌',key:'account',opts:ACCOUNTS.filter(a=>a!=='전체')},{label:'매수/매도',key:'trade_type',opts:['','매수','매도']},{label:'입출금',key:'account_transfer',opts:['','입금','출금']},{label:'통화',key:'currency',opts:['KRW','USD']}].map(({label,key,opts})=>(
                          <div key={key}>
                            <div style={{ fontSize:11,color:'var(--label-2)',marginBottom:4,fontWeight:500 }}>{label}</div>
                            <select value={(form as any)[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))} style={{ width:'100%',fontSize:12,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',color:'var(--label)',outline:'none' }}>
                              {opts.map(o=><option key={o}>{o}</option>)}
                            </select>
                          </div>
                        ))}
                        <div style={{ gridColumn:'1 / -1',display:'flex',gap:8,justifyContent:'flex-end',marginTop:4 }}>
                          <SBtn onClick={()=>{ setShowForm(false); setEditingId(null); editingIdRef.current=null; }}>취소</SBtn>
                          <button onClick={editingIdRef.current?()=>handleUpdate(editingIdRef.current!):handleSubmit} style={{ fontSize:12,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,padding:'7px 16px',cursor:'pointer',fontFamily:'inherit',fontWeight:600 }}>
                            {editingIdRef.current?'수정 저장':'저장'}
                          </button>
                        </div>
                      </div>
                    ):(
                      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10 }}>
                        {[{label:'날짜',key:'income_date',type:'date'},{label:'금액',key:'amount',type:'number'},{label:'티커',key:'ticker',type:'text'},{label:'종목명',key:'stock_name',type:'text'},{label:'메모',key:'memo',type:'text'}].map(({label,key,type})=>(
                          <div key={key}>
                            <div style={{ fontSize:11,color:'var(--label-2)',marginBottom:4,fontWeight:500 }}>{label}</div>
                            <input type={type} value={(incomeForm as any)[key]} onChange={e=>setIncomeForm(f=>({...f,[key]:e.target.value}))} style={{ width:'100%',fontSize:12,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',color:'var(--label)',outline:'none' }} />
                          </div>
                        ))}
                        {[{label:'계좌',key:'account',opts:ACCOUNTS.filter(a=>a!=='전체')},{label:'소득 종류',key:'income_type',opts:INCOME_TYPES}].map(({label,key,opts})=>(
                          <div key={key}>
                            <div style={{ fontSize:11,color:'var(--label-2)',marginBottom:4,fontWeight:500 }}>{label}</div>
                            <select value={(incomeForm as any)[key]} onChange={e=>setIncomeForm(f=>({...f,[key]:e.target.value}))} style={{ width:'100%',fontSize:12,background:'var(--surface)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',color:'var(--label)',outline:'none' }}>
                              {opts.map(o=><option key={o}>{o}</option>)}
                            </select>
                          </div>
                        ))}
                        <div style={{ gridColumn:'1 / -1',display:'flex',gap:8,justifyContent:'flex-end',marginTop:4 }}>
                          <SBtn onClick={()=>setShowForm(false)}>취소</SBtn>
                          <button onClick={handleIncomeSubmit} style={{ fontSize:12,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,padding:'7px 16px',cursor:'pointer',fontFamily:'inherit',fontWeight:600 }}>저장</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {viewTab==='trade' && showTradeTable && (
                  <div style={{ overflowX:'auto' }}>
                    <div style={{ height:320,overflowY:'auto' }}>
                      <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                        <thead style={{ position:'sticky',top:0,background:'var(--surface)' }}>
                          <tr style={{ borderBottom:'1px solid var(--border)' }}>
                            {['날짜','계좌','티커','종목명','입출금','금액','매수/매도','수량','매수단가','매도단가','손익','수익율',''].map(h=>(
                              <th key={h} style={{ textAlign:'left',padding:'8px 10px',color:'var(--label-2)',fontWeight:500,whiteSpace:'nowrap' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {transactions.map(tr=>(
                            <tr key={tr.id} style={{ borderBottom:'1px solid var(--border)' }}
                              onMouseEnter={e=>(e.currentTarget.style.background='var(--hover)')}
                              onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                              <td style={{ padding:'8px 10px',color:'var(--label-2)' }}>{tr.trade_date}</td>
                              <td style={{ padding:'8px 10px',color:'var(--label)' }}>{tr.account}</td>
                              <td style={{ padding:'8px 10px',color:'var(--accent)',fontWeight:600 }}>{tr.ticker||'-'}</td>
                              <td style={{ padding:'8px 10px',color:'var(--label)' }}>{tr.stock_name||'-'}</td>
                              <td style={{ padding:'8px 10px',color:'var(--label-2)' }}>{tr.account_transfer||'-'}</td>
                              <td style={{ padding:'8px 10px',color:'var(--label)' }}>{tr.transfer_amount?formatCurrency(tr.transfer_amount):'-'}</td>
                              <td style={{ padding:'8px 10px',color:'var(--label)' }}>{tr.trade_type||'-'}</td>
                              <td style={{ padding:'8px 10px',color:'var(--label)' }}>{tr.quantity||'-'}</td>
                              <td style={{ padding:'8px 10px',color:'var(--label)' }}>{tr.buy_price?formatCurrency(tr.buy_price,tr.currency):'-'}</td>
                              <td style={{ padding:'8px 10px',color:'var(--label)' }}>{tr.sell_price?formatCurrency(tr.sell_price,tr.currency):'-'}</td>
                              <td style={{ padding:'8px 10px',color:tr.profit_loss&&tr.profit_loss>=0?'var(--up)':'var(--down)',fontWeight:600 }}>{tr.profit_loss?formatCurrency(tr.profit_loss):'-'}</td>
                              <td style={{ padding:'8px 10px',color:tr.profit_rate&&tr.profit_rate>=0?'var(--up)':'var(--down)' }}>{tr.profit_rate?formatPercent(tr.profit_rate):'-'}</td>
                              <td style={{ padding:'8px 10px' }}>
                                <div style={{ display:'flex',gap:8 }}>
                                  <button onClick={()=>{ setForm({trade_date:tr.trade_date,account:tr.account,account_transfer:tr.account_transfer||'',transfer_amount:tr.transfer_amount?.toString()||'',ticker:tr.ticker||'',stock_name:tr.stock_name||'',sector:tr.sector||'',trade_type:tr.trade_type||'',quantity:tr.quantity?.toString()||'',buy_price:tr.buy_price?.toString()||'',sell_price:tr.sell_price?.toString()||'',currency:tr.currency,memo:tr.memo||''}); setEditingId(tr.id); editingIdRef.current=tr.id; setFormTab('trade'); setShowForm(true); }} style={{ fontSize:11,color:'var(--accent)',background:'none',border:'none',cursor:'pointer' }}>수정</button>
                                  <button onClick={()=>onDeleteTransaction(tr.id)} style={{ fontSize:11,color:'var(--down)',background:'none',border:'none',cursor:'pointer' }}>✕</button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {viewTab==='income' && showIncomeTable && (
                  <div style={{ height:320,overflowY:'auto' }}>
                    <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                      <thead style={{ position:'sticky',top:0,background:'var(--surface)' }}>
                        <tr style={{ borderBottom:'1px solid var(--border)' }}>
                          {['날짜','계좌','종류','티커','종목명','금액','메모',''].map(h=>(
                            <th key={h} style={{ textAlign:'left',padding:'8px 10px',color:'var(--label-2)',fontWeight:500 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cashIncomes.map(c=>(
                          <tr key={c.id} style={{ borderBottom:'1px solid var(--border)' }}
                            onMouseEnter={e=>(e.currentTarget.style.background='var(--hover)')}
                            onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                            <td style={{ padding:'8px 10px',color:'var(--label-2)' }}>{c.income_date}</td>
                            <td style={{ padding:'8px 10px',color:'var(--label)' }}>{c.account}</td>
                            <td style={{ padding:'8px 10px',color:'var(--up)',fontWeight:600 }}>{c.income_type}</td>
                            <td style={{ padding:'8px 10px',color:'var(--accent)' }}>{c.ticker||'-'}</td>
                            <td style={{ padding:'8px 10px',color:'var(--label)' }}>{c.stock_name||'-'}</td>
                            <td style={{ padding:'8px 10px',color:'var(--up)',fontWeight:600 }}>{formatCurrency(c.amount)}</td>
                            <td style={{ padding:'8px 10px',color:'var(--label-2)' }}>{c.memo||'-'}</td>
                            <td style={{ padding:'8px 10px' }}>
                              <button onClick={()=>onDeleteCashIncome(c.id)} style={{ color:'var(--down)',background:'none',border:'none',cursor:'pointer',fontSize:12 }}>✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeNav === 'settlement' && (
            <div style={{ display:'flex',flexDirection:'column',gap:18 }}>
              <Card>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:'var(--label)',letterSpacing:'.06em' }}>성과 추이 MATRIX</div>
                  <div style={{ display:'flex',gap:8 }}>
                    <select value={profitMode} onChange={e=>setProfitMode(e.target.value)} style={{ fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 10px',color:'var(--label)',cursor:'pointer' }}>
                      <option value="cumulative">누적</option><option value="yearly">년도별 수익금</option><option value="monthly">월별 수익금</option><option value="daily">일별 수익금</option>
                    </select>
                    {profitMode==='cumulative' && (
                      <select value={graphFilter} onChange={e=>setGraphFilter(e.target.value)} style={{ fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 10px',color:'var(--label)',cursor:'pointer' }}>
                        <option value="daily">일별</option><option value="monthly">월별</option><option value="quarterly">분기별</option><option value="yearly">년도별</option>
                      </select>
                    )}
                  </div>
                </div>
                {(()=>{
                  const sorted=[...snapshots].sort((a,b)=>a.snapshot_date.localeCompare(b.snapshot_date));
                  const calcProfitData=()=>{
                    if(profitMode==='yearly'){
                      const years=[...new Set(sorted.map(s=>s.snapshot_date.slice(0,4)))];
                      return years.map((year,yi)=>{ const ys=sorted.filter(s=>s.snapshot_date.startsWith(year)); const last=ys[ys.length-1]; const prevYs=yi===0?[]:sorted.filter(s=>s.snapshot_date.startsWith(years[yi-1])); const prev=prevYs.length?prevYs[prevYs.length-1]:null; return{label:`${year}년`,profit:(last.total_valuation||0)-(prev?.total_valuation||0)-((last.total_invested||0)-(prev?.total_invested||0))}; });
                    }
                    if(profitMode==='monthly'){
                      const months=[...new Set(sorted.map(s=>s.snapshot_date.slice(0,7)))];
                      return months.map((month,mi)=>{ const ms=sorted.filter(s=>s.snapshot_date.startsWith(month)); const last=ms[ms.length-1]; const prevMs=mi===0?[]:sorted.filter(s=>s.snapshot_date.startsWith(months[mi-1])); const prev=prevMs.length?prevMs[prevMs.length-1]:null; return{label:month,profit:(last.total_valuation||0)-(prev?.total_valuation||0)-((last.total_invested||0)-(prev?.total_invested||0))}; });
                    }
                    if(profitMode==='daily'){
                      return sorted.map((s,i)=>{ const prev=i===0?null:sorted[i-1]; return{label:s.snapshot_date,profit:(s.total_valuation||0)-(prev?.total_valuation||0)-((s.total_invested||0)-(prev?.total_invested||0))}; });
                    }
                    return[];
                  };
                  if(profitMode!=='cumulative'){
                    const profitData=calcProfitData();
                    return(
                      <ResponsiveContainer width="100%" height={400}>
                        <BarChart data={profitData} margin={{top:10,right:10,left:10,bottom:0}}>
                          <CartesianGrid strokeDasharray="3 3" stroke={theme==='dark'?'#ffffff0f':'#e5e7eb'} />
                          <XAxis dataKey="label" tick={{fill:'var(--label-2)',fontSize:10}} interval={profitMode==='daily'?30:0} />
                          <YAxis tick={{fill:'var(--label-2)',fontSize:10}} tickFormatter={v=>`${(v/1000000).toFixed(0)}M`} />
                          <ReferenceLine y={0} stroke={theme==='dark'?'#ffffff30':'#94a3b8'} strokeWidth={1} />
                          <Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,fontSize:11}} formatter={(v:any)=>[<span style={{color:Number(v)>=0?'var(--up)':'var(--down)'}}>{formatCurrency(Number(v))}</span>,'수익금']} />
                          <Bar dataKey="profit" isAnimationActive={false}>
                            {profitData.map((d,i)=><Cell key={i} fill={d.profit>=0?'#22c55e':'#f87171'} />)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    );
                  }
                  const filterSnaps=()=>{ if(graphFilter==='daily')return snapshots; const map=new Map<string,any>(); snapshots.forEach(s=>{ const d=new Date(s.snapshot_date); const key=graphFilter==='monthly'?`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`:graphFilter==='quarterly'?`${d.getFullYear()}-Q${Math.floor(d.getMonth()/3)+1}`:`${d.getFullYear()}`; if(!map.has(key)||s.snapshot_date>map.get(key).snapshot_date)map.set(key,s); }); return Array.from(map.values()).sort((a,b)=>a.snapshot_date.localeCompare(b.snapshot_date)); };
                  return(
                    <ResponsiveContainer width="100%" height={400}>
                      <AreaChart data={filterSnaps()} margin={{top:10,right:10,left:10,bottom:0}}>
                        <CartesianGrid strokeDasharray="3 3" stroke={theme==='dark'?'#ffffff0f':'#e5e7eb'} />
                        <XAxis dataKey="snapshot_date" tick={{fill:'var(--label-2)',fontSize:10}} interval={graphFilter==='daily'?30:0} tickFormatter={v=>v?.slice(0,7)} />
                        <YAxis tick={{fill:'var(--label-2)',fontSize:10}} tickFormatter={v=>`${(v/1000000).toFixed(0)}M`} domain={[-10000000,(dMax:number)=>Math.ceil(dMax*1.05/10000000)*10000000]} />
                        <ReferenceLine y={0} stroke={theme==='dark'?'#ffffff30':'#94a3b8'} strokeWidth={1} />
                        {highlightDate&&<ReferenceLine x={highlightDate} stroke="var(--accent)" strokeWidth={2} />}
                        {targetValue>0&&<ReferenceLine y={targetValue} stroke="var(--accent)" strokeWidth={1.5} strokeDasharray="6 3" />}
                        <Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:10,fontSize:11}} formatter={v=>formatCurrency(Number(v))} />
                        <Area isAnimationActive={false} type="monotone" dataKey="total_valuation" name="평가액" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
                        <Area isAnimationActive={false} type="monotone" dataKey="total_invested" name="투자금" stroke="#22c55e" fill="#22c55e18" strokeWidth={2} />
                        <Area isAnimationActive={false} type="monotone" dataKey="total_profit" name="누적수익금" stroke="#f59e0b" fill="#f59e0b18" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  );
                })()}
              </Card>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>
                <Card>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:12 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:'var(--label)',letterSpacing:'.06em' }}>CSV 파일 업로드</div>
                    <SBtn onClick={()=>setShowCsvForm(v=>!v)}>{showCsvForm?'닫기':'열기'}</SBtn>
                  </div>
                  {showCsvForm&&(
                    <>
                      <div style={{ fontSize:11,color:'var(--label-3)',marginBottom:10 }}>형식: 날짜, 평가액, 누적투자금, 누적수익금</div>
                      <div style={{ height:100,border:`2px dashed var(--border)`,borderRadius:10,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',cursor:'pointer',marginBottom:10 }}
                        onClick={()=>document.getElementById('csv-file-input')?.click()}
                        onDragOver={e=>e.preventDefault()}
                        onDrop={e=>{ e.preventDefault(); const f=e.dataTransfer.files[0]; if(f){const r=new FileReader(); r.onload=ev=>setCsvInput(ev.target?.result as string||''); r.readAsText(f);} }}>
                        <div style={{ fontSize:12,color:'var(--label-2)' }}>📁 클릭 또는 드래그</div>
                        <div style={{ fontSize:11,color:'var(--label-3)',marginTop:4 }}>{csvInput?`✅ ${csvInput.split('\n').filter(l=>l.trim()).length}줄 로드됨`:'.csv 파일'}</div>
                      </div>
                      <input id="csv-file-input" type="file" accept=".csv" className="hidden" onChange={e=>{ const f=e.target.files?.[0]; if(f){const r=new FileReader(); r.onload=ev=>setCsvInput(ev.target?.result as string||''); r.readAsText(f);} }} />
                      <button onClick={()=>onUploadCSV(csvInput)} disabled={!csvInput} style={{ width:'100%',fontSize:12,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,padding:'8px',cursor:csvInput?'pointer':'not-allowed',opacity:csvInput?1:0.5,fontFamily:'inherit',fontWeight:600 }}>
                        {csvInput?`업로드 (${csvInput.split('\n').filter(l=>l.trim()).length}줄)`:'CSV 선택 먼저'}
                      </button>
                    </>
                  )}
                </Card>
                <Card>
                  <div style={{ display:'flex',justifyContent:'space-between',marginBottom:12 }}>
                    <div style={{ fontSize:12,fontWeight:700,color:'var(--label)',letterSpacing:'.06em' }}>수기 입력</div>
                    <SBtn onClick={()=>setShowManualForm(v=>!v)}>{showManualForm?'닫기':'열기'}</SBtn>
                  </div>
                  {showManualForm&&(
                    <div style={{ display:'flex',flexDirection:'column',gap:10 }}>
                      {[{label:'날짜',key:'date',type:'date'},{label:'평가액',key:'valuation',type:'number'},{label:'누적투자금',key:'totalInvested',type:'number'},{label:'누적수익금',key:'cumulativeProfit',type:'number'}].map(({label,key,type})=>(
                        <div key={key}>
                          <div style={{ fontSize:11,color:'var(--label-2)',marginBottom:4,fontWeight:500 }}>{label}</div>
                          <input type={type} value={(snapshotForm as any)[key]} onChange={e=>setSnapshotForm(f=>({...f,[key]:e.target.value}))} style={{ width:'100%',fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:7,padding:'6px 10px',color:'var(--label)',outline:'none' }} />
                        </div>
                      ))}
                      <button onClick={()=>onAddSnapshot({date:snapshotForm.date,valuation:parseFloat(snapshotForm.valuation)||0,totalInvested:parseFloat(snapshotForm.totalInvested)||0,cumulativeProfit:parseFloat(snapshotForm.cumulativeProfit)||0})} style={{ width:'100%',fontSize:12,background:'var(--accent)',color:'#fff',border:'none',borderRadius:8,padding:'8px',cursor:'pointer',fontFamily:'inherit',fontWeight:600,marginTop:4 }}>저장</button>
                    </div>
                  )}
                </Card>
              </div>

              <Card>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                  <div style={{ fontSize:12,fontWeight:700,color:'var(--label)',letterSpacing:'.06em' }}>저장된 일일 결산 데이터</div>
                  <div style={{ display:'flex',gap:8 }}>
                    <input type="date" value={snapshotSearch} onChange={e=>{ setSnapshotSearch(e.target.value); setHighlightDate(e.target.value); }} style={{ fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 10px',color:'var(--label)',outline:'none' }} />
                    <SBtn onClick={()=>{ setSnapshotSearch(''); setHighlightDate(''); }}>초기화</SBtn>
                  </div>
                </div>
                <div style={{ height:200,overflowY:'auto' }}>
                  <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                    <thead style={{ position:'sticky',top:0,background:'var(--surface)' }}>
                      <tr style={{ borderBottom:'1px solid var(--border)' }}>
                        {['날짜','평가액','누적투자금','누적수익금',''].map(h=>(
                          <th key={h} style={{ textAlign:'left',padding:'8px 10px',color:'var(--label-2)',fontWeight:500 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...snapshots].sort((a,b)=>b.snapshot_date.localeCompare(a.snapshot_date)).filter(s=>!snapshotSearch||s.snapshot_date.includes(snapshotSearch)).map((s,i)=>(
                        <tr key={i} style={{ borderBottom:'1px solid var(--border)' }}
                          onMouseEnter={e=>(e.currentTarget.style.background='var(--hover)')}
                          onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                          <td style={{ padding:'8px 10px',color:highlightDate===s.snapshot_date?'var(--accent)':'var(--label)',fontWeight:highlightDate===s.snapshot_date?700:400 }}>{s.snapshot_date}</td>
                          <td style={{ padding:'8px 10px',color:'var(--label)' }}>{formatCurrency(s.total_valuation||0)}</td>
                          <td style={{ padding:'8px 10px',color:'var(--label)' }}>{formatCurrency(s.total_invested||0)}</td>
                          <td style={{ padding:'8px 10px',color:(s.total_profit||0)>=0?'var(--up)':'var(--down)',fontWeight:600 }}>{formatCurrency(s.total_profit||0)}</td>
                          <td style={{ padding:'8px 10px' }}>
                            <button onClick={()=>onDeleteSnapshot(s.snapshot_date)} style={{ color:'var(--down)',background:'none',border:'none',cursor:'pointer',fontSize:12 }}>✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          )}
        </main>
      </div>

      <StockModal holding={selectedHolding} onClose={()=>setSelectedHolding(null)} />
      <style>{\`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        *{box-sizing:border-box}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-track{background:transparent}
        ::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:10px}
      \`}</style>
    </div>
  );
}

function Card({children,style}:{children:React.ReactNode;style?:React.CSSProperties}){
  return <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:14,padding:'20px 22px',boxShadow:'var(--card-shadow)',display:'flex',flexDirection:'column',...style}}>{children}</div>;
}

function SBtn({children,onClick}:{children:React.ReactNode;onClick?:()=>void}){
  return <button onClick={onClick} style={{fontSize:12,background:'var(--surface-2)',border:'1px solid var(--border)',borderRadius:7,padding:'5px 10px',cursor:'pointer',color:'var(--label-2)',fontFamily:'inherit'}}>{children}</button>;
}
