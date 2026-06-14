import { NextRequest, NextResponse } from "next/server";
import { calcHoldings } from "@/lib/calcHoldings";
import { fetchAndCurateNews } from "@/lib/newsCuration";
import { setCachedNews } from "@/lib/newsCache";

const CACHE_DISPLAY_COUNT = 20;

/**
 * 보유 종목에 대한 관련 뉴스를 미리 큐레이션해서 Redis에 저장한다.
 * 외부 cron(예: GitHub Actions, Oracle Cloud crontab)이 주기적으로 호출.
 *
 *   curl -H "Authorization: Bearer $CRON_SECRET" https://<도메인>/api/news/refresh
 */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  let names: string[] = [];
  try {
    const txRes = await fetch(`${baseUrl}/api/transactions`);
    const transactions = await txRes.json();
    const holdings = calcHoldings(transactions, "전체").filter((h) => h.quantity > 0);
    names = [...new Set(holdings.map((h) => h.stock_name))].filter((n) => n && n !== "-");
  } catch (error) {
    return NextResponse.json({ error: "transactions fetch failed", detail: String(error) }, { status: 500 });
  }

  const results = await Promise.all(
    names.map(async (name) => {
      const result = await fetchAndCurateNews(name, CACHE_DISPLAY_COUNT);
      if (!result.ok) return { name, ok: false, error: result.error };
      await setCachedNews(name, result.items);
      return { name, ok: true, count: result.items.length };
    })
  );

  return NextResponse.json({ refreshed: results, updatedAt: Date.now() });
}
