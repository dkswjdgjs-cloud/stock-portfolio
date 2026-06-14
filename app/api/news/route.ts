import { NextRequest, NextResponse } from "next/server";
import { fetchAndCurateNews } from "@/lib/newsCuration";
import { getCachedNews, setCachedNews } from "@/lib/newsCache";

// 캐시에 저장할 때 사용하는 개수 (요청별 display는 이 값에서 slice)
const CACHE_DISPLAY_COUNT = 20;

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();
  const display = Math.min(Math.max(Number(searchParams.get("display")) || 20, 1), 100);

  if (!query) return NextResponse.json({ items: [] });

  // 1. 캐시 확인 — /api/news/refresh (cron) 이 미리 채워둔 결과를 즉시 반환
  const cached = await getCachedNews(query);
  if (cached) {
    return NextResponse.json({ items: cached.items.slice(0, display), updatedAt: cached.updatedAt });
  }

  // 2. 캐시 미스 — 라이브로 1회 계산 후 다음 요청을 위해 캐시에 저장
  const result = await fetchAndCurateNews(query, CACHE_DISPLAY_COUNT);

  if (!result.ok) {
    return NextResponse.json({ items: [], error: result.error });
  }

  await setCachedNews(query, result.items);
  return NextResponse.json({ items: result.items.slice(0, display) });
}
