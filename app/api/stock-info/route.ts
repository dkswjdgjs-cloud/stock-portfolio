import { NextRequest, NextResponse } from 'next/server';
import { getKisToken, KIS_BASE, KIS_KEY, KIS_SECRET } from '@/lib/kisToken';

const KIS_APP_KEY = KIS_KEY;
const KIS_APP_SECRET = KIS_SECRET;
const KIS_BASE_URL = KIS_BASE;

interface KisApiData {
  rt_cd?: string;
  msg_cd?: string;
  msg1?: string;
  output?: unknown;
}

// KIS API 호출 + rt_cd 체크. 인증 오류(rt_cd !== '0')면 토큰을 새로 받아 1회 재시도.
async function kisFetch(url: string, trId: string, token: string): Promise<{ data: KisApiData; token: string }> {
  const call = (tok: string) =>
    fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tok}`,
        appkey: KIS_APP_KEY,
        appsecret: KIS_APP_SECRET,
        tr_id: trId,
      },
    }).then((r) => r.json());

  let data = await call(token);
  if (data.rt_cd && data.rt_cd !== '0') {
    console.error(`KIS API error (tr_id=${trId}):`, data.msg_cd, data.msg1);
    const fresh = await getKisToken();
    data = await call(fresh);
    if (data.rt_cd && data.rt_cd !== '0') {
      console.error(`KIS API retry failed (tr_id=${trId}):`, data.msg_cd, data.msg1);
    }
    return { data, token: fresh };
  }
  return { data, token };
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const market = searchParams.get('market') || 'KR';

  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 });

  try {
    let token = await getKisToken();

    if (market !== 'KR') {
      return NextResponse.json({ info: null, message: '해외 종목은 지원하지 않습니다' });
    }

    // 주식현재가 시세 (PER, PBR, EPS, 52주 최고/최저 등)
    const priceUrl = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}`;
    const priceResult = await kisFetch(priceUrl, 'FHKST01010100', token);
    const p = (priceResult.data.output || {}) as Record<string, string>;
    token = priceResult.token;

    // 재무비율 (ROE, 부채비율, 매출성장률)
    const finUrl = `${KIS_BASE_URL}/uapi/domestic-stock/v1/finance/financial-ratio?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}&FID_PERIOD_DIV_CODE=Y`;
    const finResult = await kisFetch(finUrl, 'FHKST66430200', token);
    const finOutput = finResult.data.output as Record<string, string>[] | undefined;
    token = finResult.token;
    const f = finOutput && finOutput.length > 0 ? finOutput[0] : ({} as Record<string, string>);

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
        const etfUrl = `${KIS_BASE_URL}/uapi/etfetn/v1/quotations/inquire-component-stock-price?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}`;
        const etfResult = await kisFetch(etfUrl, 'FHKST121204C0', token);
        const etfOutput = (etfResult.data.output as Record<string, string>[]) || [];
        etfComponents = etfOutput.slice(0, 10).map((item: any) => ({
          name: item.hts_kor_isnm || '-',
          ticker: item.stck_shrn_iscd || '-',
          weight: item.etf_cnfg_issu_rate ? parseFloat(item.etf_cnfg_issu_rate).toFixed(2) : '-',
          dailyChange: item.prdy_ctrt ? parseFloat(item.prdy_ctrt).toFixed(2) : '-',
          changeSign: item.prdy_vrss_sign || '3',
        }));
      } catch (e) {
        console.error('ETF API error:', e);
        etfComponents = [];
      }
    }
    return NextResponse.json({ info, isEtf, etfComponents });
  } catch (error) {
    console.error('Stock info API error:', error);
    return NextResponse.json({ error: 'Failed to fetch stock info' }, { status: 500 });
  }
}
