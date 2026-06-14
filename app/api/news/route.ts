import { NextRequest, NextResponse } from "next/server";
import { stripHtml, sourceFromUrl, timeAgo, type NewsItem } from "@/lib/news";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;

interface NaverNewsApiItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("query") || "").trim();
  const display = Math.min(Math.max(Number(searchParams.get("display")) || 3, 1), 10);

  if (!query) return NextResponse.json({ items: [] });

  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return NextResponse.json({ items: [], error: "NAVER_API_NOT_CONFIGURED" });
  }

  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${display}&sort=date`;
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      },
      next: { revalidate: 300 }, // 5분 캐시
    });

    if (!res.ok) {
      console.error("Naver news API error:", res.status, await res.text());
      return NextResponse.json({ items: [], error: "NAVER_API_ERROR" });
    }

    const data: { items?: NaverNewsApiItem[] } = await res.json();

    const items: NewsItem[] = (data.items || []).map((it) => ({
      title: stripHtml(it.title || ""),
      description: stripHtml(it.description || ""),
      link: it.link || it.originallink || "",
      source: sourceFromUrl(it.originallink || it.link || ""),
      timeAgo: timeAgo(it.pubDate || ""),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("News fetch error:", error);
    return NextResponse.json({ items: [], error: "FETCH_FAILED" });
  }
}
