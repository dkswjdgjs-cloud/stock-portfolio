"use client";
import { useState } from "react";
import { C, NUM } from "@/lib/glow-theme";
import { useStockNews, type NewsTarget } from "@/lib/useStockNews";
import { Segment } from "./ui";

const PAGE_SIZE = 4;

export default function NewsSection({
  heldStocks, favStocks,
}: {
  heldStocks: NewsTarget[];
  favStocks: NewsTarget[];
}) {
  const [mode, setMode] = useState("보유 종목");
  const stocks = mode === "즐겨찾기" ? favStocks : heldStocks;
  const { groups, loading, apiUnavailable } = useStockNews(stocks);
  const [visible, setVisible] = useState<Record<string, number>>({});

  const showMore = (name: string, total: number) => {
    setVisible((v) => ({ ...v, [name]: Math.min((v[name] ?? PAGE_SIZE) + PAGE_SIZE, total) }));
  };

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>관련 뉴스</h2>
        <Segment compact items={["보유 종목", "즐겨찾기"]} value={mode} onChange={setMode} />
      </div>

      {stocks.length === 0 ? (
        <p style={{ padding: "22px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>
          {mode === "즐겨찾기" ? "즐겨찾기한 종목이 없습니다." : "보유 종목이 없습니다."}
        </p>
      ) : loading && groups.length === 0 ? (
        <p style={{ padding: "22px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>뉴스를 불러오는 중…</p>
      ) : apiUnavailable ? (
        <p style={{ padding: "22px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>
          뉴스 API가 아직 설정되지 않았습니다.
        </p>
      ) : (
        groups.map((g, gi) => {
          const count = visible[g.name] ?? PAGE_SIZE;
          const shown = g.items.slice(0, count);
          return (
            <div
              key={g.name}
              style={{
                marginBottom: 28, paddingBottom: 22,
                borderBottom: gi < groups.length - 1 ? `0.5px solid ${C.sep}` : "none",
              }}
            >
              <h3 style={{ margin: "0 0 14px", fontSize: 19, fontWeight: 700 }}>{g.name}</h3>

              {g.items.length === 0 ? (
                <p style={{ margin: 0, fontSize: 13, color: C.ter }}>관련 뉴스가 없습니다.</p>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "22px 28px" }}>
                    {shown.map((item, ii) => (
                      <a
                        key={ii}
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
                    ))}
                  </div>

                  {count < g.items.length && (
                    <button
                      onClick={() => showMore(g.name, g.items.length)}
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
              )}
            </div>
          );
        })
      )}
    </>
  );
}
