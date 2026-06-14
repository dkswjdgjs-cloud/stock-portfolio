// =============================================================
// 뉴스 수집 + 필터링 + AI 큐레이션 파이프라인 (서버 전용)
// /app/api/news/route.ts (캐시 미스 시 라이브 fallback) 와
// /app/api/news/refresh/route.ts (cron이 호출하는 배치 캐시 갱신) 에서 공유
// =============================================================

import { stripHtml, sourceFromUrl, timeAgo, dedupeNews, passesNewsFilter, type NewsItem } from "./news";

const NAVER_CLIENT_ID = process.env.NAVER_CLIENT_ID;
const NAVER_CLIENT_SECRET = process.env.NAVER_CLIENT_SECRET;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

interface NaverNewsApiItem {
  title: string;
  originallink: string;
  link: string;
  description: string;
  pubDate: string;
}

// Naver 검색 API 최대 display 값 (1회 호출당 비용은 동일하므로 항상 최대로 가져온다)
const NAVER_FETCH_COUNT = 100;

const CURATION_PROMPT = `다음은 "%QUERY%" 관련 뉴스 후보 목록이다. 아래 규칙에 따라 최종적으로 남길 기사의 번호만 JSON 배열로 반환하라 (예: [0,2,5]). 다른 설명 없이 JSON 배열만 출력하라.

규칙:
1. 단순 홍보성 보도자료나 기업의 일상적인 홍보 기사는 제외한다.
2. 거시 경제 지표, 산업 트렌드, 기업의 주요 실적, 정책 변화 등 실질적인 투자 의사결정에 가치가 있는 기사 위주로 남긴다.
3. 동일 이슈를 다루는 기사가 여럿이면 가장 분석적인 기사 1건만 남기고 나머지는 제외한다.
4. 남길 기사가 없으면 빈 배열 []을 반환한다.

뉴스 후보 목록:
%LIST%`;

// Gemini로 "지능적 판단" 단계 적용 — 실패 시 입력을 그대로 반환 (graceful fallback)
async function curateWithGemini(query: string, items: NewsItem[]): Promise<NewsItem[]> {
  if (!GEMINI_API_KEY || items.length === 0) return items;

  const list = items
    .map((it, i) => `${i}. [${it.source}] ${it.title} - ${it.description}`)
    .join("\n");
  const prompt = CURATION_PROMPT.replace("%QUERY%", query).replace("%LIST%", list);

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 512 },
        }),
      }
    );
    if (!res.ok) return items;

    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts
      ?.filter((p: { text?: string }) => p.text)
      ?.map((p: { text?: string }) => p.text)
      ?.join("") || "";

    const match = text.match(/\[[\d,\s]*\]/);
    if (!match) return items;

    const indices: number[] = JSON.parse(match[0]);
    if (!Array.isArray(indices)) return items;

    const kept = indices
      .filter((i) => Number.isInteger(i) && i >= 0 && i < items.length)
      .map((i) => items[i]);

    return kept;
  } catch (error) {
    console.error("News curation error:", error);
    return items;
  }
}

export type NewsFetchResult =
  | { ok: true; items: NewsItem[] }
  | { ok: false; error: "NAVER_API_NOT_CONFIGURED" | "NAVER_API_ERROR" | "FETCH_FAILED" };

/**
 * 네이버 뉴스 검색 → 중복제거/화이트리스트/스팸 필터 → Gemini 지능적 큐레이션.
 * display: 최종 결과 개수 상한 (큐레이션 이후 slice).
 */
export async function fetchAndCurateNews(query: string, display: number): Promise<NewsFetchResult> {
  if (!NAVER_CLIENT_ID || !NAVER_CLIENT_SECRET) {
    return { ok: false, error: "NAVER_API_NOT_CONFIGURED" };
  }

  try {
    const url = `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(query)}&display=${NAVER_FETCH_COUNT}&sort=date`;
    const res = await fetch(url, {
      headers: {
        "X-Naver-Client-Id": NAVER_CLIENT_ID,
        "X-Naver-Client-Secret": NAVER_CLIENT_SECRET,
      },
      next: { revalidate: 300 }, // 5분 캐시
    });

    if (!res.ok) {
      console.error("Naver news API error:", res.status, await res.text());
      return { ok: false, error: "NAVER_API_ERROR" };
    }

    const data: { items?: NaverNewsApiItem[] } = await res.json();

    const rawItems: NewsItem[] = (data.items || []).map((it) => ({
      title: stripHtml(it.title || ""),
      description: stripHtml(it.description || ""),
      link: it.link || it.originallink || "",
      source: sourceFromUrl(it.originallink || it.link || ""),
      timeAgo: timeAgo(it.pubDate || ""),
    }));

    // 1단계: 중복 제거 + 강제 필터 (화이트리스트 매체 / 스팸 키워드 / 거시경제 키워드)
    const filtered = dedupeNews(rawItems).filter(passesNewsFilter);

    // 2단계: 지능적 선별 (Gemini) — 홍보성·중복 이슈 추가 정리
    const curated = await curateWithGemini(query, filtered);

    return { ok: true, items: curated.slice(0, display) };
  } catch (error) {
    console.error("News fetch error:", error);
    return { ok: false, error: "FETCH_FAILED" };
  }
}
