// =============================================================
// KIS 현재가 조회 (국내/해외) — /api/stock, /api/stock/batch 공용
//
// - 조회 결과를 Redis에 잠깐(QUOTE_TTL) 저장해서, 새로고침이나 여러 기기에서
//   동시에 열어도 KIS 호출이 반복되지 않게 한다.
// - KIS가 오류(rt_cd != '0', 호출 한도 초과 등)를 주면 0원이 아니라 null을 돌려준다.
//   화면은 null이면 마지막으로 알던 가격을 그대로 쓴다.
// =============================================================

import { Redis } from '@upstash/redis';
import { getKisToken, KIS_BASE, KIS_KEY, KIS_SECRET } from './kisToken';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const QUOTE_TTL = 15; // 초
const US_EXCHANGES = ['NAS', 'AMS', 'NYS', 'TSE', 'HKS'];

export interface Quote {
  ticker: string;
  market: 'KR' | 'US';
  price: number;
  dailyChange: number;
  prevClose: number;
  exchangeRate: number;
}

const exchangeCache = new Map<string, string>();

async function getUSDKRWRate(): Promise<number> {
  try {
    const cached = await redis.get<number>('usd_krw_rate');
    if (cached) return cached;
  } catch {}
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    const rate = data.rates?.KRW;
    if (rate > 0) {
      await redis.set('usd_krw_rate', rate, { ex: 3600 }).catch(() => {});
      return rate;
    }
  } catch {}
  return 1400;
}

async function kisGet(url: string, trId: string, token: string) {
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      appkey: KIS_KEY,
      appsecret: KIS_SECRET,
      tr_id: trId,
    },
  });
  const data = await res.json();
  if (!res.ok || (data.rt_cd && data.rt_cd !== '0')) {
    throw new Error(`KIS ${trId} 오류: ${data.msg_cd ?? res.status} ${data.msg1 ?? ''}`.trim());
  }
  return data;
}

async function fetchKR(ticker: string, token: string): Promise<Quote | null> {
  const url = `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${encodeURIComponent(ticker)}`;
  const data = await kisGet(url, 'FHKST01010100', token);
  const price = parseFloat(data.output?.stck_prpr || '0');
  if (!(price > 0)) return null;
  const amt = parseFloat(data.output?.prdy_vrss || '0');
  const sign = String(data.output?.prdy_vrss_sign);
  const dailyChange = sign === '4' || sign === '5' ? -Math.abs(amt) : Math.abs(amt);
  return { ticker, market: 'KR', price, dailyChange, prevClose: price - dailyChange, exchangeRate: 1 };
}

async function fetchUS(ticker: string, token: string): Promise<Quote | null> {
  const exchangeRate = await getUSDKRWRate();
  let cachedExcd = exchangeCache.get(ticker) ?? null;
  if (!cachedExcd) cachedExcd = await redis.get<string>(`excd:${ticker}`).catch(() => null);
  const exchanges = cachedExcd ? [cachedExcd, ...US_EXCHANGES.filter((e) => e !== cachedExcd)] : US_EXCHANGES;

  for (const excd of exchanges) {
    const url = `${KIS_BASE}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${encodeURIComponent(ticker)}`;
    const data = await kisGet(url, 'HHDFS00000300', token);
    const price = parseFloat(data.output?.last || '0');
    if (price > 0) {
      const prevClose = parseFloat(data.output?.base || '0') || 0;
      exchangeCache.set(ticker, excd);
      if (cachedExcd !== excd) redis.set(`excd:${ticker}`, excd, { ex: 86400 * 30 }).catch(() => {});
      return { ticker, market: 'US', price, dailyChange: prevClose > 0 ? price - prevClose : 0, prevClose, exchangeRate };
    }
  }
  return null;
}

/** 현재가 1건. 실패하면 null (0원으로 표시하지 않기 위해). */
export async function getQuote(ticker: string, market: 'KR' | 'US'): Promise<Quote | null> {
  const key = `quote:${market}:${ticker}`;
  try {
    const cached = await redis.get<Quote>(key);
    if (cached) return cached;
  } catch {}

  try {
    const token = await getKisToken();
    const quote = market === 'KR' ? await fetchKR(ticker, token) : await fetchUS(ticker, token);
    if (quote) await redis.set(key, quote, { ex: QUOTE_TTL }).catch(() => {});
    return quote;
  } catch (e) {
    console.error(`quote ${market}:${ticker} 실패:`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** 여러 종목을 동시에 최대 `concurrency`개씩 조회 (KIS 초당 호출 한도 보호). */
export async function getQuotes(
  items: { ticker: string; market: 'KR' | 'US' }[],
  concurrency = 6,
): Promise<Record<string, Quote | null>> {
  const out: Record<string, Quote | null> = {};
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const it = items[next++];
      out[`${it.market}:${it.ticker}`] = await getQuote(it.ticker, it.market);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return out;
}
