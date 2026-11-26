import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getQuote, getUSDKRWRate } from '@/lib/kisQuote';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

// 한국 시간 기준 오늘 날짜 (YYYY-MM-DD)
function todayKST(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

interface Holding {
  account: string;
  ticker: string;
  stock_name: string;
  currency: string;
  quantity: number;
  totalCost: number;
}

// 현재가. 실패하면 한 번 더 시도하고, 그래도 실패하면 마지막으로 저장된 스냅샷의 가격을 쓴다.
async function priceOf(h: Holding, lastPrices: Map<string, number>): Promise<number | null> {
  const market = h.currency === 'USD' ? 'US' : 'KR';
  let q = await getQuote(h.ticker, market);
  if (!q) {
    await new Promise((r) => setTimeout(r, 1500));
    q = await getQuote(h.ticker, market);
  }
  if (q) return q.price;
  return lastPrices.get(h.ticker) ?? null;
}

export async function POST() {
  try {
    const today = todayKST();
    const [{ data: transactions, error: txErr }, { data: cashBalances }, { data: cashIncomes }] = await Promise.all([
      supabase.from('transactions').select('*'),
      supabase.from('cash_balance').select('*'),
      supabase.from('cash_income').select('*'),
    ]);
    if (txErr || !transactions) return NextResponse.json({ error: txErr?.message || 'No transactions' }, { status: 500 });

    const holdingMap = new Map<string, Holding>();
    transactions.filter((t) => t.trade_type && t.ticker).forEach((t) => {
      const key = `${t.account}-${t.ticker}`;
      if (!holdingMap.has(key)) holdingMap.set(key, { account: t.account, ticker: t.ticker, stock_name: t.stock_name || '', currency: t.currency, quantity: 0, totalCost: 0 });
      const h = holdingMap.get(key)!;
      if (t.trade_type === '매수') { h.quantity += t.quantity || 0; h.totalCost += (t.quantity || 0) * (t.buy_price || 0); }
      else if (t.trade_type === '매도') { h.quantity -= t.quantity || 0; h.totalCost -= (t.quantity || 0) * (t.buy_price || 0); }
    });
    const holdings = [...holdingMap.values()].filter((h) => h.quantity > 0);

    // 시세 실패 시 대신 쓸 직전 스냅샷 가격 (종목별 가장 최근 curr_price)
    const { data: lastRows } = await supabase
      .from('daily_snapshot')
      .select('ticker, curr_price, snapshot_date')
      .lt('snapshot_date', today)
      .not('curr_price', 'is', null)
      .order('snapshot_date', { ascending: false })
      .limit(500);
    const lastPrices = new Map<string, number>();
    for (const r of lastRows || []) if (!lastPrices.has(r.ticker) && r.curr_price > 0) lastPrices.set(r.ticker, r.curr_price);

    const usdKrw = holdings.some((h) => h.currency === 'USD') ? await getUSDKRWRate() : 1;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const snapshots: any[] = [];
    const missing: string[] = [];
    let totalValuation = 0;
    for (const h of holdings) {
      const currPrice = await priceOf(h, lastPrices);
      if (currPrice == null) { missing.push(h.ticker); continue; }
      const fx = h.currency === 'USD' ? usdKrw : 1;
      const avgPrice = h.totalCost / h.quantity;
      // 가격·평단은 원래 통화 그대로, 평가액·손익은 원화로 저장
      const valuation = currPrice * h.quantity * fx;
      const profit = (currPrice - avgPrice) * h.quantity * fx;
      const returnRate = avgPrice > 0 ? ((currPrice - avgPrice) / avgPrice) * 100 : 0;
      totalValuation += valuation;
      snapshots.push({ snapshot_date: today, account: h.account, ticker: h.ticker, stock_name: h.stock_name, quantity: h.quantity, avg_price: avgPrice, curr_price: currPrice, valuation, profit, return_rate: returnRate, currency: h.currency, total_valuation: null, total_invested: null, total_profit: null });
    }

    // 시세를 하나라도 못 구하면 틀린 합계를 저장하지 않는다
    if (missing.length) {
      return NextResponse.json({ error: `시세 조회 실패로 저장하지 않음: ${missing.join(', ')}` }, { status: 502 });
    }

    for (const cb of cashBalances || []) {
      totalValuation += cb.balance;
      snapshots.push({ snapshot_date: today, account: cb.account, ticker: 'CASH', stock_name: '현금성 자산', quantity: null, avg_price: null, curr_price: null, valuation: cb.balance, profit: 0, return_rate: 0, currency: 'KRW', total_valuation: null, total_invested: null, total_profit: null });
    }

    const totalInvested = transactions.filter((t) => t.account_transfer).reduce((sum, t) => {
      const amount = t.transfer_amount || 0;
      return t.account_transfer === '입금' ? sum + amount : sum - amount;
    }, 0);
    const tradingProfit = transactions.filter((t) => t.trade_type === '매도').reduce((sum, t) => sum + (t.profit_loss || 0), 0);
    const cashIncomeTotal = (cashIncomes || []).reduce((sum, c) => sum + c.amount, 0);
    const totalProfit = tradingProfit + cashIncomeTotal;
    snapshots.push({ snapshot_date: today, account: '합계', ticker: 'TOTAL', stock_name: '전체 합계', quantity: null, avg_price: null, curr_price: null, valuation: totalValuation, profit: totalProfit, return_rate: totalInvested > 0 ? (totalProfit / totalInvested) * 100 : 0, currency: 'KRW', total_valuation: totalValuation, total_invested: totalInvested, total_profit: totalProfit });

    const { error } = await supabase.from('daily_snapshot').upsert(snapshots, { onConflict: 'snapshot_date,account,ticker' });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, date: today, count: snapshots.length, usdKrw });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
