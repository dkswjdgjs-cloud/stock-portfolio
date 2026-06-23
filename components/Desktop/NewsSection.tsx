"use client";
import { useState } from "react";
import { C } from "@/lib/glow-theme";
import { type NewsTarget } from "@/lib/useStockNews";
import StockNewsGrid from "./StockNewsGrid";
import { Segment } from "./ui";

export default function NewsSection({
  heldStocks, favStocks, onSelectStock,
}: {
  heldStocks: NewsTarget[];
  favStocks: NewsTarget[];
  onSelectStock: (id: string) => void;
}) {
  const [mode, setMode] = useState("보유 종목");
  const stocks = mode === "즐겨찾기" ? favStocks : heldStocks;

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
      ) : (
        stocks.map((s, si) => (
          <div
            key={s.id}
            style={{
              marginBottom: 28, paddingBottom: 22,
              borderBottom: si < stocks.length - 1 ? `0.5px solid ${C.sep}` : "none",
            }}
          >
            <h3 style={{ margin: "0 0 14px", fontSize: 19, fontWeight: 700 }}>{s.name}</h3>
            <StockNewsGrid target={s} fetchCount={8} onMore={() => onSelectStock(s.id)} />
          </div>
        ))
      )}
    </>
  );
}
