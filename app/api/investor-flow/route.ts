import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getKisToken, KIS_BASE, KIS_KEY, KIS_SECRET } from '@/lib/kisToken';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// KIS 투자자별 매매동향 (코스피 전체)
// TR_ID: FHKST01010900 → 종목별, 코스피 전체는 FHKUP76600100
async function fetchKisInvestorFlow(date: string): Promise<{
  individual: number; foreign_inv: number; institution: number; pension: number; kospi_change: number;
} | null> {
  const token = await getKisToken();
  const yyyymmdd = date.replace(/-/g, '');

  // 코스피 투자자별 매매동향
  const url = `${KIS_BASE}/uapi/domestic-stock/v1/quotations/inquire-investor` +
    `?FID_COND_MRKT_DIV_CODE=J&FID_INPUT_ISCD=0001&FID_INPUT_DATE_1=${yyyymmdd}&FID_INPUT_DATE_2=${yyyymmdd}`;

  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      appkey: KIS_KEY,
      appsecret: KIS_SECRET,
      tr_id: 'FHKST01010900',
      custtype: 'P',
    },
  });
  const data = await res.json();

  if (!data.output2?.length) return null;

  // output2[0] = 당일 데이터
  const row = data.output2[0];
  return {
    individual:   Math.round(Number(row.prsn_ntby_qty  || 0) / 100),  // 주 → 억원 근사
    foreign_inv:  Math.round(Number(row.frgn_ntby_qty  || 0) / 100),
    institution:  Math.round(Number(row.orgn_ntby_qty  || 0) / 100),
    pension:      Math.round(Number(row.pnsn_fund_ntby_qty || 0) / 100),
    kospi_change: Number(row.bstp_nmix_prdy_vrss || 0),
  };
}

// GET /api/investor-flow — 최근 7거래일 Supabase에서 조회
export async function GET() {
  const { data, error } = await supabase
    .from('investor_flow')
    .select('*')
    .order('trade_date', { ascending: false })
    .limit(7);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data || []);
}

// POST /api/investor-flow — Oracle Cloud 크론잡이 호출 (오전 8시)
export async function POST(req: NextRequest) {
  // 크론 시크릿 검증
  const secret = req.headers.get('x-cron-secret');
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date();
  // KST 기준 오늘 날짜
  const kst = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  const day = kst.getDay();
  if (day === 0 || day === 6) return NextResponse.json({ message: '주말 - 건너뜀' });

  const dateStr = kst.toISOString().slice(0, 10);

  try {
    const flow = await fetchKisInvestorFlow(dateStr);
    if (!flow) return NextResponse.json({ message: '데이터 없음', date: dateStr });

    const { error } = await supabase.from('investor_flow').upsert({
      trade_date: dateStr,
      ...flow,
    }, { onConflict: 'trade_date' });

    if (error) throw error;
    return NextResponse.json({ ok: true, date: dateStr, ...flow });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
