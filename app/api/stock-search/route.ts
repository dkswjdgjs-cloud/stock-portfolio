import { NextRequest, NextResponse } from "next/server";
import stockMaster from "@/data/stock-master.json";

interface StockEntry {
  ticker: string;
  name: string;
  market: "KR" | "US";
}

const master = stockMaster as StockEntry[];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") || "").trim().toLowerCase();

  if (!q || q.length < 1) return NextResponse.json([]);

  const results = master.filter(
    (s) => s.name.toLowerCase().includes(q) || s.ticker.toLowerCase().includes(q)
  ).slice(0, 20);

  return NextResponse.json(results);
}
