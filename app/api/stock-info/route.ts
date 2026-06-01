import { NextRequest, NextResponse } from 'next/server';

const KIS_APP_KEY = process.env.KIS_APP_KEY!;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET!;
const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';

let tokenCache: { token: string; expires: number } | null = null;

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

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const market = searchParams.get('market') || 'KR';

  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 });

  try {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
    };

    if (market !== 'KR') {
      return NextResponse.json({ info: null, message: '해외 종목은 지원하지 않습니다' });
    }

    // 주식현재가 시세 (PER, PBR, EPS, 52주 최고/최저 등)
    headers['tr_id'] = 'FHKST01010100';
    const priceUrl = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}`;
    const priceRes = await fetch(priceUrl, { headers });
    const priceData = await priceRes.json();
    const p = priceData.output || {};

    // 재무비율 (ROE, 부채비율, 매출성장률)
    const finHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
      'tr_id': 'FHKST66430200',
    };
    const finUrl = `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/financial-ratio?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}&FID_PERIOD_DIV_CODE=Y`;
    const finRes = await fetch(finUrl, { headers: finHeaders });
    const finData = await finRes.json();
    console.log('fin API full:', JSON.stringify(finData).slice(0, 500));
    const f = finData.output && finData.output.length > 0 ? finData.output[0] : {};

    const info = {
      // 시세 API
      mktCap: (p.hts_avls && p.hts_avls !== '0') ? `${parseInt(p.hts_avls).toLocaleString()}억` : '-',
      per: p.per ? `${parseFloat(p.per).toFixed(2)}배` : '-',
      pbr: p.pbr ? `${parseFloat(p.pbr).toFixed(2)}배` : '-',
      eps: p.eps ? `${parseInt(p.eps).toLocaleString()}원` : '-',
      w52High: p.w52_hgpr ? parseInt(p.w52_hgpr) : (p.d250_hgpr ? parseInt(p.d250_hgpr) : 0),
      w52Low: p.w52_lwpr ? parseInt(p.w52_lwpr) : (p.d250_lwpr ? parseInt(p.d250_lwpr) : 0),
      avgVol: p.avrg_vol ? parseInt(p.avrg_vol).toLocaleString() : (p.acml_vol ? parseInt(p.acml_vol).toLocaleString() : '-'),
      dvdRate: p.bps ? '-' : '-',
      // 재무비율 API
      roe: f.roe_val ? `${parseFloat(f.roe_val).toFixed(2)}%` : '-',
      debtRate: f.lblt_rate ? `${parseFloat(f.lblt_rate).toFixed(2)}%` : '-',
      salesGrowth: f.grs ? `${parseFloat(f.grs).toFixed(2)}%` : '-',
    };

    // ETF 구성종목 조회
    let etfComponents: any[] = [];
    const etfKeywords = ['ETF', 'ETN', '인덱스펀드'];
    const isEtf = etfKeywords.some(k => (p.bstp_kor_isnm || '').includes(k) || (p.rprs_mrkt_kor_name || '').includes(k));
    if (isEtf) {
      try {
        const etfHeaders: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          appkey: KIS_APP_KEY,
          appsecret: KIS_APP_SECRET,
          'tr_id': 'FHKST121204C0',
        };
        const etfUrl = `${KIS_BASE_URL}/uapi/etfetn/v1/quotations/inquire-component-stock-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}`;
        const etfRes = await fetch(etfUrl, { headers: etfHeaders });
        const etfData = await etfRes.json();
        etfComponents = (etfData.output || []).slice(0, 10).map((item: any) => ({
          name: item.hts_kor_isnm || '-',
          ticker: item.stck_shrn_iscd || '-',
          weight: item.etf_cnfg_issu_rate ? parseFloat(item.etf_cnfg_issu_rate).toFixed(2) : '-',
          dailyChange: item.prdy_ctrt ? parseFloat(item.prdy_ctrt).toFixed(2) : '-',
          changeSign: item.prdy_vrss_sign || '3',
        }));
      } catch (e) {
        etfComponents = [];
      }
    }
    return NextResponse.json({ info, isEtf, etfComponents });
  } catch (error) {
    console.error('Stock info API error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock info' }, { status: 500 });
  }
}
