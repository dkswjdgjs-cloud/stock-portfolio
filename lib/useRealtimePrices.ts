"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MockStock } from "./tabletV2Helpers";

// =============================================================
// KIS 실시간 시세 중계 서버(kis-realtime-relay) 연결 훅
//
// - 접속 시 보유+즐겨찾기(국내) 종목코드를 "subscribe"로 상시 구독
// - 종목상세에서 보고 있는 종목을 "watch"/"unwatch"로 동적 구독
// - 연결이 끊기면 자동 재연결
// 1차 범위: 국내(KRW) 종목만 지원 (해외는 relay에서 응답하지 않음)
// =============================================================

export interface RealtimeTick {
  price: number;
  change: number;
  changeRate: number;
  time: string;
}

const RELAY_URL = "wss://realtime.segirnd.uk";
const RECONNECT_DELAY_MS = 3000;

export function useRealtimePrices(alwaysTickers: string[]) {
  const [prices, setPrices] = useState<Record<string, RealtimeTick>>({});
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const watchRef = useRef<string | null>(null);
  const alwaysRef = useRef<string[]>(alwaysTickers);
  const pendingRef = useRef<Record<string, RealtimeTick>>({});
  const alwaysKey = alwaysTickers.slice().sort().join(",");

  // 보유+즐겨찾기 목록이 바뀌면 현재 연결에 다시 전송
  useEffect(() => {
    alwaysRef.current = alwaysTickers;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "subscribe", tickers: alwaysTickers }));
    }
    // alwaysKey가 같으면(내용 동일) 재전송하지 않음
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alwaysKey]);

  useEffect(() => {
    let cancelled = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (cancelled) return;
      const ws = new WebSocket(RELAY_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        if (cancelled) return;
        setConnected(true);
        ws.send(JSON.stringify({ type: "subscribe", tickers: alwaysRef.current }));
        if (watchRef.current) {
          ws.send(JSON.stringify({ type: "watch", ticker: watchRef.current }));
        }
      };

      ws.onmessage = (ev) => {
        let msg: { type?: string; ticker?: string; price?: number; change?: number; changeRate?: number; time?: string; kisConnected?: boolean };
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.type === "price" && msg.ticker) {
          // 화면 갱신은 1초 간격으로 묶어서 반영 — 여기서는 최신 값만 버퍼에 저장
          pendingRef.current[msg.ticker] = {
            price: msg.price ?? 0,
            change: msg.change ?? 0,
            changeRate: msg.changeRate ?? 0,
            time: msg.time ?? "",
          };
        } else if (msg.type === "status") {
          setConnected(!!msg.kisConnected);
        }
      };

      ws.onclose = () => {
        if (cancelled) return;
        setConnected(false);
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS);
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    connect();

    return () => {
      cancelled = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, []);

  // 버퍼에 쌓인 최신 시세를 1초마다 한 번씩 화면에 반영 (너무 잦은 리렌더 방지)
  useEffect(() => {
    const interval = setInterval(() => {
      if (Object.keys(pendingRef.current).length === 0) return;
      const updates = pendingRef.current;
      pendingRef.current = {};
      setPrices((prev) => ({ ...prev, ...updates }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // 종목상세에서 보고 있는 종목 1개를 동적으로 구독/해제
  const watch = useCallback((ticker: string | null) => {
    watchRef.current = ticker;
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      if (ticker) ws.send(JSON.stringify({ type: "watch", ticker }));
      else ws.send(JSON.stringify({ type: "unwatch" }));
    }
  }, []);

  return { prices, connected, watch };
}

// 국내(KRW) 종목에 실시간 가격/등락을 덮어씌움 (해외 종목은 그대로 반환)
export function applyRealtimePrice(stock: MockStock, prices: Record<string, RealtimeTick>): MockStock {
  if (stock.currency !== "KRW") return stock;
  const tick = prices[stock.code];
  if (!tick) return stock;
  return { ...stock, price: tick.price, dayPct: tick.changeRate, dailyChangeKRW: tick.change };
}
