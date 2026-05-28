'use client';
import React, { useState, useRef } from 'react';
import { TrendingUp, RefreshCw, Plus, LayoutDashboard, Building2, Clock } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, ReferenceLine } from 'recharts';
import { formatCurrency, formatPercent, cn } from '@/lib/utils';
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
      const data = filteredHoldings.map(h => ({ name: h.stock_name, ticker: h.ticker, value: h.valuation }));
      if (totalCashBalance > 0) data.push({ name: '현금성 자산', ticker: 'CASH', value: totalCashBalance });
      return data;
    }
    if (pieFilter === '계좌별') {
      const map = new Map<string, number>();
      filteredHoldings.forEach(h => map.set(h.account, (map.get(h.account) || 0) + h.valuation));
      return Array.from(map.entries()).map(([name, value]) => ({ name, ticker: '', value }));
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
  const pieData = getPieData();

  const TABS = [
    { label: '종합 내역', icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
    { label: '계좌 내역', icon: <Building2 className="w-3.5 h-3.5" /> },
    { label: '일일 결산', icon: <Clock className="w-3.5 h-3.5" /> },
  ];

  const inputClass = "w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500";
  const selectClass = "w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200";

  // 계좌 필터링된 holdings
  const displayHoldings = filteredHoldings;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-mono">
      {/* 헤더 */}
      <div className="sticky top-0 z-10 bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center">
            <span className="text-white font-bold text-sm">W</span>
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold tracking-widest text-slate-100">WEALTHFLOW</h1>
            <span className="text-xs text-blue-400 tracking-wider">portfolio analytics</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-700 rounded-full px-3 py-1">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-xs text-emerald-400 tracking-wider">LIVE SYNC ACTIVE</span>
          </div>
          <span className="text-xs text-slate-500 ml-2">
            {lastUpdated ? lastUpdated.toLocaleTimeString('ko-KR') : '--:--:--'}
          </span>
          <button onClick={onRefresh} className="ml-1 text-slate-400 hover:text-slate-200 transition-colors">
            <RefreshCw className={cn('w-3.5 h-3.5', isRefreshing && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-6">
        <div className="flex">
          {TABS.map((tab, i) => (
            <button key={i} onClick={() => setActiveTab(i)}
              className={cn(
                'flex items-center gap-2 px-4 py-3 text-xs font-medium tracking-wide transition-colors border-b-2 -mb-px',
                activeTab === i ? 'text-blue-400 border-blue-400' : 'text-slate-500 border-transparent hover:text-slate-300'
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
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-xs text-slate-500 tracking-wider mb-2">전월 평가액</p>
                <p className="text-2xl font-bold text-slate-100">{formatCurrency(summary.prevMonthValue)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-xs text-slate-500 tracking-wider mb-2">투입금액</p>
                <p className="text-2xl font-bold text-slate-100">{formatCurrency(summary.totalInvested)}</p>
                <div className="mt-2 pt-2 border-t border-slate-700">
                  <p className="text-xs text-slate-500">당월 투입액</p>
                  <p className="text-sm text-slate-300">{formatCurrency(summary.currMonthInvestment)}</p>
                </div>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-xs text-slate-500 tracking-wider mb-2">현재 평가액</p>
                <p className="text-2xl font-bold text-slate-100">{formatCurrency(summary.currMonthValue)}</p>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: '누적 수익금', profit: summary.cumulativeProfit, rate: summary.cumulativeReturn },
                { label: '연 수익금', profit: summary.annualProfit, rate: summary.annualReturn },
                { label: '월 수익금', profit: summary.monthlyProfit, rate: summary.monthlyReturn },
                { label: '일 수익금', profit: summary.dailyProfit, rate: summary.dailyReturn },
              ].map((item, i) => (
                <div key={i} className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                  <p className="text-xs text-slate-500 tracking-wider mb-2">{item.label}</p>
                  <p className={cn('text-xl font-bold', isPos(item.profit) ? 'text-emerald-400' : 'text-red-400')}>
                    {formatCurrency(item.profit)}
                  </p>
                  <p className={cn('text-sm mt-1', isPos(item.rate) ? 'text-emerald-400' : 'text-red-400')}>
                    {formatPercent(item.rate)}
                  </p>
                </div>
              ))}
            </div>

            {/* 파이차트 + 상세내역 */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col" style={{height: "450px"}}>
                <div className="flex items-center justify-between mb-4">
                  <p className="text-xs text-slate-400 tracking-wider">| ASSET ALLOCATION</p>
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
                      <p className="text-sm text-slate-500 tracking-wider">MARKET VALUE</p>
                      <p className="text-2xl font-bold text-slate-100">{formatCurrency(totalValuation)}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col" style={{height: "450px"}}>
                <p className="text-xs text-slate-400 tracking-wider mb-4">| ALL HOLDINGS BREAKDOWN</p>
                <div className="space-y-4 overflow-y-auto flex-1">
                  {pieData.map((d, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-sm text-blue-400 font-medium">{d.ticker || d.name}</span>
                        <span className="text-sm text-slate-400">{d.ticker ? d.name : ''}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="text-sm text-slate-200">{formatCurrency(d.value)}</span>
                        <span className="text-sm text-emerald-400 w-14 text-right">
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs text-slate-400 tracking-wider">| 계좌 상세 내역</h2>
                <select value={accountFilter} onChange={e => onAccountFilterChange(e.target.value)}
                  className="text-xs bg-slate-800 border border-slate-700 rounded px-2 py-1 text-slate-300">
                  {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-800">
                      {['계좌', 'TICKER', '종목명', '평균단가', '수량', '현재단가', '평가액', '수익율', '수익금', '비중', '섹터', '일일등락'].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-medium tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {displayHoldings.map((h, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-2 text-slate-400">{h.account}</td>
                        <td className="py-2 px-2 text-blue-400">{h.ticker}</td>
                        <td className="py-2 px-2">{h.stock_name}</td>
                        <td className="py-2 px-2">{formatCurrency(h.avg_price, h.currency)}</td>
                        <td className="py-2 px-2">{h.quantity}</td>
                        <td className="py-2 px-2">{formatCurrency(h.curr_price, h.currency)}</td>
                        <td className="py-2 px-2 font-medium">{formatCurrency(h.valuation)}</td>
                        <td className={cn('py-2 px-2', isPos(h.return_rate) ? 'text-emerald-400' : 'text-red-400')}>{formatPercent(h.return_rate)}</td>
                        <td className={cn('py-2 px-2', isPos(h.profit) ? 'text-emerald-400' : 'text-red-400')}>{formatCurrency(h.profit)}</td>
                        <td className="py-2 px-2 text-slate-400">{h.weight.toFixed(1)}%</td>
                        <td className="py-2 px-2 text-slate-400">{h.sector}</td>
                        <td className={cn('py-2 px-2', isPos(h.daily_change) ? 'text-emerald-400' : 'text-red-400')}>{formatPercent(h.daily_change)}</td>
                      </tr>
                    ))}

                    {/* 전체일 때 현금성 자산 합계 행 */}
                    {accountFilter === '전체' && cashBalances.length > 0 && (
                      <tr className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-400">전체</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2 text-slate-300">현금성 자산</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2">{formatCurrency(cashBalances.reduce((s,b) => s+b.balance, 0))}</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2 text-slate-500">0</td>
                        <td className="py-2 px-2 text-slate-400">
                          {totalValuation > 0 ? ((cashBalances.reduce((s,b) => s+b.balance, 0) / (totalValuation + cashBalances.reduce((s,b) => s+b.balance, 0))) * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td className="py-2 px-2 text-slate-400">현금</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                      </tr>
                    )}

                    {/* 개별 계좌일 때 현금성 자산 행 */}
                    {accountFilter !== '전체' && (
                      <tr className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-400">{accountFilter}</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2 text-slate-300">현금성 자산</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2">
                          {editingCashAccount === accountFilter ? (
                            <div className="flex items-center gap-1">
                              <input type="number" value={cashInput}
                                onChange={e => setCashInput(e.target.value)}
                                className="w-28 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                              <button onClick={async () => {
                                await onUpdateCashBalance(accountFilter, parseFloat(cashInput) || 0);
                                setEditingCashAccount(null);
                              }} className="text-xs text-emerald-400 hover:text-emerald-300">저장</button>
                              <button onClick={() => setEditingCashAccount(null)}
                                className="text-xs text-slate-500 hover:text-slate-300">취소</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2">
                              <span>{formatCurrency(getCashBalance(accountFilter))}</span>
                              <button onClick={() => {
                                setEditingCashAccount(accountFilter);
                                setCashInput(getCashBalance(accountFilter).toString());
                              }} className="text-xs text-slate-500 hover:text-blue-400">수정</button>
                            </div>
                          )}
                        </td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                        <td className="py-2 px-2 text-slate-500">0</td>
                        <td className="py-2 px-2 text-slate-400">
                          {totalValuation > 0 ? ((getCashBalance(accountFilter) / (totalValuation + getCashBalance(accountFilter))) * 100).toFixed(1) : '0.0'}%
                        </td>
                        <td className="py-2 px-2 text-slate-400">현금</td>
                        <td className="py-2 px-2 text-slate-500">-</td>
                      </tr>
                    )}

                    {/* SELECTED TOTAL */}
                    <tr className="border-t-2 border-slate-600 bg-slate-800/50 font-medium">
                      <td className="py-2 px-2 text-slate-300 text-xs" colSpan={6}>SELECTED TOTAL (선택 합계)</td>
                      <td className="py-2 px-2 text-slate-100 text-xs">{formatCurrency(displayHoldings.reduce((s,h) => s+h.valuation, 0))}</td>
                      <td className={cn("py-2 px-2 text-xs", isPos(displayHoldings.reduce((s,h) => s+(h.return_rate*h.valuation), 0)/Math.max(displayHoldings.reduce((s,h) => s+h.valuation, 0),1)) ? "text-emerald-400" : "text-red-400")}>
                        {formatPercent(displayHoldings.reduce((s,h) => s+(h.return_rate*h.valuation), 0)/Math.max(displayHoldings.reduce((s,h) => s+h.valuation, 0),1))}
                      </td>
                      <td className={cn("py-2 px-2 text-xs", isPos(displayHoldings.reduce((s,h) => s+h.profit, 0)) ? "text-emerald-400" : "text-red-400")}>
                        {formatCurrency(displayHoldings.reduce((s,h) => s+h.profit, 0))}
                      </td>
                      <td className="py-2 px-2 text-slate-400 text-xs">100%</td>
                      <td className="py-2 px-2"></td>
                      <td className={cn("py-2 px-2 text-xs", isPos(displayHoldings.reduce((s,h) => s+(h.daily_change*h.valuation), 0)/Math.max(displayHoldings.reduce((s,h) => s+h.valuation, 0),1)) ? "text-emerald-400" : "text-red-400")}>
                        {formatPercent(displayHoldings.reduce((s,h) => s+(h.daily_change*h.valuation), 0)/Math.max(displayHoldings.reduce((s,h) => s+h.valuation, 0),1))}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* 박스2: 거래 내역 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-0 border-b border-slate-700">
                  {(['trade', 'income'] as const).map(t => (
                    <button key={t} onClick={() => setViewTab(t)}
                      className={cn(
                        'px-4 py-2 text-xs font-medium tracking-wide transition-colors border-b-2 -mb-px',
                        viewTab === t ? 'text-blue-400 border-blue-400' : 'text-slate-500 border-transparent hover:text-slate-300'
                      )}>
                      {t === 'trade' ? '거래 내역' : `현금 소득 내역 (${cashIncomes.length})`}
                    </button>
                  ))}
                </div>
                <button onClick={() => { setShowForm(!showForm); setFormTab(viewTab === 'income' ? 'income' : 'trade'); }}
                  className="flex items-center gap-1 text-xs bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  <Plus className="w-3 h-3" /> {viewTab === 'income' ? '소득 추가' : '거래 추가'}
                </button>
              </div>

              {/* 입력 폼 */}
              {showForm && (
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 mb-4">
                  {/* 폼 탭 */}
                  <div className="flex gap-2 mb-4">
                    {(['trade', 'income'] as const).map(t => (
                      <button key={t} onClick={() => setFormTab(t)}
                        className={cn('text-xs px-3 py-1.5 rounded-lg transition-colors',
                          formTab === t ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200')}>
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
                          <label className="text-xs text-slate-400 mb-1 block">{label}</label>
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
                          <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                          <select value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                            className={selectClass}>
                            {options.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                      <div className="col-span-2 md:col-span-4 flex gap-2 justify-end mt-2">
                        <button onClick={() => { setShowForm(false); setEditingId(null); editingIdRef.current = null; }}
                          className="text-xs px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">취소</button>
                        <button onClick={editingIdRef.current ? () => handleUpdate(editingIdRef.current!) : handleSubmit}
                          className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">
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
                          <label className="text-xs text-slate-400 mb-1 block">{label}</label>
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
                          <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                          <select value={(incomeForm as any)[key]} onChange={e => setIncomeForm(f => ({ ...f, [key]: e.target.value }))}
                            className={selectClass}>
                            {options.map(o => <option key={o}>{o}</option>)}
                          </select>
                        </div>
                      ))}
                      <div className="col-span-2 md:col-span-4 flex gap-2 justify-end mt-2">
                        <button onClick={() => setShowForm(false)}
                          className="text-xs px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors">취소</button>
                        <button onClick={handleIncomeSubmit}
                          className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg transition-colors">저장</button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 거래 내역 테이블 - 고정 높이 + 스크롤 */}
              {viewTab === 'trade' && <div className="overflow-x-auto">
                <div style={{height: '320px', overflowY: 'auto'}}>
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-slate-900">
                      <tr className="text-slate-500 border-b border-slate-800">
                        {['날짜', '계좌', '티커', '종목명', '입출금', '금액', '매수/매도', '수량', '매수단가', '매도단가', '손익', '수익율', ''].map(h => (
                          <th key={h} className="text-left py-2 px-2 font-medium tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((t) => (
                        <tr key={t.id} className="border-b border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-2 text-slate-400">{t.trade_date}</td>
                          <td className="py-2 px-2 text-slate-400">{t.account}</td>
                          <td className="py-2 px-2 text-blue-400">{t.ticker || '-'}</td>
                          <td className="py-2 px-2">{t.stock_name || '-'}</td>
                          <td className="py-2 px-2 text-slate-400">{t.account_transfer || '-'}</td>
                          <td className="py-2 px-2">{t.transfer_amount ? formatCurrency(t.transfer_amount) : '-'}</td>
                          <td className="py-2 px-2">{t.trade_type || '-'}</td>
                          <td className="py-2 px-2">{t.quantity || '-'}</td>
                          <td className="py-2 px-2">{t.buy_price ? formatCurrency(t.buy_price, t.currency) : '-'}</td>
                          <td className="py-2 px-2">{t.sell_price ? formatCurrency(t.sell_price, t.currency) : '-'}</td>
                          <td className={cn('py-2 px-2', t.profit_loss && t.profit_loss >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                            {t.profit_loss ? formatCurrency(t.profit_loss) : '-'}
                          </td>
                          <td className={cn('py-2 px-2', t.profit_rate && t.profit_rate >= 0 ? 'text-emerald-400' : 'text-red-400')}>
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
                            }} className="text-slate-500 hover:text-blue-400 transition-colors text-xs">수정</button>
                            <button onClick={() => onDeleteTransaction(t.id)} className="text-slate-600 hover:text-red-400 transition-colors">✕</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

              </div>}
              {/* 현금 소득 내역 */}
              {viewTab === 'income' && (
                <div className="mt-4">
                  <p className="text-xs text-slate-400 tracking-wider mb-2">| 현금 소득 내역</p>
                  <div style={{height: '320px', overflowY: 'auto'}}>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-slate-900">
                        <tr className="text-slate-500 border-b border-slate-800">
                          {['날짜', '계좌', '종류', '티커', '종목명', '금액', '메모', ''].map(h => (
                            <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {cashIncomes.map(c => (
                          <tr key={c.id} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                            <td className="py-2 px-2 text-slate-400">{c.income_date}</td>
                            <td className="py-2 px-2 text-slate-400">{c.account}</td>
                            <td className="py-2 px-2 text-emerald-400">{c.income_type}</td>
                            <td className="py-2 px-2 text-blue-400">{c.ticker || '-'}</td>
                            <td className="py-2 px-2">{c.stock_name || '-'}</td>
                            <td className="py-2 px-2 text-emerald-400">{formatCurrency(c.amount)}</td>
                            <td className="py-2 px-2 text-slate-400">{c.memo || '-'}</td>
                            <td className="py-2 px-2">
                              <button onClick={() => onDeleteCashIncome(c.id)} className="text-slate-600 hover:text-red-400">✕</button>
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
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xs text-slate-400 tracking-wider">| 성과 추이 MATRIX</h2>
                <button onClick={onSaveSnapshot}
                  className="flex items-center gap-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg transition-colors">
                  오늘 스냅샷 저장
                </button>
              </div>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={snapshots} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                  <XAxis
                    dataKey="snapshot_date"
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    interval={30}
                    tickFormatter={(v) => v?.slice(0, 7)}
                  />
                  <YAxis
                    tick={{ fill: '#64748b', fontSize: 10 }}
                    tickFormatter={(v) => `${(v/1000000).toFixed(0)}M`}
                    domain={[-5000000, 'auto']}
                  />
                  <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }}
                    formatter={(v) => formatCurrency(Number(v))} />
                  <Area type="monotone" dataKey="total_valuation" name="평가액" stroke="#3b82f6" fill="#3b82f620" strokeWidth={2} />
                  <Area type="monotone" dataKey="total_invested" name="투자금" stroke="#10b981" fill="#10b98120" strokeWidth={2} />
                  <Area type="monotone" dataKey="total_profit" name="누적수익금" stroke="#f59e0b" fill="#f59e0b20" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {/* CSV 업로드 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-xs text-slate-400 tracking-wider mb-4">| CSV 파일 업로드</p>
                <p className="text-xs text-slate-500 mb-3">CSV 형식: 날짜,평가액,누적투자금,누적수익금</p>
                <p className="text-xs text-slate-500 mb-3">첫 번째 행은 헤더로 자동 무시됩니다</p>
                <div
                  className="w-full h-32 border-2 border-dashed border-slate-700 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 transition-colors"
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
                  <p className="text-slate-500 text-xs mb-1">📁 클릭하거나 파일을 드래그하세요</p>
                  <p className="text-slate-600 text-xs">{csvInput ? `✅ 파일 로드됨 (${csvInput.split('\n').filter(l=>l.trim()).length}줄)` : '.csv 파일'}</p>
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
                  className="mt-3 w-full text-xs bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white py-2 rounded-lg transition-colors">
                  {csvInput ? `업로드 (${csvInput.split('\n').filter(l=>l.trim()).length}줄)` : 'CSV 파일을 먼저 선택하세요'}
                </button>
              </div>

              {/* 수기 입력 */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
                <p className="text-xs text-slate-400 tracking-wider mb-4">| 수기 입력</p>
                <div className="space-y-3">
                  {[
                    { label: '날짜', key: 'date', type: 'date' },
                    { label: '평가액', key: 'valuation', type: 'number' },
                    { label: '누적투자금', key: 'totalInvested', type: 'number' },
                    { label: '누적수익금', key: 'cumulativeProfit', type: 'number' },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
                      <input type={type} value={(snapshotForm as any)[key]}
                        onChange={e => setSnapshotForm(f => ({ ...f, [key]: e.target.value }))}
                        className="w-full bg-slate-700 border border-slate-600 rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500" />
                    </div>
                  ))}
                  <button onClick={() => onAddSnapshot({
                      date: snapshotForm.date,
                      valuation: parseFloat(snapshotForm.valuation) || 0,
                      totalInvested: parseFloat(snapshotForm.totalInvested) || 0,
                      cumulativeProfit: parseFloat(snapshotForm.cumulativeProfit) || 0,
                    })}
                    className="w-full text-xs bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg transition-colors mt-2">
                    저장
                  </button>
                </div>
              </div>
            </div>

            {/* 저장된 데이터 목록 */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
              <p className="text-xs text-slate-400 tracking-wider mb-4">| 저장된 일일 결산 데이터</p>
              <div style={{height: '200px', overflowY: 'auto'}}>
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-slate-900">
                    <tr className="text-slate-500 border-b border-slate-800">
                      {['날짜', '평가액', '누적투자금', '누적수익금', ''].map(h => (
                        <th key={h} className="text-left py-2 px-2 font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((s, i) => (
                      <tr key={i} className="border-b border-slate-800/50 hover:bg-slate-800/30">
                        <td className="py-2 px-2 text-slate-400">{s.snapshot_date}</td>
                        <td className="py-2 px-2">{formatCurrency(s.total_valuation || 0)}</td>
                        <td className="py-2 px-2">{formatCurrency(s.total_invested || 0)}</td>
                        <td className={cn('py-2 px-2', (s.total_profit || 0) >= 0 ? 'text-emerald-400' : 'text-red-400')}>
                          {formatCurrency(s.total_profit || 0)}
                        </td>
                        <td className="py-2 px-2">
                          <button onClick={() => onDeleteSnapshot(s.snapshot_date)}
                            className="text-slate-600 hover:text-red-400">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
