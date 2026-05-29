import { NextRequest, NextResponse } from 'next/server';

const KIS_APP_KEY = process.env.KIS_APP_KEY!;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET!;
const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

let tokenCache: { token: string; expires: number } | null = null;
let exchangeRateCache: { rate: number; expires: number } | null = null;
const exchangeCache = new Map<string, string>();

async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.expires) return tokenCache.token;
  const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ grant_type: 'client_credentials', appkey: KIS_APP_KEY, appsecret: KIS_APP_SECRET }),
  });
  const data = await res.json();
  tokenCache = { token: data.access_token, expires: Date.now() + (data.expires_in - 60) * 1000 };
  return tokenCache.token;
}

async function getUSDKRWRate(): Promise<number> {
  if (exchangeRateCache && Date.now() < exchangeRateCache.expires) return exchangeRateCache.rate;
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    const data = await res.json();
    const rate = data.rates?.KRW;
    if (rate > 0) {
      exchangeRateCache = { rate, expires: Date.now() + 60 * 60 * 1000 };
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
    const token = await getAccessToken();
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

    if (isKR) {
      const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}`;
      const response = await fetch(url, { headers });
      const data = await response.json();
      price = parseFloat(data.output?.stck_prpr || '0');
      const dailyChangeAmt = parseFloat(data.output?.prdy_vrss || '0');
      const dailySign = data.output?.prdy_vrss_sign;
      dailyChange = (dailySign === '4' || dailySign === '5') ? -Math.abs(dailyChangeAmt) : Math.abs(dailyChangeAmt);
    } else {
      exchangeRate = await getUSDKRWRate();
      const cachedExcd = exchangeCache.get(ticker);
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
          dailyChange = parseFloat(data.output?.diff || '0') || 0;
          exchangeCache.set(ticker, excd);
          break;
        }
      }
    }
    return NextResponse.json({ ticker, price, dailyChange, exchangeRate, market });
  } catch (error) {
    console.error('KIS API error:', error);
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
  }
}
