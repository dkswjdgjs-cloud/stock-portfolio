"use client";
import { useState } from "react";
import { C, NUM } from "@/lib/glow-theme";
import { useStockNews, type NewsTarget } from "@/lib/useStockNews";
import type { NewsItem } from "@/lib/news";

const PAGE_SIZE = 4;

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <a
      href={item.link}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "block", textDecoration: "none", color: "inherit" }}
    >
      <p style={{ margin: "0 0 4px", fontSize: 11.5, fontWeight: 500, color: C.sec }}>
        {item.source}
      </p>
      <p
        style={{
          margin: 0, fontSize: 15.5, fontWeight: 700, lineHeight: 1.35, color: C.label,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}
      >
        {item.title}
      </p>
      {item.description && (
        <p
          style={{
            margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.4, color: C.sec,
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}
        >
          {item.description}
        </p>
      )}
      <p style={{ ...NUM, margin: "8px 0 0", fontSize: 11, color: C.ter }}>{item.timeAgo}</p>
    </a>
  );
}

/**
 * 한 종목에 대한 관련 뉴스를 2x2 그리드로 표시.
 * - onMore가 없으면: "더 보기" 클릭 시 같은 화면에서 4개씩 더 노출 (inline pagination)
 * - onMore가 있으면: 뉴스가 있을 때 "더 보기" 클릭 시 onMore() 호출 (예: 종목 상세로 이동)
 */
export default function StockNewsGrid({
  target, fetchCount = 20, onMore,
}: {
  target: NewsTarget;
  fetchCount?: number;
  onMore?: () => void;
}) {
  const { groups, loading, apiUnavailable } = useStockNews([target], fetchCount);
  const items = groups[0]?.items ?? [];
  const [visible, setVisible] = useState(PAGE_SIZE);

  if (loading && items.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: C.ter }}>뉴스를 불러오는 중…</p>;
  }
  if (apiUnavailable) {
    return <p style={{ margin: 0, fontSize: 13, color: C.ter }}>뉴스 API가 아직 설정되지 않았습니다.</p>;
  }
  if (items.length === 0) {
    return <p style={{ margin: 0, fontSize: 13, color: C.ter }}>관련 뉴스가 없습니다.</p>;
  }

  const shown = items.slice(0, visible);
  const showMoreBtn = onMore ? true : visible < items.length;

  const handleMore = () => {
    if (onMore) onMore();
    else setVisible((v) => Math.min(v + PAGE_SIZE, items.length));
  };

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 28px" }}>
        {shown.map((item, ii) => (
          <NewsCard key={ii} item={item} />
        ))}
      </div>
      {showMoreBtn && (
        <button
          onClick={handleMore}
          style={{
            display: "block", marginTop: 16, padding: 0,
            background: "none", border: "none", color: C.blue,
            fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}
        >
          더 보기
        </button>
      )}
    </>
  );
}
