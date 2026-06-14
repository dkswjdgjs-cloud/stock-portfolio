// =============================================================
// 종목별 큐레이션 뉴스 캐시 (Upstash Redis)
// /api/news/refresh (cron) 가 채우고, /api/news (사용자 요청) 가 읽는다.
// =============================================================

import { Redis } from "@upstash/redis";
import type { NewsItem } from "./news";

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// cron이 멈춰도 이 시간이 지나면 캐시가 만료되어 /api/news가 라이브 fallback으로 전환된다
const NEWS_CACHE_TTL = 60 * 60; // 1시간

export interface CachedNews {
  items: NewsItem[];
  updatedAt: number;
}

const cacheKey = (query: string) => `news:${query}`;

export async function getCachedNews(query: string): Promise<CachedNews | null> {
  try {
    return await redis.get<CachedNews>(cacheKey(query));
  } catch (error) {
    console.error("News cache read error:", error);
    return null;
  }
}

export async function setCachedNews(query: string, items: NewsItem[]): Promise<void> {
  try {
    await redis.set<CachedNews>(cacheKey(query), { items, updatedAt: Date.now() }, { ex: NEWS_CACHE_TTL });
  } catch (error) {
    console.error("News cache write error:", error);
  }
}
