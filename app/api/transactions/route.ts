import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .order('trade_date', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  // 손익/수익율 자동 계산
  let profit_loss = null;
  let profit_rate = null;

  if (body.trade_type === '매도' && body.buy_price && body.sell_price && body.quantity) {
    profit_loss = (body.sell_price - body.buy_price) * body.quantity;
    profit_rate = ((body.sell_price - body.buy_price) / body.buy_price) * 100;
  }

  const { data, error } = await supabase
    .from('transactions')
    .insert([{ ...body, profit_loss, profit_rate }])
    .select();

  if (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data[0]);
}

export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await supabase
    .from('transactions')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { id, ...updateData } = body;

  let profit_loss = null;
  let profit_rate = null;

  if (updateData.trade_type === '매도' && updateData.buy_price && updateData.sell_price && updateData.quantity) {
    profit_loss = (updateData.sell_price - updateData.buy_price) * updateData.quantity;
    profit_rate = ((updateData.sell_price - updateData.buy_price) / updateData.buy_price) * 100;
  }

  const { data, error } = await supabase
    .from('transactions')
    .update({ ...updateData, profit_loss, profit_rate })
    .eq('id', id)
    .select();

  if (error) {
    console.error('PUT error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data[0]);
}
