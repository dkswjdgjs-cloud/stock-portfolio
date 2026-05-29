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

export function calcSummary(transactions: Transaction[], snapshots: any[] = []): SummaryData {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();

  const transfers = transactions.filter(t => t.account_transfer);

  // 현재 투자원금 (입금 - 출금 누적)
  const totalInvested = transfers.reduce((sum, t) => {
    const amount = t.transfer_amount || 0;
    return t.account_transfer === '입금' ? sum + amount : sum - amount;
  }, 0);

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

  // 스냅샷에서 전년도 말일, 전월 말일 데이터 조회
  const prevYearEnd = `${thisYear - 1}-12-31`;
  const prevMonthEnd = new Date(thisYear, thisMonth, 0).toISOString().split('T')[0];

  const findSnapshot = (targetDate: string) => {
    // 해당 날짜 또는 그 이전 가장 가까운 날짜의 스냅샷
    const sorted = snapshots
      .filter(s => s.snapshot_date <= targetDate)
      .sort((a, b) => b.snapshot_date.localeCompare(a.snapshot_date));
    return sorted[0] || null;
  };

  const prevYearSnapshot = findSnapshot(prevYearEnd);
  const prevMonthSnapshot = findSnapshot(prevMonthEnd);

  const prevYearValuation = prevYearSnapshot?.total_valuation || 0;
  const prevYearInvested = prevYearSnapshot?.total_invested || 0;
  const prevMonthValuation = prevMonthSnapshot?.total_valuation || 0;
  const prevMonthInvested = prevMonthSnapshot?.total_invested || 0;

  return {
    prevMonthValue: prevMonthValuation,
    currMonthInvestment,
    currMonthValue: 0,
    cumulativeProfit: 0, // currMonthValue 설정 후 page.tsx에서 계산
    cumulativeReturn: 0,
    annualProfit: 0,
    annualReturn: 0,
    monthlyProfit: 0,
    monthlyReturn: 0,
    dailyProfit: 0,
    dailyReturn: 0,
    totalInvested,
    prevYearValuation,
    prevYearInvested,
    prevMonthValuation,
    prevMonthInvested,
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
