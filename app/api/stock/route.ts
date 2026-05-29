import { NextRequest, NextResponse } from 'next/server';

const KIS_APP_KEY = process.env.KIS_APP_KEY!;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET!;
const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

let tokenCache: { token: string; expires: number } | null = null;

async function getAccessToken() {
  if (tokenCache && Date.now() < tokenCache.expires) {
    return tokenCache.token;
  }

  const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'client_credentials',
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
    }),
  });

  const data = await res.json();
  tokenCache = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return tokenCache.token;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const market = searchParams.get('market') || 'KR';

  if (!ticker) {
    return NextResponse.json({ error: 'ticker is required' }, { status: 400 });
  }

  try {
    const token = await getAccessToken();

    // 국내/해외 구분
    const isKR = market === 'KR';
    const url = isKR
      ? `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price`
      : `${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/price`;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
      tr_id: isKR ? 'FHKST01010100' : 'HHDFS00000300',
    };

    const params = isKR
      ? `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}`
      : `?AUTH=&EXCD=NAS&SYMB=${ticker}`;

    const response = await fetch(`${url}${params}`, { headers });
    const data = await response.json();

    const price = isKR
      ? parseFloat(data.output?.stck_prpr || '0')
      : parseFloat(data.output?.last || '0');

    // 등락금액 (prdy_vrss: 전일대비, prdy_vrss_sign: 1=상한,2=상승,3=보합,4=하한,5=하락)
    const dailyChangeAmt = isKR
      ? parseFloat(data.output?.prdy_vrss || '0')
      : parseFloat(data.output?.diff || '0');
    const dailySign = isKR ? data.output?.prdy_vrss_sign : '2';
    const dailyChange = (dailySign === '4' || dailySign === '5') ? -Math.abs(dailyChangeAmt) : Math.abs(dailyChangeAmt);

    return NextResponse.json({ ticker, price, dailyChange, market });
  } catch (error) {
    console.error('KIS API error:', error);
    return NextResponse.json({ error: 'Failed to fetch price' }, { status: 500 });
  }
}
