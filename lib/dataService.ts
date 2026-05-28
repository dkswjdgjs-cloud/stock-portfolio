import { supabase } from './supabase';
import { Transaction, AccountHolding, SummaryData, DailySettlement } from '../types';

export async function fetchTransactions(): Promise<Transaction[]> {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('trade_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export function calcSummary(transactions: Transaction[]): SummaryData {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const prevMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const prevMonthYear = thisMonth === 0 ? thisYear - 1 : thisYear;

  const transfers = transactions.filter(t => t.account_transfer);
  const trades = transactions.filter(t => t.trade_type);

  // 누적 투입금 (입금 - 출금)
  const totalInvested = transfers.reduce((sum, t) => {
    const amount = t.transfer_amount || 0;
    return t.account_transfer === '입금' ? sum + amount : sum - amount;
  }, 0);

  // 누적 수익금
  const cumulativeProfit = trades
    .filter(t => t.trade_type === '매도')
    .reduce((sum, t) => sum + (t.profit_loss || 0), 0);

  // 당월 투입금
  const currMonthInvestment = transfers
    .filter(t => {
      const d = new Date(t.trade_date);
      return d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    })
    .reduce((sum, t) => {
      const amount = t.transfer_amount || 0;
      return t.account_transfer === '입금' ? sum + amount : sum - amount;
    }, 0);

  // 연간 수익금
  const annualProfit = trades
    .filter(t => {
      const d = new Date(t.trade_date);
      return t.trade_type === '매도' && d.getFullYear() === thisYear;
    })
    .reduce((sum, t) => sum + (t.profit_loss || 0), 0);

  // 월간 수익금
  const monthlyProfit = trades
    .filter(t => {
      const d = new Date(t.trade_date);
      return t.trade_type === '매도' && d.getFullYear() === thisYear && d.getMonth() === thisMonth;
    })
    .reduce((sum, t) => sum + (t.profit_loss || 0), 0);

  // 일간 수익금 (오늘)
  const today = now.toISOString().split('T')[0];
  const dailyProfit = trades
    .filter(t => t.trade_type === '매도' && t.trade_date === today)
    .reduce((sum, t) => sum + (t.profit_loss || 0), 0);

  return {
    prevMonthValue: 0, // 한투 API 연동 후 계산
    currMonthInvestment,
    currMonthValue: 0, // 한투 API 연동 후 계산
    cumulativeProfit,
    cumulativeReturn: totalInvested > 0 ? (cumulativeProfit / totalInvested) * 100 : 0,
    annualProfit,
    annualReturn: totalInvested > 0 ? (annualProfit / totalInvested) * 100 : 0,
    monthlyProfit,
    monthlyReturn: totalInvested > 0 ? (monthlyProfit / totalInvested) * 100 : 0,
    dailyProfit,
    dailyReturn: totalInvested > 0 ? (dailyProfit / totalInvested) * 100 : 0,
    totalInvested,
  };
}

export function calcDailySettlement(transactions: Transaction[]): DailySettlement[] {
  const map = new Map<string, { principal: number; profit: number }>();

  transactions.forEach(t => {
    const date = t.trade_date;
    if (!map.has(date)) map.set(date, { principal: 0, profit: 0 });
    const entry = map.get(date)!;
    if (t.account_transfer === '입금') entry.principal += t.transfer_amount || 0;
    if (t.account_transfer === '출금') entry.principal -= t.transfer_amount || 0;
    if (t.trade_type === '매도') entry.profit += t.profit_loss || 0;
  });

  let cumPrincipal = 0;
  let cumProfit = 0;

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, { principal, profit }]) => {
      cumPrincipal += principal;
      cumProfit += profit;
      return {
        date,
        valuation: cumPrincipal + cumProfit,
        principal: cumPrincipal,
        cumulativeProfit: cumProfit,
      };
    });
}
