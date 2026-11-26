import { NextRequest, NextResponse } from 'next/server';
import { getQuote } from '@/lib/kisQuote';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const market = searchParams.get('market') === 'US' ? 'US' : 'KR';
  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 });

  const quote = await getQuote(ticker, market);
  if (!quote) return NextResponse.json({ error: 'Failed to fetch price', ticker, market }, { status: 502 });
  return NextResponse.json(quote);
}
