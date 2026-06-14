"use client";
import { useEffect, useRef, useState } from "react";
import type { NewsItem } from "./news";

export interface StockNewsGroup {
  name: string;
  color?: string;
  items: NewsItem[];
}

export interface NewsTarget {
  name: string;
  color?: string;
}

interface FetchResult extends StockNewsGroup {
  unavailable: boolean;
}

/**
 * 종목별 관련 뉴스를 /api/news 에서 가져온다.
 * - stocks: 뉴스를 가져올 종목 목록 (이름 기준 쿼리)
 * - fetchCount: 종목당 가져올 뉴스 개수 (중복 제거 전 기준)
 * 세션 내에서는 종목명별로 캐싱하여 중복 호출을 줄인다.
 */
export function useStockNews(stocks: NewsTarget[], fetchCount = 20) {
  const [groups, setGroups] = useState<StockNewsGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [apiUnavailable, setApiUnavailable] = useState(false);
  const cacheRef = useRef<Map<string, NewsItem[]>>(new Map());

  const key = stocks.map((s) => s.name).join("|");

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);

    Promise.all(
      stocks.map(async (s): Promise<FetchResult> => {
        const cached = cacheRef.current.get(s.name);
        if (cached) return { name: s.name, color: s.color, items: cached, unavailable: false };
        try {
          const r = await fetch(`/api/news?query=${encodeURIComponent(s.name)}&display=${fetchCount}`);
          const d: { items?: NewsItem[]; error?: string } = await r.json();
          const items = d.items || [];
          cacheRef.current.set(s.name, items);
          return { name: s.name, color: s.color, items, unavailable: d.error === "NAVER_API_NOT_CONFIGURED" };
        } catch {
          return { name: s.name, color: s.color, items: [], unavailable: false };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      setGroups(results.map((r) => ({ name: r.name, color: r.color, items: r.items })));
      setApiUnavailable(results.some((r) => r.unavailable));
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, fetchCount]);

  return { groups, loading, apiUnavailable };
}
