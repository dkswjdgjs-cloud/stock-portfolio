import { NextRequest, NextResponse } from 'next/server';
import { getQuotes } from '@/lib/kisQuote';

// POST { items: [{ ticker, market: 'KR' | 'US' }] }
// → { quotes: { "KR:005930": Quote | null, ... } }   (null = 조회 실패)
export async function POST(request: NextRequest) {
  let items: { ticker: string; market: 'KR' | 'US' }[] = [];
  try {
    const body = await request.json();
    items = (Array.isArray(body?.items) ? body.items : [])
      .filter((it: { ticker?: unknown }) => typeof it?.ticker === 'string' && it.ticker)
      .map((it: { ticker: string; market?: string }) => ({ ticker: it.ticker, market: it.market === 'US' ? 'US' : 'KR' }))
      .slice(0, 100);
  } catch {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  return NextResponse.json({ quotes: await getQuotes(items) });
}
