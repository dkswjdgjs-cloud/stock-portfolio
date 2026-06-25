import { NextRequest, NextResponse } from 'next/server';
import { getKisToken, KIS_BASE, KIS_KEY, KIS_SECRET } from '@/lib/kisToken';

const KIS_APP_KEY = KIS_KEY;
const KIS_APP_SECRET = KIS_SECRET;
const KIS_BASE_URL = KIS_BASE;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const ticker = searchParams.get('ticker');
  const market = searchParams.get('market') || 'KR';
  const range = searchParams.get('range') || '1M';

  if (!ticker) return NextResponse.json({ error: 'ticker is required' }, { status: 400 });

  try {
    const token = await getKisToken();
    const today = new Date();
    const endDate = today.toISOString().slice(0, 10).replace(/-/g, '');
    const startDate = new Date(today);

    if (range === '1M') startDate.setMonth(today.getMonth() - 1);
    else if (range === '3M') startDate.setMonth(today.getMonth() - 3);
    else if (range === '1Y') startDate.setFullYear(today.getFullYear() - 1);
    else if (range === '3Y') startDate.setFullYear(today.getFullYear() - 3);

    const periodCode = range === '3Y' ? 'M' : range === '1Y' ? 'W' : 'D';
    const startStr = startDate.toISOString().slice(0, 10).replace(/-/g, '');

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      appkey: KIS_APP_KEY,
      appsecret: KIS_APP_SECRET,
    };

    if (market === 'KR') {
      headers['tr_id'] = 'FHKST01010400';
      const url = `${KIS_BASE_URL}/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=${ticker}&FID_INPUT_DATE_1=${startStr}&FID_INPUT_DATE_2=${endDate}&FID_PERIOD_DIV_CODE=${periodCode}&FID_ORG_ADJ_PRC=0`;
      const res = await fetch(url, { headers });
      const data = await res.json();
      console.log('KIS chart response:', JSON.stringify(data).slice(0, 500));
      const chartData = (data.output2 || data.output || []).map((item: any) => ({
        date: item.stck_bsop_date,
        open: parseFloat(item.stck_oprc || '0'),
        high: parseFloat(item.stck_hgpr || '0'),
        low: parseFloat(item.stck_lwpr || '0'),
        close: parseFloat(item.stck_clpr || '0'),
        volume: parseFloat(item.acml_vol || '0'),
      })).reverse();
      return NextResponse.json({ chartData });
    } else {
      headers['tr_id'] = 'HHDFS76240000';
      const exchanges = ['NAS', 'NYS', 'AMS'];
      for (const excd of exchanges) {
        const url = `${KIS_BASE_URL}/uapi/overseas-price/v1/quotations/dailyprice?AUTH=&EXCD=${excd}&SYMB=${ticker}&GUBN=0&BYMD=${endDate}&MODP=0`;
        const res = await fetch(url, { headers });
        const data = await res.json();
        if (data.output2?.length > 0) {
          const chartData = (data.output2 || []).map((item: any) => ({
            date: item.xymd,
            open: parseFloat(item.open || '0'),
            high: parseFloat(item.high || '0'),
            low: parseFloat(item.low || '0'),
            close: parseFloat(item.clos || '0'),
            volume: parseFloat(item.tvol || '0'),
          })).reverse();
          return NextResponse.json({ chartData });
        }
      }
      return NextResponse.json({ chartData: [] });
    }
  } catch (error) {
    console.error('Chart API error:', error);
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
