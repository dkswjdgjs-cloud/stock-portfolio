import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getKisToken, KIS_BASE, KIS_KEY, KIS_SECRET } from '@/lib/kisToken';

const KIS_APP_KEY = KIS_KEY;
const KIS_APP_SECRET = KIS_SECRET;
const KIS_BASE_URL = KIS_BASE;

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

const exchangeCache = new Map<string, string>();

async function getUSDKRWRate(): Promise<number> {
  const cached = await redis.get<number>('usd_krw_rate');
  if (cached) return cached;

  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    const rate = data.rates?.KRW;
    if (rate > 0) {
      await redis.set('usd_krw_rate', rate, { ex: 3600 });
      return rate;
    }
  } catch {}
  return 1400;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const market = searchParams.get('market') || 'KR';
  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 });

  try {
    const token = await getKisToken();
    const isKR = market === 'KR';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
      tr_id: isKR ? 'FHKST01010100' : 'HHDFS00000300',
    };

    let price = 0;
    let dailyChange = 0;
    let exchangeRate = 1;
    let prevClose = 0;

    if (isKR) {
      const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}`;
      const response = await fetch(url, { headers });
      const data = await response.json();
      price = parseFloat(data.output?.stck_prpr || '0');
      const dailyChangeAmt = parseFloat(data.output?.prdy_vrss || '0');
      const dailySign = data.output?.prdy_vrss_sign;
      dailyChange = (String(dailySign) === '4' || String(dailySign) === '5') ? -Math.abs(dailyChangeAmt) : Math.abs(dailyChangeAmt);
    } else {
      exchangeRate = await getUSDKRWRate();
      const cachedExcd = exchangeCache.get(ticker) || await redis.get<string>(`excd:${ticker}`);
      const exchanges = cachedExcd
        ? [cachedExcd, ...['NAS', 'AMS', 'NYS', 'TSE', 'HKS'].filter(e => e !== cachedExcd)]
        : ['NAS', 'AMS', 'NYS', 'TSE', 'HKS'];
      for (const excd of exchanges) {
        const url = `${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price?AUTH=&EXCD=${excd}&SYMB=${ticker}`;
        const response = await fetch(url, { headers });
        const data = await response.json();
        const p = parseFloat(data.output?.last || '0');
        if (p > 0) {
          price = p;
          prevClose = parseFloat(data.output?.base || '0') || 0;
          dailyChange = prevClose > 0 ? price - prevClose : 0;
          exchangeCache.set(ticker, excd);
          if (!cachedExcd || cachedExcd !== excd) {
            redis.set(`excd:${ticker}`, excd, { ex: 86400 * 30 }).catch(() => {});
          }
          break;
        }
      }
    }

    return NextResponse.json({ ticker, price, dailyChange, exchangeRate, prevClose, market });
  } catch (error) {
    console.error('KIS API error:', error);
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
  }
}
