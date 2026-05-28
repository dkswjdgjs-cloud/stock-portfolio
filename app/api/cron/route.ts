import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const hours = koreaTime.getHours();
    const minutes = koreaTime.getMinutes();
    const day = koreaTime.getDay();

    if (day === 0 || day === 6) {
      return NextResponse.json({ message: '주말 - 저장 안함' });
    }

    if (hours !== 15 || minutes < 35 || minutes > 45) {
      return NextResponse.json({ message: '저장 시간 아님' });
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
    const res = await fetch(baseUrl + '/api/snapshot-save', { method: 'POST' });
    const data = await res.json();
    return NextResponse.json(data);

  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
