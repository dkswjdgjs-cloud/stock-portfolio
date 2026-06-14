"use client";
import { C, NUM } from "@/lib/glow-theme";
import { useStockNews, type NewsTarget } from "@/lib/useStockNews";

export default function NewsSection({
  stocks, listMode,
}: {
  stocks: NewsTarget[];
  listMode: string;
}) {
  const { groups, loading, apiUnavailable } = useStockNews(stocks, 2);
  const modeLabel = listMode === "즐겨찾기" ? "즐겨찾기 종목" : "보유 종목";

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>관련 뉴스</h2>
        <span style={{ fontSize: 12, color: C.sec }}>{modeLabel}</span>
      </div>
      <div style={{ background: C.card, borderRadius: 16, padding: "4px 22px", marginBottom: 26 }}>
        {stocks.length === 0 ? (
          <p style={{ padding: "22px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>
            {listMode === "즐겨찾기" ? "즐겨찾기한 종목이 없습니다." : "보유 종목이 없습니다."}
          </p>
        ) : loading && groups.length === 0 ? (
          <p style={{ padding: "22px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>뉴스를 불러오는 중…</p>
        ) : apiUnavailable ? (
          <p style={{ padding: "22px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>
            뉴스 API가 아직 설정되지 않았습니다.
          </p>
        ) : (
          groups.map((g, gi) => (
            <div key={g.name} style={{ padding: "14px 0", borderTop: gi ? `0.5px solid ${C.sep}` : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: g.color || C.gray, flexShrink: 0 }} />
                <span style={{ fontSize: 15, fontWeight: 700 }}>{g.name}</span>
              </div>
              {g.items.length === 0 ? (
                <p style={{ margin: "0 0 4px", fontSize: 13, color: C.ter }}>관련 뉴스가 없습니다.</p>
              ) : (
                g.items.map((item, ii) => (
                  <a
                    key={ii}
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ display: "block", textDecoration: "none", color: "inherit", padding: "6px 0" }}
                  >
                    <p
                      style={{
                        margin: 0, fontSize: 14, fontWeight: 600, lineHeight: 1.35,
                        display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                      }}
                    >
                      {item.title}
                    </p>
                    <p style={{ ...NUM, margin: "4px 0 0", fontSize: 12, color: C.sec }}>
                      {item.source}
                      {item.source && item.timeAgo ? " · " : ""}
                      {item.timeAgo}
                    </p>
                  </a>
                ))
              )}
            </div>
          ))
        )}
      </div>
    </>
  );
}
