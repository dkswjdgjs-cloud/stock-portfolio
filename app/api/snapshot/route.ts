import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');

  let query = supabase
    .from('daily_snapshot')
    .select('*')
    .eq('account', '합계')
    .order('snapshot_date', { ascending: true });

  if (date) query = query.eq('snapshot_date', date);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const rows = Array.isArray(body) ? body : [body];

  const snapshots = rows.map((r: any) => ({
    snapshot_date: r.date,
    account: '합계',
    ticker: 'TOTAL',
    stock_name: '전체 합계',
    quantity: null,
    avg_price: null,
    curr_price: null,
    valuation: r.valuation,
    profit: r.cumulativeProfit,
    return_rate: null,
    currency: 'KRW',
    total_valuation: r.valuation,
    total_invested: r.totalInvested,
    total_profit: r.cumulativeProfit,
  }));

  const { error } = await supabase
    .from('daily_snapshot')
    .upsert(snapshots, { onConflict: 'snapshot_date,account,ticker' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true, count: snapshots.length });
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  if (!date) return NextResponse.json({ error: 'date is required' }, { status: 400 });

  const { error } = await supabase
    .from('daily_snapshot')
    .delete()
    .eq('snapshot_date', date)
    .eq('account', '합계');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
