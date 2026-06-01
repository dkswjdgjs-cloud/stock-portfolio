'use client';
import React, { useState, useRef, useEffect } from 'react';
import { TrendingUp, RefreshCw, Plus, LayoutDashboard, Building2, Clock } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
import StockModal from './StockModal';
import { AccountHolding, SummaryData, DailySettlement, Transaction, CashIncome, CashBalance } from '@/types';

const ACCOUNTS = ['전체', 'ISA', 'IRP', '연금저축', 'DC형 연금', '일반직투1', '일반직투2'];
const COLORS = ['#6366f1', '#22d3ee', '#3b82f6', '#a78bfa', '#2dd4bf', '#818cf8', '#67e8f9', '#c4b5fd'];
const PIE_FILTERS = ['종목별', '계좌별', '섹터별', '국가별'];
const INCOME_TYPES = ['배당금', '이자', '기타'];

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
  onAddSnapshot: (data: {date: string; valuation: number; totalInvested: number; cumulativeProfit: number}) => Promise<void>;
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
  snapshots, onSaveSnapshot, onAddSnapshot, onUploadCSV, onDeleteSnapshot
}: DashboardProps) {
  const [activeTab, setActiveTab] = useState(0);
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
  useEffect(() => {
    const saved = localStorage.getItem('wealthflow_target');
    if (saved) setTargetValue(parseFloat(saved) || 0);
  }, []);
  const [showTradeTable, setShowTradeTable] = useState(false);
  const [selectedHolding, setSelectedHolding] = useState<AccountHolding | null>(null);
  const [profitFilter, setProfitFilter] = useState<'cumulative' | 'annual' | 'monthly' | 'daily'>('cumulative');
  const [showIncomeTable, setShowIncomeTable] = useState(false);
  const [showManualForm, setShowManualForm] = useState(false);
  const [snapshotForm, setSnapshotForm] = useState({
    date: new Date().toISOString().split('T')[0],
    valuation: '',
    totalInvested: '',
    cumulativeProfit: '',
  });

  const [form, setForm] = useState({
    trade_date: new Date().toISOString().split('T')[0],
    account: 'ISA', account_transfer: '', transfer_amount: '',
    ticker: '', stock_name: '', sector: '', trade_type: '',
    quantity: '', buy_price: '', sell_price: '', currency: 'KRW', memo: '',
  });

  const [incomeForm, setIncomeForm] = useState({
    income_date: new Date().toISOString().split('T')[0],
    account: 'ISA',
    income_type: '배당금',
    amount: '',
    ticker: '',
    stock_name: '',
    memo: '',
  });

  const filteredHoldings = holdings;
  const totalValuation = filteredHoldings.reduce((s, h) => s + h.valuation, 0) + cashBalances.reduce((s, b) => s + b.balance, 0);

  const getCashBalance = (account: string) => {
    const cb = cashBalances.find(b => b.account === account);
    return cb ? cb.balance : 0;
  };

  const totalCashBalance = cashBalances.reduce((s, b) => s + b.balance, 0);

  const getPieData = () => {
    if (pieFilter === '종목별') {
      const tickerMap = new Map<string, { name: string; ticker: string; value: number }>();
      filteredHoldings.forEach(h => {
        const existing = tickerMap.get(h.ticker);
        if (existing) { existing.value += h.valuation; }
        else { tickerMap.set(h.ticker, { name: h.stock_name, ticker: h.ticker, value: h.valuation }); }
      });
      const data = Array.from(tickerMap.values());
      if (totalCashBalance > 0) data.push({ name: '현금성 자산', ticker: 'CASH', value: totalCashBalance });
      return data;
    }
    if (pieFilter === '계좌별') {
      const map = new Map<string, number>();
      // 전체 holdings에서 ticker별 현재가 맵 생성
      const priceMap = new Map<string, number>();
      holdings.forEach(h => priceMap.set(h.ticker, h.curr_price || h.avg_price));
      // transactions에서 계좌별로 직접 집계
      transactions.filter(t => t.trade_type && t.ticker).forEach(t => {
        const currPrice = priceMap.get(t.ticker!) || t.buy_price || 0;
        const existing = map.get(t.account) || 0;
        if (t.trade_type === '매수') map.set(t.account, existing + (t.quantity || 0) * currPrice);
        else if (t.trade_type === '매도') map.set(t.account, existing - (t.quantity || 0) * currPrice);
      });
      return Array.from(map.entries())
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, ticker: '', value }));
    }
    if (pieFilter === '섹터별') {
      const map = new Map<string, number>();
      filteredHoldings.forEach(h => map.set(h.sector, (map.get(h.sector) || 0) + h.valuation));
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
    }
    if (pieFilter === '국가별') {
      const map = new Map<string, number>();
      filteredHoldings.forEach(h => {
        const country = h.currency === 'USD' ? '해외' : '국내';
        map.set(country, (map.get(country) || 0) + h.valuation);
      });
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
    }
    return [];
  };

  const handleSubmit = async () => {
    await onAddTransaction({
      trade_date: form.trade_date, account: form.account,
      account_transfer: form.account_transfer || null,
      transfer_amount: form.transfer_amount ? parseFloat(form.transfer_amount) : null,
      ticker: form.ticker || null, stock_name: form.stock_name || null,
      sector: form.sector || null, trade_type: form.trade_type || null,
      quantity: form.quantity ? parseFloat(form.quantity) : null,
      buy_price: form.buy_price ? parseFloat(form.buy_price) : null,
      sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
      currency: form.currency, memo: form.memo || null,
    });
    setShowForm(false);
    resetForm();
  };

  const handleUpdate = async (updateId: string) => {
    await onUpdateTransaction({
      id: updateId,
      trade_date: form.trade_date, account: form.account,
      account_transfer: form.account_transfer || null,
      transfer_amount: form.transfer_amount ? parseFloat(form.transfer_amount) : null,
      ticker: form.ticker || null, stock_name: form.stock_name || null,
      sector: form.sector || null, trade_type: form.trade_type || null,
      quantity: form.quantity ? parseFloat(form.quantity) : null,
      buy_price: form.buy_price ? parseFloat(form.buy_price) : null,
      sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
      currency: form.currency, memo: form.memo || null,
      profit_loss: null, profit_rate: null, created_at: new Date().toISOString(),
    });
    setShowForm(false);
    setEditingId(null);
    editingIdRef.current = null;
    resetForm();
  };

  const handleIncomeSubmit = async () => {
    await onAddCashIncome({
      income_date: incomeForm.income_date,
      account: incomeForm.account,
      income_type: incomeForm.income_type,
      amount: parseFloat(incomeForm.amount),
      ticker: incomeForm.ticker || null,
      stock_name: incomeForm.stock_name || null,
      memo: incomeForm.memo || null,
    });
    setShowForm(false);
    setIncomeForm({
      income_date: new Date().toISOString().split('T')[0],
      account: 'ISA', income_type: '배당금', amount: '', ticker: '', stock_name: '', memo: '',
    });
  };

  const resetForm = () => {
    setForm({
      trade_date: new Date().toISOString().split('T')[0],
      account: 'ISA', account_transfer: '', transfer_amount: '',
      ticker: '', stock_name: '', sector: '', trade_type: '',
      quantity: '', buy_price: '', sell_price: '', currency: 'KRW', memo: '',
    });
  };

  const isPos = (v: number) => v >= 0;
  const handleExportCSV = () => {
    const headers = ['계좌','TICKER','종목명','평균단가','수량','현재단가','평가액','수익율','수익금','비중','섹터','일일등락'];
    const rows = displayHoldings.map(h => [
      h.account, h.ticker, h.stock_name,
      h.avg_price.toFixed(2), h.quantity, h.curr_price.toFixed(2),
      h.valuation.toFixed(0), h.return_rate.toFixed(2)+'%',
      h.profit.toFixed(0), h.weight.toFixed(2)+'%', h.sector,
      (h.daily_change * h.quantity).toFixed(0),
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'holdings_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(url);
  };
  const handleExportTransCSV = () => {
    const headers = ['날짜','계좌','티커','종목명','입출금','금액','매수/매도','수량','매수단가','매도단가','손익','수익율'];
    const rows = transactions.map(t => [
      t.trade_date, t.account, t.ticker||'', t.stock_name||'',
      t.account_transfer||'', t.transfer_amount||'',
      t.trade_type||'', t.quantity||'',
      t.buy_price||'', t.sell_price||'',
      t.profit_loss||'', t.profit_rate||'',
    ]);
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob(['\uFEFF'+csv], {type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'transactions_' + new Date().toISOString().slice(0,10) + '.csv';
    a.click(); URL.revokeObjectURL(url);
  };
  const pieData = getPieData();

  const TABS = [
    { label: '종합 내역', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { label: '계좌 내역', icon: <Building2 className="w-3.5 h-3.5" /> },
    { label: '일일 결산', icon: <Clock className="w-3.5 h-3.5" /> },
  ];

  const inputClass = "w-full bg-gray-200 border border-gray-400 rounded px-2 py-1.5 text-sm text-[#1a1a1a] focus:outline-none focus:border-blue-500";
  const selectClass = "w-full bg-gray-200 border border-gray-400 rounded px-2 py-1.5 text-sm text-[#1a1a1a]";

  // 계좌 필터링된 holdings
  const sortedHoldings = [...filteredHoldings].sort((a, b) => {
    if (!sortKey) return 0;
    const av = (a as any)[sortKey];
    const bv = (b as any)[sortKey];
    if (typeof av === 'number') return (av - bv) * sortDir;
    return String(av).localeCompare(String(bv)) * sortDir;
  });
  const displayHoldings = sortedHoldings;





  return (
    <div className="min-h-screen bg-gray-50 text-[#1a1a1a] ">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-white backdrop-blur-sm border-b border-gray-200 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-medium text-base">W</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-medium tracking-widest text-[#1a1a1a]">WEALTHFLOW</h1>
            <span className="text-sm text-blue-600 tracking-wider">portfolio analytics</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-gray-100 border border-gray-200 rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-sm text-emerald-600 tracking-wider">LIVE SYNC ACTIVE</span>
          </div>
          <span className="text-sm text-[#555555] ml-2">
            {lastUpdated ? lastUpdated.toLocaleTimeString('ko-KR') : '--:--:--'}
          </span>
          <button onClick={onRefresh} className="ml-1 text-[#1a1a1a] hover:text-[#1a1a1a] transition-colors">
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-[#1e2433] border-b border-[#2a3147] px-6">
        <div className="flex">
          {TABS.map((tab, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-sm font-medium tracking-wide transition-colors border-b-2 -mb-px',
                activeTab === i ? 'text-blue-600 border-blue-600' : 'text-[#555555] border-transparent hover:text-[#1a1a1a]'
              )}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-screen-xl mx-auto px-6 py-6 space-y-4">

        {/* 탭1: 종합 내역 */}
        {activeTab === 0 && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              {/* 박스1: 현재 평가액 + 전월 평가액 */}
              <div className="bg-white border border-gray-200 rounded-md p-5">
                <p className="text-sm text-[#555555] tracking-wider mb-2">현재 평가액</p>
                <p className="text-3xl font-semibold text-[#1a1a1a]">{formatCurrency(summary.currMonthValue)}</p>
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <p className="text-sm text-[#555555]">전월 평가액</p>
                  <p className="text-base text-[#1a1a1a]">{formatCurrency(summary.prevMonthValue)}</p>
                </div>
              </div>
              {/* 박스2: 투입금액 + 수익금 드롭다운 */}
              <div className="bg-white border border-gray-200 rounded-md p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-[#555555] tracking-wider mb-2">투입금액</p>
                    <p className="text-3xl font-semibold text-[#1a1a1a]">{formatCurrency(summary.totalInvested)}</p>
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <p className="text-sm text-[#555555]">당월 투입액</p>
                      <p className="text-base text-[#1a1a1a]">{formatCurrency(summary.currMonthInvestment)}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-2 mb-2">
                      <p className="text-sm text-[#555555] tracking-wider">수익금</p>
                      <select
                        value={profitFilter}
                        onChange={e => setProfitFilter(e.target.value as any)}
                        className="text-sm bg-gray-100 border border-gray-200 rounded px-2 py-0.5 text-[#1a1a1a]">
                        <option value="cumulative">누적</option>
                        <option value="annual">연</option>
                        <option value="monthly">월</option>
                        <option value="daily">일</option>
                      </select>
                    </div>
                    <p className={cn('text-3xl font-semibold', isPos(
                      profitFilter === 'cumulative' ? summary.cumulativeProfit :
                      profitFilter === 'annual' ? summary.annualProfit :
                      profitFilter === 'monthly' ? summary.monthlyProfit : summary.dailyProfit
                    ) ? 'text-red-500' : 'text-blue-500')}>
                      {formatCurrency(
                        profitFilter === 'cumulative' ? summary.cumulativeProfit :
                        profitFilter === 'annual' ? summary.annualProfit :
                        profitFilter === 'monthly' ? summary.monthlyProfit : summary.dailyProfit
                      )}
                    </p>
                    <p className={cn('text-base mt-1', isPos(
                      profitFilter === 'cumulative' ? summary.cumulativeReturn :
                      profitFilter === 'annual' ? summary.annualReturn :
                      profitFilter === 'monthly' ? summary.monthlyReturn : summary.dailyReturn
                    ) ? 'text-red-500' : 'text-blue-500')}>
                      {formatPercent(
                        profitFilter === 'cumulative' ? summary.cumulativeReturn :
                        profitFilter === 'annual' ? summary.annualReturn :
                        profitFilter === 'monthly' ? summary.monthlyReturn : summary.dailyReturn
                      )}
                    </p>
                  </div>
                </div>
              </div>
            </div>
            {/* CAGR / MDD / 목표 달성률 카드 */}
            {(() => {
              // CAGR 계산
              const firstSnap = snapshots.length > 0 ? snapshots[0] : null;
              const lastSnap = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
              let cagr = 0;
              if (firstSnap && lastSnap && summary.totalInvested > 0) {
                const startDate = new Date(firstSnap.snapshot_date);
                const endDate = new Date();
                const years = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
                if (years > 0) {
                  cagr = (Math.pow(summary.currMonthValue / summary.totalInvested, 1 / years) - 1) * 100;
                }
              }
              // MDD 계산
              let mdd = 0;
              let peak = 0;
              let peakDate = "";
              let mddDate = "";
              let mddPeakDate = "";
              snapshots.forEach(s => {
                const val = s.total_valuation || 0;
                if (val > peak) { peak = val; peakDate = s.snapshot_date; }
                const drawdown = peak > 0 ? (val - peak) / peak * 100 : 0;
                if (drawdown < mdd) { mdd = drawdown; mddDate = s.snapshot_date; mddPeakDate = peakDate; }
              });
              // 목표 달성률
              const targetAchievement = targetValue > 0 ? (summary.currMonthValue / targetValue) * 100 : 0;
              return (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white border border-gray-200 rounded-md p-5">
                    <p className="text-sm text-[#555555] tracking-wider mb-2">CAGR (연평균 수익률)</p>
                    <p className={cn("text-2xl font-semibold", cagr >= 0 ? "text-red-500" : "text-blue-500")}>
                      {cagr.toFixed(2)}%
                    </p>
                    <p className="text-sm text-[#555555] mt-1">
                      {firstSnap ? firstSnap.snapshot_date : '-'} ~ 현재
                    </p>
                  </div>
                  <div className="bg-white border border-gray-200 rounded-md p-5">
                    <p className="text-sm text-[#555555] tracking-wider mb-2">MDD (최대낙폭)</p>
                    <p className="text-2xl font-semibold text-blue-500">{mdd.toFixed(2)}%</p>
                    <p className="text-sm text-[#555555] mt-1">고점 대비 최대 하락폭</p>
                    {mddPeakDate && mddDate && (
                      <p className="text-sm text-[#555555] mt-1">{mddPeakDate} → {mddDate}</p>
                    )}
                  </div>
                  <div className="bg-white border border-gray-200 rounded-md p-5">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm text-[#555555] tracking-wider">목표 평가액</p>
                      <button onClick={() => setShowTargetInput(v => !v)}
                        className="text-sm text-blue-600 hover:text-blue-700">설정</button>
                    </div>
                    {showTargetInput && (
                      <div className="flex gap-1 mb-2">
                        <input type="number" value={targetInput}
                          onChange={e => setTargetInput(e.target.value)}
                          placeholder="목표 금액 입력"
                          className="flex-1 text-sm bg-gray-100 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:border-blue-500" />
                        <button onClick={() => { const v = parseFloat(targetInput) || 0; setTargetValue(v); localStorage.setItem('wealthflow_target', String(v)); setShowTargetInput(false); }}
                          className="text-sm bg-blue-600 text-white px-2 py-1 rounded">확인</button>
                      </div>
                    )}
                    {targetValue > 0 ? (
                      <>
                        <p className={cn("text-2xl font-semibold", targetAchievement >= 100 ? "text-emerald-600" : "text-blue-600")}>
                          {targetAchievement.toFixed(1)}%
                        </p>
                        <p className="text-sm text-[#555555] mt-1">목표: {formatCurrency(targetValue)}</p>
                        <div className="mt-2 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={cn("h-full rounded-full transition-all", targetAchievement >= 100 ? "bg-emerald-500" : "bg-blue-500")}
                            style={{width: `${Math.min(targetAchievement, 100)}%`}} />
                        </div>
                      </>
                    ) : (
                      <p className="text-base text-[#555555]">목표 금액을 설정하세요</p>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 파이차트 + 상세내역 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white border border-gray-200 rounded-md p-5 flex flex-col" style={{height: "450px"}}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-sm text-[#1a1a1a] tracking-wider">| ASSET ALLOCATION</p>
                  <select value={pieFilter} onChange={e => setPieFilter(e.target.value)} className={selectClass} style={{width: 'auto'}}>
                    {PIE_FILTERS.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div className="flex items-center justify-center flex-1">
                  <div className="relative">
                    <PieChart width={360} height={360}>
                      <Pie data={pieData} cx={175} cy={175} innerRadius={95} outerRadius={165} dataKey="value" strokeWidth={0}>
                        {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                      </Pie>
                    </PieChart>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <p className="text-base text-[#555555] tracking-wider">MARKET VALUE</p>
                      <p className="text-2xl font-semibold text-[#1a1a1a]">{formatCurrency(totalValuation)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-md p-5 flex flex-col" style={{height: "450px"}}>
                <p className="text-sm text-[#1a1a1a] tracking-wider mb-4">| ALL HOLDINGS BREAKDOWN</p>
                <div className="space-y-4 overflow-y-auto flex-1">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-base text-blue-600 font-medium w-20 inline-block">{d.ticker || d.name}</span>
                        <span className="text-base text-[#1a1a1a]">{d.ticker ? d.name : ''}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-base text-[#1a1a1a]">{formatCurrency(d.value)}</span>
                        <span className="text-base text-emerald-600 w-14 text-right">
                          {totalValuation > 0 ? ((d.value / totalValuation) * 100).toFixed(2) : '0.00'}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 탭2: 계좌 내역 */}
        {activeTab === 1 && (
          <div className="space-y-4">
            {/* 박스1: 계좌 상세 내역 */}
            <div className="bg-white border border-gray-200 rounded-md p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm text-[#1a1a1a] tracking-wider">| 계좌 상세 내역</h2>
                <div className="flex items-center gap-2">
                  <button onClick={handleExportCSV} className="text-sm bg-gray-100 hover:bg-gray-200 text-[#1a1a1a] border border-gray-300 px-2 py-1.5 rounded-lg">⬇ 보유종목</button>
                  <button onClick={handleExportTransCSV} className="text-sm bg-gray-100 hover:bg-gray-200 text-[#1a1a1a] border border-gray-300 px-2 py-1.5 rounded-lg">⬇ 거래내역</button>
                  <select value={accountFilter} onChange={e => onAccountFilterChange(e.target.value)}
                    className="text-sm bg-gray-100 border border-gray-300 rounded px-2 py-1 text-[#1a1a1a]">
                    {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
                  </select>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#555555] border-b border-gray-200">
                      {[['계좌','account'],['TICKER','ticker'],['종목명','stock_name'],['평균단가','avg_price'],['수량','quantity'],['현재단가','curr_price'],['평가액','valuation'],['수익율','return_rate'],['수익금','profit'],['비중','weight'],['섹터','sector'],['일일등락','daily_change']].map(([label, key]) => (
                        <th key={key} onClick={() => { setSortKey(key); setSortDir(sortKey === key ? (sortDir === 1 ? -1 : 1) : 1); }}
                          className="text-left py-2 px-2 font-medium tracking-wider cursor-pointer hover:text-blue-600 select-none">
                          {label}{sortKey === key ? (sortDir === 1 ? ' ↑' : ' ↓') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayHoldings.map((h, i) => (
                      <tr key={i} className="border-b border-gray-200/80 hover:bg-gray-100/80 transition-colors cursor-pointer" onClick={() => setSelectedHolding(h)}>
                        <td className="py-2 px-2 text-[#1a1a1a]">{h.account}</td>
                        <td className="py-2 px-2 text-blue-600">{h.ticker}</td>
                        <td className="py-2 px-2">{h.stock_name}</td>
                        <td className="py-2 px-2">{formatCurrency(h.avg_price, h.currency)}</td>
                        <td className="py-2 px-2">{h.quantity}</td>
                        <td className="py-2 px-2">{formatCurrency(h.curr_price, h.currency)}</td>
                        <td className="py-2 px-2 font-medium">{formatCurrency(h.valuation)}</td>
                        <td className={cn('py-2 px-2 transition-colors duration-500', isPos(h.return_rate) ? 'text-red-500' : 'text-blue-500')}>{formatPercent(h.return_rate)}</td>
                        <td className={cn('py-2 px-2 transition-colors duration-500', isPos(h.profit) ? 'text-red-500' : 'text-blue-500')}>{formatCurrency(h.profit)}</td>
                        <td className="py-2 px-2 text-[#1a1a1a]">{h.weight.toFixed(1)}%</td>
                        <td className="py-2 px-2 text-[#1a1a1a]">{h.sector}</td>
                        <td className={cn('py-2 px-2 transition-colors duration-500', isPos(h.daily_change) ? 'text-red-500' : 'text-blue-500')}>
                          <div>{formatCurrency(h.daily_change * (h.quantity || 0))}</div>
                          <div className="text-sm opacity-70">
                            ({h.daily_change_rate !== undefined ? h.daily_change_rate.toFixed(2) : (h.curr_price > 0 ? ((h.daily_change / (h.curr_price - h.daily_change)) * 100).toFixed(2) : '0.00')}%)
                          </div>
                        </td>
                      </tr>
                    ))}

                    {/* 전체일 때 현금성 자산 합계 행 */}
                    {accountFilter === '전체' && cashBalances.length > 0 && (
                      <tr className="border-b border-gray-200/80 hover:bg-gray-100/80">
                        <td className="py-4 px-2 text-[#1a1a1a]">전체</td>
                        <td className="py-4 px-2 text-[#555555]">-</td>
                        <td className="py-4 px-2 text-[#1a1a1a]">현금성 자산</td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                        <td className="py-2 px-2">{formatCurrency(cashBalances.reduce((s,b) => s+b.balance, 0))}</td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                        <td className="py-2 px-2 text-[#555555]">0</td>
                        <td className="py-2 px-2 text-[#1a1a1a]">
                          {totalValuation > 0 ? ((cashBalances.reduce((s,b) => s+b.balance, 0) / (totalValuation + cashBalances.reduce((s,b) => s+b.balance, 0))) * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td className="py-2 px-2 text-[#1a1a1a]">현금</td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                      </tr>
                    )}

                    {/* 개별 계좌일 때 현금성 자산 행 */}
                    {accountFilter !== '전체' && (
                      <tr className="border-b border-gray-200/80 hover:bg-gray-100/80">
                        <td className="py-4 px-2 text-[#1a1a1a]">{accountFilter}</td>
                        <td className="py-4 px-2 text-[#555555]">-</td>
                        <td className="py-4 px-2 text-[#1a1a1a]">현금성 자산</td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                        <td className="py-2 px-2">
                          {editingCashAccount === accountFilter ? (
                            <div className="flex items-center gap-1">
                              <input type="number" value={cashInput}
                                onChange={e => setCashInput(e.target.value)}
                                className="w-28 bg-gray-200 border border-gray-400 rounded px-2 py-1 text-sm text-[#1a1a1a] focus:outline-none focus:border-blue-500" />
                              <button onClick={async () => {
                                await onUpdateCashBalance(accountFilter, parseFloat(cashInput) || 0);
                                setEditingCashAccount(null);
                              }} className="text-sm text-emerald-600 hover:text-emerald-300">저장</button>
                              <button onClick={() => setEditingCashAccount(null)}
                                className="text-sm text-[#555555] hover:text-[#1a1a1a]">취소</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{formatCurrency(getCashBalance(accountFilter))}</span>
                              <button onClick={() => {
                                setEditingCashAccount(accountFilter);
                                setCashInput(getCashBalance(accountFilter).toString());
                              }} className="text-sm text-[#555555] hover:text-blue-600">수정</button>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                        <td className="py-2 px-2 text-[#555555]">0</td>
                        <td className="py-2 px-2 text-[#1a1a1a]">
                          {totalValuation > 0 ? ((getCashBalance(accountFilter) / (totalValuation + getCashBalance(accountFilter))) * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td className="py-2 px-2 text-[#1a1a1a]">현금</td>
                        <td className="py-2 px-2 text-[#555555]">-</td>
                      </tr>
                    )}

                    {/* SELECTED TOTAL */}
                    <tr className="border-t-2 border-gray-400 bg-gray-50/80 font-medium">
                      <td className="py-2 px-2 text-[#1a1a1a] text-sm" colSpan={6}>SELECTED TOTAL (선택 합계)</td>
                      <td className="py-2 px-2 text-[#1a1a1a] text-sm">{formatCurrency(displayHoldings.reduce((s,h) => s+h.valuation, 0) + (accountFilter === '전체' ? totalCashBalance : getCashBalance(accountFilter)))}</td>
                      <td className={cn("py-2 px-2 text-sm", isPos(displayHoldings.reduce((s,h) => s+(h.return_rate*h.valuation), 0)/Math.max(displayHoldings.reduce((s,h) => s+h.valuation, 0),1)) ? "text-red-500" : "text-blue-500")}>
                        {formatPercent(displayHoldings.reduce((s,h) => s+(h.return_rate*h.valuation), 0)/Math.max(displayHoldings.reduce((s,h) => s+h.valuation, 0),1))}
                      </td>
                      <td className={cn("py-2 px-2 text-sm", isPos(displayHoldings.reduce((s,h) => s+h.profit, 0)) ? "text-red-500" : "text-blue-500")}>
                        {formatCurrency(displayHoldings.reduce((s,h) => s+h.profit, 0))}
                      </td>
                      <td className="py-2 px-2 text-[#1a1a1a] text-sm">100%</td>
                      <td className="py-2 px-2"></td>
                      <td className={cn("py-2 px-2 text-sm", isPos(displayHoldings.reduce((s,h) => s+(h.daily_change*(h.quantity||0)), 0)) ? "text-red-500" : "text-blue-500")}>
                        {formatCurrency(displayHoldings.reduce((s,h) => s+(h.daily_change*(h.quantity||0)), 0))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 박스2: 거래 내역 */}
            <div className="bg-white border border-gray-200 rounded-md p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-0 border-b border-gray-300">
                  {(['trade', 'income'] as const).map(t => (
                    <button key={t} onClick={() => setViewTab(t)}
                      className={cn(
                        'px-4 py-2 text-sm font-medium tracking-wide transition-colors border-b-2 -mb-px',
                        viewTab === t ? 'text-blue-600 border-blue-600' : 'text-[#555555] border-transparent hover:text-[#1a1a1a]'
                      )}>
                      {t === 'trade' ? '거래 내역' : `현금 소득 내역 (${cashIncomes.length})`}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { viewTab === 'income' ? setShowIncomeTable(v => !v) : setShowTradeTable(v => !v); }}
                    className="text-sm bg-gray-200 hover:bg-gray-300 text-[#1a1a1a] px-3 py-1.5 rounded-lg transition-colors">
                    {viewTab === 'income' ? (showIncomeTable ? '닫기' : '열기') : (showTradeTable ? '닫기' : '열기')}
                  </button>
                  <button onClick={() => { setShowForm(!showForm); setFormTab(viewTab === 'income' ? 'income' : 'trade'); }}
                    className="flex items-center gap-1 text-sm bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                    <Plus className="w-3 h-3" /> {viewTab === 'income' ? '소득 추가' : '거래 추가'}
                  </button>
                </div>
              </div>

              {/* 입력 폼 */}
              {showForm && (
                <div className="bg-gray-50/80 border border-gray-300 rounded-md p-4 mb-4">
                  {/* 폼 탭 */}
                  <div className="flex gap-2 mb-4">
                    {(['trade', 'income'] as const).map(t => (
                      <button key={t} onClick={() => setFormTab(t)}
                        className={cn('text-sm px-3 py-1.5 rounded-lg transition-colors',
                          formTab === t ? 'bg-blue-600 text-white' : 'bg-gray-200 text-[#1a1a1a] hover:text-[#1a1a1a]')}>
                        {t === 'trade' ? '거래 내역' : '현금 소득'}
                      </button>
                    ))}
                  </div>

                  {formTab === 'trade' ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: '날짜', key: 'trade_date', type: 'date' },
                        { label: '티커', key: 'ticker', type: 'text' },
                        { label: '종목명', key: 'stock_name', type: 'text' },
                        { label: '섹터', key: 'sector', type: 'text' },
                        { label: '수량', key: 'quantity', type: 'number' },
                        { label: '매수단가', key: 'buy_price', type: 'number' },
                        { label: '매도단가', key: 'sell_price', type: 'number' },
                        { label: '입출금금액', key: 'transfer_amount', type: 'number' },
                        { label: '메모', key: 'memo', type: 'text' },
                      ].map(({ label, key, type }) => (
                        <div key={key}>
                          <label className="text-sm text-[#1a1a1a] mb-1 block">{label}</label>
                          <input type={type} value={(form as any)[key]}
                            onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                            className={inputClass} />
                        </div>
                      ))}
                      {[
                        { label: '계좌', key: 'account', options: ACCOUNTS.filter(a => a !== '전체') },
                        { label: '매수/매도', key: 'trade_type', options: ['', '매수', '매도'] },
                        { label: '입출금', key: 'account_transfer', options: ['', '입금', '출금'] },
                        { label: '통화', key: 'currency', options: ['KRW', 'USD'] },
                      ].map(({ label, key, options }) => (
                        <div key={key}>
                          <label className="text-sm text-[#1a1a1a] mb-1 block">{label}</label>
                          <select value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                            className={selectClass}>
                            {options.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                      <div className="col-span-2 md:col-span-4 flex gap-2 justify-end mt-2">
                        <button onClick={() => { setShowForm(false); setEditingId(null); editingIdRef.current = null; }}
                          className="text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">취소</button>
                        <button onClick={editingIdRef.current ? () => handleUpdate(editingIdRef.current!) : handleSubmit}
                          className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
                          {editingIdRef.current ? '수정 저장' : '저장'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {[
                        { label: '날짜', key: 'income_date', type: 'date' },
                        { label: '금액', key: 'amount', type: 'number' },
                        { label: '티커', key: 'ticker', type: 'text' },
                        { label: '종목명', key: 'stock_name', type: 'text' },
                        { label: '메모', key: 'memo', type: 'text' },
                      ].map(({ label, key, type }) => (
                        <div key={key}>
                          <label className="text-sm text-[#1a1a1a] mb-1 block">{label}</label>
                          <input type={type} value={(incomeForm as any)[key]}
                            onChange={e => setIncomeForm(f => ({ ...f, [key]: e.target.value }))}
                            className={inputClass} />
                        </div>
                      ))}
                      {[
                        { label: '계좌', key: 'account', options: ACCOUNTS.filter(a => a !== '전체') },
                        { label: '소득 종류', key: 'income_type', options: INCOME_TYPES },
                      ].map(({ label, key, options }) => (
                        <div key={key}>
                          <label className="text-sm text-[#1a1a1a] mb-1 block">{label}</label>
                          <select value={(incomeForm as any)[key]} onChange={e => setIncomeForm(f => ({ ...f, [key]: e.target.value }))}
                            className={selectClass}>
                            {options.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                      <div className="col-span-2 md:col-span-4 flex gap-2 justify-end mt-2">
                        <button onClick={() => setShowForm(false)}
                          className="text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors">취소</button>
                        <button onClick={handleIncomeSubmit}
                          className="text-sm px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">저장</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 거래 내역 테이블 - 고정 높이 + 스크롤 */}
              {viewTab === 'trade' && showTradeTable && <div className="overflow-x-auto">
                <div style={{height: '320px', overflowY: 'auto'}}>
                  <table className="w-full text-sm">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-[#555555] border-b border-gray-200">
                        {['날짜', '계좌', '티커', '종목명', '입출금', '금액', '매수/매도', '수량', '매수단가', '매도단가', '손익', '수익율', ''].map(h => (
                          <th key={h} className="text-left py-2 px-2 font-medium tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id} className="border-b border-gray-200/80 hover:bg-gray-100/80 transition-colors">
                          <td className="py-2 px-2 text-[#1a1a1a]">{t.trade_date}</td>
                          <td className="py-2 px-2 text-[#1a1a1a]">{t.account}</td>
                          <td className="py-2 px-2 text-blue-600">{t.ticker || '-'}</td>
                          <td className="py-2 px-2">{t.stock_name || '-'}</td>
                          <td className="py-2 px-2 text-[#1a1a1a]">{t.account_transfer || '-'}</td>
                          <td className="py-2 px-2">{t.transfer_amount ? formatCurrency(t.transfer_amount) : '-'}</td>
                          <td className="py-2 px-2">{t.trade_type || '-'}</td>
                          <td className="py-2 px-2">{t.quantity || '-'}</td>
                          <td className="py-2 px-2">{t.buy_price ? formatCurrency(t.buy_price, t.currency) : '-'}</td>
                          <td className="py-2 px-2">{t.sell_price ? formatCurrency(t.sell_price, t.currency) : '-'}</td>
                          <td className={cn('py-2 px-2', t.profit_loss && t.profit_loss >= 0 ? 'text-red-500' : 'text-blue-500')}>
                            {t.profit_loss ? formatCurrency(t.profit_loss) : '-'}
                          </td>
                          <td className={cn('py-2 px-2', t.profit_rate && t.profit_rate >= 0 ? 'text-red-500' : 'text-blue-500')}>
                            {t.profit_rate ? formatPercent(t.profit_rate) : '-'}
                          </td>
                          <td className="py-2 px-2 flex gap-2">
                            <button onClick={() => {
                              const eid = t.id;
                              setForm({
                                trade_date: t.trade_date, account: t.account,
                                account_transfer: t.account_transfer || '',
                                transfer_amount: t.transfer_amount?.toString() || '',
                                ticker: t.ticker || '', stock_name: t.stock_name || '',
                                sector: t.sector || '', trade_type: t.trade_type || '',
                                quantity: t.quantity?.toString() || '',
                                buy_price: t.buy_price?.toString() || '',
                                sell_price: t.sell_price?.toString() || '',
                                currency: t.currency, memo: t.memo || '',
                              });
                              setEditingId(eid);
                              editingIdRef.current = eid;
                              setFormTab('trade');
                              setShowForm(true);
                            }} className="text-[#555555] hover:text-blue-600 transition-colors text-sm">수정</button>
                            <button onClick={() => onDeleteTransaction(t.id)} className="text-gray-300 hover:text-red-500 transition-colors">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>}
              {/* 현금 소득 내역 */}
              {viewTab === 'income' && showIncomeTable && (
                <div className="mt-4">
                  <p className="text-sm text-[#1a1a1a] tracking-wider mb-2">| 현금 소득 내역</p>
                  <div style={{height: '320px', overflowY: 'auto'}}>
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-[#555555] border-b border-gray-200">
                          {['날짜', '계좌', '종류', '티커', '종목명', '금액', '메모', ''].map(h => (
                            <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cashIncomes.map(c => (
                          <tr key={c.id} className="border-b border-gray-200/80 hover:bg-gray-100/80">
                            <td className="py-2 px-2 text-[#1a1a1a]">{c.income_date}</td>
                            <td className="py-2 px-2 text-[#1a1a1a]">{c.account}</td>
                            <td className="py-2 px-2 text-emerald-600">{c.income_type}</td>
                            <td className="py-2 px-2 text-blue-600">{c.ticker || '-'}</td>
                            <td className="py-2 px-2">{c.stock_name || '-'}</td>
                            <td className="py-2 px-2 text-emerald-600">{formatCurrency(c.amount)}</td>
                            <td className="py-2 px-2 text-[#1a1a1a]">{c.memo || '-'}</td>
                            <td className="py-2 px-2">
                              <button onClick={() => onDeleteCashIncome(c.id)} className="text-gray-300 hover:text-red-500">✕</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 탭3: 일일 결산 */}
        {activeTab === 2 && (
          <div className="space-y-4">
            {/* 그래프 */}
            <div className="bg-white border border-gray-200 rounded-md p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm text-[#1a1a1a] tracking-wider">| 성과 추이 MATRIX</h2>
                <div className="flex items-center gap-2">
                  <select value={profitMode} onChange={e => setProfitMode(e.target.value)}
                    className="text-sm bg-white border border-gray-200 rounded px-2 py-1.5 text-[#1a1a1a]">
                    <option value="cumulative">누적</option>
                    <option value="yearly">년도별 수익금</option>
                    <option value="monthly">월별 수익금</option>
                    <option value="daily">일별 수익금</option>
                  </select>
                  {profitMode === 'cumulative' && (
                    <select value={graphFilter} onChange={e => setGraphFilter(e.target.value as any)}
                      className="text-sm bg-white border border-gray-200 rounded px-2 py-1.5 text-[#1a1a1a]">
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

                // 수익금 막대 그래프 데이터 계산
                const calcProfitData = () => {
                  if (profitMode === 'yearly') {
                    const years = [...new Set(sorted.map(s => s.snapshot_date.slice(0,4)))];
                    return years.map((year, yi) => {
                      const yearSnaps = sorted.filter(s => s.snapshot_date.startsWith(year));
                      const last = yearSnaps[yearSnaps.length - 1];
                      const prevYearSnaps = yi === 0 ? [] : sorted.filter(s => s.snapshot_date.startsWith(years[yi-1]));
                      const prevLast = prevYearSnaps.length ? prevYearSnaps[prevYearSnaps.length-1] : null;
                      const prevVal = prevLast ? prevLast.total_valuation || 0 : 0;
                      const prevInv = prevLast ? prevLast.total_invested || 0 : 0;
                      const profit = (last.total_valuation||0) - prevVal - ((last.total_invested||0) - prevInv);
                      return { label: `${year}년`, profit };
                    });
                  }
                  if (profitMode === 'monthly') {
                    const months = [...new Set(sorted.map(s => s.snapshot_date.slice(0,7)))];
                    return months.map((month, mi) => {
                      const monthSnaps = sorted.filter(s => s.snapshot_date.startsWith(month));
                      const last = monthSnaps[monthSnaps.length-1];
                      const prevMonthSnaps = mi === 0 ? [] : sorted.filter(s => s.snapshot_date.startsWith(months[mi-1]));
                      const prevLast = prevMonthSnaps.length ? prevMonthSnaps[prevMonthSnaps.length-1] : null;
                      const prevVal = prevLast ? prevLast.total_valuation||0 : 0;
                      const prevInv = prevLast ? prevLast.total_invested||0 : 0;
                      const profit = (last.total_valuation||0) - prevVal - ((last.total_invested||0) - prevInv);
                      return { label: month, profit };
                    });
                  }
                  if (profitMode === 'daily') {
                    return sorted.map((s, i) => {
                      const prev = i === 0 ? null : sorted[i-1];
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
                    <ResponsiveContainer width="100%" height={450}>
                      <BarChart data={profitData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 10 }} interval={profitMode === 'daily' ? 30 : 0} />
                        <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`} />
                        <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" />
                        <Tooltip
                          contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }}
                          formatter={(v: any) => [
                            <span style={{ color: Number(v) >= 0 ? '#E24B4A' : '#378ADD' }}>{formatCurrency(Number(v))}</span>,
                            '수익금'
                          ]} />
                        <Bar dataKey="profit" name="수익금" isAnimationActive={false} fill="#E24B4A" label={false}>
                          {profitData.map((d, i) => (
                            <Cell key={i} fill={d.profit >= 0 ? '#E24B4A' : '#378ADD'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  );
                }

                // 누적 꺾은선 그래프
                const filterSnapshots = () => {
                  if (graphFilter === "daily") return snapshots;
                  const map = new Map<string, any>();
                  snapshots.forEach(s => {
                    const d = new Date(s.snapshot_date);
                    let key = "";
                    if (graphFilter === "monthly") key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
                    else if (graphFilter === "quarterly") { const q = Math.floor(d.getMonth()/3); key = `${d.getFullYear()}-Q${q+1}`; }
                    else if (graphFilter === "yearly") key = `${d.getFullYear()}`;
                    if (!map.has(key) || s.snapshot_date > map.get(key).snapshot_date) map.set(key, s);
                  });
                  return Array.from(map.values()).sort((a,b) => a.snapshot_date.localeCompare(b.snapshot_date));
                };
                const filtered = filterSnapshots();
                const xInterval = graphFilter === "daily" ? 30 : 0;
                const xFormatter = (v: string) => {
                  if (graphFilter === "yearly") return v?.slice(0,4);
                  if (graphFilter === "quarterly") return v?.slice(0,7);
                  return v?.slice(0,7);
                };
                return (
                  <ResponsiveContainer width="100%" height={450}>
                    <AreaChart data={filtered} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                      <XAxis dataKey="snapshot_date" tick={{ fill: '#64748b', fontSize: 10 }} interval={xInterval} tickFormatter={xFormatter} />
                      <YAxis tick={{ fill: '#64748b', fontSize: 10 }} tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`}
                        domain={[-10000000, (dataMax: number) => Math.ceil(dataMax * 1.05 / 10000000) * 10000000]} />
                      <ReferenceLine y={0} stroke="#94a3b8" strokeWidth={1} strokeDasharray="4 2" />
                      {highlightDate && <ReferenceLine x={highlightDate} stroke="#3b82f6" strokeWidth={2} label={{ value: highlightDate, position: "top", fontSize: 10, fill: "#3b82f6" }} />}
                      {targetValue > 0 && <ReferenceLine y={targetValue} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="6 3" label={{ value: `목표 ${(targetValue/1000000).toFixed(0)}M`, position: "right", fontSize: 10, fill: "#3b82f6" }} />}
                      <Tooltip contentStyle={{ background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: '8px', fontSize: '11px' }}
                        formatter={(v) => formatCurrency(Number(v))} />
                      <Area isAnimationActive={false} type="monotone" dataKey="total_valuation" name="평가액" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
                      <Area isAnimationActive={false} type="monotone" dataKey="total_invested" name="투자금" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                      <Area isAnimationActive={false} type="monotone" dataKey="total_profit" name="누적수익금" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                );
              })()}
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* CSV 업로드 */}
              <div className="bg-white border border-gray-200 rounded-md p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-[#1a1a1a] tracking-wider">| CSV 파일 업로드</p>
                  <button onClick={() => setShowCsvForm(v => !v)}
                    className="text-sm bg-gray-200 hover:bg-gray-300 text-[#1a1a1a] px-3 py-1 rounded-lg transition-colors">
                    {showCsvForm ? "닫기" : "열기"}
                  </button>
                </div>
                {showCsvForm && <>
                <p className="text-sm text-[#555555] mb-3">CSV 형식: 날짜,평가액,누적투자금,누적수익금</p>
                <p className="text-sm text-[#555555] mb-3">첫 번째 행은 헤더로 자동 무시됩니다</p>
                <div
                  className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
                  onClick={() => document.getElementById('csv-file-input')?.click()}
                  onDragOver={e => e.preventDefault()}
                  onDrop={e => {
                    e.preventDefault();
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = ev => setCsvInput(ev.target?.result as string || '');
                      reader.readAsText(file);
                    }
                  }}
                >
                  <p className="text-[#555555] text-sm mb-1">📁 클릭하거나 파일을 드래그하세요</p>
                  <p className="text-gray-300 text-sm">{csvInput ? `✅ 파일 로드됨 (${csvInput.split('\n').filter(l=>l.trim()).length}줄)` : '.csv 파일'}</p>
                </div>
                <input
                  id="csv-file-input"
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = ev => setCsvInput(ev.target?.result as string || '');
                      reader.readAsText(file);
                    }
                  }}
                />
                <button
                  onClick={() => onUploadCSV(csvInput)}
                  disabled={!csvInput}
                  className="mt-3 w-full text-sm bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg transition-colors">
                  {csvInput ? `업로드 (${csvInput.split('\n').filter(l=>l.trim()).length}줄)` : 'CSV 파일을 먼저 선택하세요'}
                </button>
                </>
                }
              </div>

              {/* 수기 입력 */}
              <div className="bg-white border border-gray-200 rounded-md p-5">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm text-[#1a1a1a] tracking-wider">| 수기 입력</p>
                  <button onClick={() => setShowManualForm(v => !v)}
                    className="text-sm bg-gray-200 hover:bg-gray-300 text-[#1a1a1a] px-3 py-1 rounded-lg transition-colors">
                    {showManualForm ? "닫기" : "열기"}
                  </button>
                </div>
                {showManualForm && <div className="space-y-3">
                  {[
                    { label: '날짜', key: 'date', type: 'date' },
                    { label: '평가액', key: 'valuation', type: 'number' },
                    { label: '누적투자금', key: 'totalInvested', type: 'number' },
                    { label: '누적수익금', key: 'cumulativeProfit', type: 'number' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label className="text-sm text-[#1a1a1a] mb-1 block">{label}</label>
                      <input type={type} value={(snapshotForm as any)[key]}
                        onChange={e => setSnapshotForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full bg-gray-200 border border-gray-400 rounded px-2 py-1.5 text-sm text-[#1a1a1a] focus:outline-none focus:border-blue-500" />
                    </div>
                  ))}
                  <button onClick={() => onAddSnapshot({
                      date: snapshotForm.date,
                      valuation: parseFloat(snapshotForm.valuation) || 0,
                      totalInvested: parseFloat(snapshotForm.totalInvested) || 0,
                      cumulativeProfit: parseFloat(snapshotForm.cumulativeProfit) || 0,
                    })}
                    className="w-full text-sm bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg transition-colors mt-2">
                    저장
                  </button>
                </div>
                }
              </div>
            </div>

            {/* 저장된 데이터 목록 */}
            <div className="bg-white border border-gray-200 rounded-md p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-[#1a1a1a] tracking-wider">| 저장된 일일 결산 데이터</p>
                <div className="flex items-center gap-2">
                  <input type="date" value={snapshotSearch}
                    onChange={e => { setSnapshotSearch(e.target.value); setHighlightDate(e.target.value); }}
                    className="text-sm bg-gray-100 border border-gray-300 rounded px-2 py-1 text-[#1a1a1a] focus:outline-none focus:border-blue-500" />
                  <button onClick={() => { setSnapshotSearch(''); setHighlightDate(''); }}
                    className="text-sm text-[#555555] hover:text-[#1a1a1a]">초기화</button>
                </div>
              </div>
              <div style={{height: '200px', overflowY: 'auto'}}>
                {(() => {
                  const sortedSnaps = [...snapshots].sort((a,b) => b.snapshot_date.localeCompare(a.snapshot_date));
                  const filtered = sortedSnaps.filter(s => !snapshotSearch || s.snapshot_date.includes(snapshotSearch));

                  if (profitMode === 'cumulative') {
                    return (
                      <table className="w-full text-sm">
                        <thead className="sticky top-0 bg-white">
                          <tr className="text-[#555555] border-b border-gray-200">
                            {['날짜', '평가액', '누적투자금', '누적수익금', ''].map(h => (
                              <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filtered.map((s, i) => (
                            <tr key={i} className="border-b border-gray-200/80 hover:bg-gray-100/80">
                              <td className={`py-2 px-2 ${highlightDate === s.snapshot_date ? 'text-blue-600 font-semibold' : 'text-[#1a1a1a]'}`}>
                                {s.snapshot_date}
                              </td>
                              <td className="py-2 px-2">{formatCurrency(s.total_valuation || 0)}</td>
                              <td className="py-2 px-2">{formatCurrency(s.total_invested || 0)}</td>
                              <td className={cn('py-2 px-2', (s.total_profit || 0) >= 0 ? 'text-red-500' : 'text-blue-500')}>
                                {formatCurrency(s.total_profit || 0)}
                              </td>
                              <td className="py-2 px-2">
                                <button onClick={() => onDeleteSnapshot(s.snapshot_date)}
                                  className="text-gray-300 hover:text-red-500">✕</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    );
                  }

                  // 년도별/월별/일별 수익금 테이블
                  const asc = [...snapshots].sort((a,b) => a.snapshot_date.localeCompare(b.snapshot_date));
                  const calcData = () => {
                    if (profitMode === 'yearly') {
                      const years = [...new Set(asc.map(s => s.snapshot_date.slice(0,4)))];
                      return years.map((year, yi) => {
                        const yearSnaps = asc.filter(s => s.snapshot_date.startsWith(year));
                        const last = yearSnaps[yearSnaps.length-1];
                        const prevYearSnaps = yi === 0 ? [] : asc.filter(s => s.snapshot_date.startsWith(years[yi-1]));
                        const prevLast = prevYearSnaps.length ? prevYearSnaps[prevYearSnaps.length-1] : null;
                        const prevVal = prevLast ? prevLast.total_valuation||0 : 0;
                        const prevInv = prevLast ? prevLast.total_invested||0 : 0;
                        const profit = (last.total_valuation||0) - prevVal - ((last.total_invested||0) - prevInv);
                        return { label: `${year}년`, profit, valuation: last.total_valuation||0 };
                      }).reverse();
                    }
                    if (profitMode === 'monthly') {
                      const months = [...new Set(asc.map(s => s.snapshot_date.slice(0,7)))];
                      return months.map((month, mi) => {
                        const monthSnaps = asc.filter(s => s.snapshot_date.startsWith(month));
                        const last = monthSnaps[monthSnaps.length-1];
                        const prevMonthSnaps = mi === 0 ? [] : asc.filter(s => s.snapshot_date.startsWith(months[mi-1]));
                        const prevLast = prevMonthSnaps.length ? prevMonthSnaps[prevMonthSnaps.length-1] : null;
                        const prevVal = prevLast ? prevLast.total_valuation||0 : 0;
                        const prevInv = prevLast ? prevLast.total_invested||0 : 0;
                        const profit = (last.total_valuation||0) - prevVal - ((last.total_invested||0) - prevInv);
                        return { label: month, profit, valuation: last.total_valuation||0 };
                      }).reverse();
                    }
                    if (profitMode === 'daily') {
                      return asc.map((s, i) => {
                        const prev = i === 0 ? null : asc[i-1];
                        const prevVal = prev ? prev.total_valuation||0 : 0;
                        const prevInv = prev ? prev.total_invested||0 : 0;
                        const profit = (s.total_valuation||0) - prevVal - ((s.total_invested||0) - prevInv);
                        return { label: s.snapshot_date, profit, valuation: s.total_valuation||0 };
                      }).reverse();
                    }
                    return [];
                  };
                  const tableData = calcData().filter(d => !snapshotSearch || d.label.includes(snapshotSearch));

                  return (
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-[#555555] border-b border-gray-200">
                          {['기간', '평가액', '수익금', ''].map(h => (
                            <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.map((d, i) => (
                          <tr key={i} className="border-b border-gray-200/80 hover:bg-gray-100/80">
                            <td className="py-2 px-2 text-[#1a1a1a]">{d.label}</td>
                            <td className="py-2 px-2">{formatCurrency(d.valuation)}</td>
                            <td className={cn('py-2 px-2', d.profit >= 0 ? 'text-red-500' : 'text-blue-500')}>
                              {formatCurrency(d.profit)}
                            </td>
                            <td className="py-2 px-2"></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
      <StockModal
        holding={selectedHolding}
        onClose={() => setSelectedHolding(null)}
      />
    </div>
  );
}
