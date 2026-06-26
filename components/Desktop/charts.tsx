"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import { C, NUM } from "@/lib/glow-theme";
import { fmtEok, type AcctPerf, type PerfPoint, type ProfitBar } from "@/lib/tabletV2Helpers";

export interface DonutItem {
  key: string;
  label: string;
  value: number;
  color: string;
}

// ===== 도넛 차트 =====
export function Donut({
  items, active, onPick, size = 210,
}: {
  items: DonutItem[];
  active: string | null;
  onPick?: (key: string) => void;
  size?: number;
}) {
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  let offset = 25;
  return (
    <svg viewBox="0 0 42 42" width={size} height={size} style={{ display: "block", overflow: "visible" }}>
      {items.map((it) => {
        const w = (it.value / total) * 100;
        const o = offset;
        offset -= w;
        const dim = active && active !== it.key;
        return (
          <circle key={it.key} cx="21" cy="21" r="15.9155" fill="none"
            stroke={it.color} strokeWidth={active === it.key ? 9 : 8}
            strokeDasharray={`${w} ${100 - w}`} strokeDashoffset={o}
            opacity={dim ? 0.25 : 1}
            style={{ cursor: onPick ? "pointer" : "default", transition: "opacity .25s" }}
            onClick={() => onPick && onPick(it.key)} />
        );
      })}
    </svg>
  );
}

// ===== 주가 라인 차트 (실데이터) =====
export interface ChartPoint { date: string; close: number; open?: number; high?: number; low?: number; volume?: number; }

export function PriceChart({ data, currency }: { data: ChartPoint[]; currency: string }) {
  const W = 560, H = 220, PAD = 8;
  if (!data.length) return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <text x={W / 2} y={H / 2} textAnchor="middle" fill={C.sec} fontSize="14">차트 데이터 없음</text>
    </svg>
  );
  const closes = data.map((d) => d.close);
  const n = closes.length;
  const min = Math.min(...closes), max = Math.max(...closes);
  const up = closes[n - 1] >= closes[0];
  const col = up ? C.red : C.blue;
  const xy = (v: number, i: number): [number, number] => [
    PAD + (i / (n - 1)) * (W - PAD * 2),
    H - PAD - ((v - min) / (max - min || 1)) * (H - PAD * 2),
  ];
  const path = closes.map((v, i) => { const [x, y] = xy(v, i); return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`; }).join(" ");
  const [lx, ly] = xy(closes[n - 1], n - 1);
  const gid = `pc-${n}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={col} stopOpacity="0.22" />
          <stop offset="100%" stopColor={col} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={PAD} x2={W - PAD} y1={H * f} y2={H * f} stroke={C.sep} strokeWidth="0.5" strokeDasharray="3 4" />
      ))}
      <path d={`${path} L${(W - PAD).toFixed(1)},${H - PAD} L${PAD},${H - PAD} Z`} fill={`url(#${gid})`} />
      <path d={path} fill="none" stroke={col} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3.5" fill={col} />
    </svg>
  );
}


// ===== 스무딩 패스 (Catmull-Rom → Bezier) =====
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 3) return pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  const t = 0.18;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(i - 1, 0)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(i + 2, pts.length - 1)];
    d += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)},${(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)},${(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return d;
}

// ===== 3계열 누적 라인 차트 (누적평가액/누적투자금/누적수익금) =====
function niceTickInterval(range: number, targetCount: number): number {
  const rough = range / targetCount;
  const mag = Math.pow(10, Math.floor(Math.log10(rough)));
  const norm = rough / mag;
  const nice = norm < 1.5 ? 1 : norm < 3.5 ? 2 : norm < 7.5 ? 5 : 10;
  return nice * mag;
}

function fmtM(v: number): string {
  const m = Math.round(v / 1_000_000);
  return m === 0 ? "0" : `${m}M`;
}

export function PerfLineChart({ points }: { points: PerfPoint[] }) {
  const W = 600, H = 264, PL = 28, PR = 10, PT = 14, PB = 28;

  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [xView, setXView] = useState<[number, number]>([0, 1]);
  const [yView, setYView] = useState<[number, number]>([-1e8, 2e8]);
  const [isDragging, setIsDragging] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ cx: number; cy: number; xv: [number, number]; yv: [number, number] } | null>(null);

  // 데이터 로드 시 뷰 초기화
  useEffect(() => {
    if (!points.length) return;
    const n = points.length - 1;
    const vals = points.flatMap((p) => [p.value, p.invested, p.profit]);
    const rawMax = Math.max(...vals, 0);
    const rawMin = Math.min(0, ...vals);
    const ti = niceTickInterval(rawMax - rawMin || 1, 5);
    setXView([0, n]);
    setYView([Math.floor(rawMin / ti) * ti, Math.ceil(rawMax / ti) * ti]);
  }, [points.length]);

  // Y 눈금
  const yTi = niceTickInterval(yView[1] - yView[0] || 1, 5);
  const yTicks: number[] = [];
  for (let v = Math.floor(yView[0] / yTi) * yTi; v <= yView[1] + yTi * 0.01; v += yTi) yTicks.push(v);

  const sx = (i: number) => PL + ((i - xView[0]) / (xView[1] - xView[0])) * (W - PL - PR);
  const sy = (v: number) => H - PB - ((v - yView[0]) / (yView[1] - yView[0])) * (H - PB - PT);
  const pxToIdx = (px: number) => xView[0] + (Math.max(0, Math.min(1, (px - PL) / (W - PL - PR)))) * (xView[1] - xView[0]);

  type SeriesKey = "value" | "invested" | "profit";
  const coords = (key: SeriesKey): [number, number][] => points.map((p, i) => [sx(i), sy(p[key])]);
  const line = (key: SeriesKey) => smoothPath(coords(key));
  const area = (key: SeriesKey) =>
    `${line(key)} L${sx(points.length - 1).toFixed(1)},${sy(0).toFixed(1)} L${sx(0).toFixed(1)},${sy(0).toFixed(1)} Z`;

  const SERIES: { key: SeriesKey; label: string; color: string; width: number; dash?: string }[] = [
    { key: "invested", label: "누적투자금", color: C.gray, width: 1.5, dash: "1 4" },
    { key: "profit", label: "누적수익금", color: C.green, width: 2 },
    { key: "value", label: "누적평가액", color: C.blue, width: 2.4 },
  ];

  // X축 라벨: 현재 뷰에서 겹치지 않게
  const xLabels: { i: number; label: string }[] = [];
  if (points.length > 1) {
    const minGapPx = 52;
    let lastX = -999;
    let prevMonth = "";
    points.forEach((p, i) => {
      if (i < Math.floor(xView[0]) - 1 || i > Math.ceil(xView[1]) + 1) return;
      const ym = p.label.slice(0, 7);
      if (ym !== prevMonth) {
        prevMonth = ym;
        const x = sx(i);
        if (x - lastX >= minGapPx && x >= PL && x <= W - PR) {
          xLabels.push({ i, label: ym });
          lastX = x;
        }
      }
    });
  }

  // 마우스 휠: non-passive로 등록해야 preventDefault()가 페이지 스크롤을 막을 수 있음
  const xViewRef = useRef(xView);
  const yViewRef = useRef(yView);
  xViewRef.current = xView;
  yViewRef.current = yView;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const svgY = ((e.clientY - rect.top) / rect.height) * H;
      const factor = e.deltaY < 0 ? 0.8 : 1.25;
      if (svgX < PL) {
        setYView(([lo, hi]) => {
          const center = (lo + hi) / 2;
          const half = (hi - lo) / 2 * factor;
          return [center - half, center + half];
        });
      } else if (svgY > H - PB) {
        const frac = Math.max(0, Math.min(1, (svgX - PL) / (W - PL - PR)));
        setXView(([lo, hi]) => {
          const pivot = lo + frac * (hi - lo);
          const newLo = Math.max(0, pivot - (pivot - lo) * factor);
          const newHi = Math.min(points.length - 1, pivot + (hi - pivot) * factor);
          return [newLo, newHi];
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [points.length]);

  // 드래그: mousedown에서 즉시 window 리스너 등록 (state 업데이트 지연 없음)
  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const svgY = ((e.clientY - rect.top) / rect.height) * H;
    if (svgX < PL || svgX > W - PR || svgY < PT || svgY > H - PB) return;
    const snap = { cx: e.clientX, cy: e.clientY, xv: xView, yv: yView };
    dragRef.current = snap;
    setIsDragging(true);
    setHoverIdx(null);
    const svgEl = svgRef.current;
    const onMove = (ev: MouseEvent) => {
      if (!svgEl) return;
      const r = svgEl.getBoundingClientRect();
      const dx = ev.clientX - snap.cx;
      const dy = ev.clientY - snap.cy;
      const xSpan = snap.xv[1] - snap.xv[0];
      const ySpan = snap.yv[1] - snap.yv[0];
      const dxData = -(dx / r.width) * W / (W - PL - PR) * xSpan;
      const dyData = (dy / r.height) * H / (H - PB - PT) * ySpan;
      const span = snap.xv[1] - snap.xv[0];
      const rawLo = snap.xv[0] + dxData;
      const clampedLo = Math.max(0, Math.min(points.length - 1 - span, rawLo));
      setXView([clampedLo, clampedLo + span]);
      setYView([snap.yv[0] + dyData, snap.yv[1] + dyData]);
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [xView, yView, points.length]);

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging || !points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const idx = Math.round(Math.max(0, Math.min(points.length - 1, pxToIdx(px))));
    setHoverIdx(idx);
  }, [isDragging, points.length, xView]);

  const hp = hoverIdx !== null ? points[hoverIdx] : null;
  const hxRaw = hoverIdx !== null ? sx(hoverIdx) : 0;
  const hx = Math.max(PL, Math.min(W - PR, hxRaw)); // 클램핑: 마지막 점이 범위 밖이어도 가장자리에 표시
  const fmtExact = (v: number) => (v >= 0 ? "+" : "-") + Math.round(Math.abs(v)).toLocaleString("ko-KR") + "원";
  const tooltipLines = hp ? [hp.label, "평가액 " + fmtExact(hp.value), "투입금 " + fmtExact(hp.invested), "수익금 " + fmtExact(hp.profit)] : [];
  const tooltipW = Math.max(...tooltipLines.map((l) => l.length)) * 3.05 + 14;
  const tooltipOnLeft = hoverIdx !== null && hx > W * 0.6;

  const cursor = isDragging ? "grabbing" : "crosshair";

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
        {[...SERIES].reverse().map((s) => (
          <span key={s.key}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600,
              color: s.color, background: C.fill, borderRadius: 20, padding: "4px 11px",
            }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%"
        style={{ display: "block", cursor, userSelect: "none" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { if (!isDragging) setHoverIdx(null); }}
        onMouseDown={handleMouseDown}>
        <defs>
          <linearGradient id="pf-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity="0.18" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
          </linearGradient>
          <clipPath id="pf-clip">
            <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} />
          </clipPath>
        </defs>

        {/* Y축 눈금선 + 라벨 */}
        {yTicks.map((v, i) => {
          const y = sy(v);
          if (y < PT || y > H - PB) return null;
          return (
            <g key={i}>
              <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="rgba(60,60,67,0.09)" strokeWidth="1" />
              <text x={PL - 5} y={y + 3} fontSize="6" fill="rgba(60,60,67,0.45)" textAnchor="end" style={NUM}>{fmtM(v)}</text>
            </g>
          );
        })}

        {/* X축 세로 눈금선 */}
        {xLabels.map(({ i }) => (
          <line key={i} x1={sx(i)} x2={sx(i)} y1={PT} y2={H - PB} stroke="rgba(60,60,67,0.07)" strokeWidth="1" />
        ))}

        {/* X/Y 기준선 */}
        <line x1={PL} x2={PL} y1={PT} y2={H - PB} stroke="rgba(20,20,25,0.75)" strokeWidth="1.2" />
        {sy(0) >= PT && sy(0) <= H - PB && (
          <line x1={PL} x2={W - PR} y1={sy(0)} y2={sy(0)} stroke="rgba(20,20,25,0.75)" strokeWidth="1.2" />
        )}

        {/* 차트 영역 (clipPath 적용) */}
        <g clipPath="url(#pf-clip)">
          <path d={area("value")} fill="url(#pf-v)" />
          {SERIES.map((s) => (
            <path key={s.key} d={line(s.key)} fill="none" stroke={s.color} strokeWidth={s.width}
              strokeDasharray={s.dash || "none"} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {/* 끝점 원형 마커 */}
          {SERIES.filter((s) => !s.dash).map((s) => {
            const c = coords(s.key)[points.length - 1];
            return (
              <g key={s.key}>
                <circle cx={c[0]} cy={c[1]} r="7" fill={s.color} opacity="0.18" />
                <circle cx={c[0]} cy={c[1]} r="3.2" fill={s.color} stroke="#fff" strokeWidth="1.4" />
              </g>
            );
          })}
        </g>

        {/* X축 라벨 */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={sx(i)} y={H - 9} fontSize="6" fill="rgba(60,60,67,0.45)"
            textAnchor="middle" style={NUM}>{label}</text>
        ))}

        {/* 호버 크로스헤어 + 툴팁 */}
        {hp !== null && hoverIdx !== null && !isDragging && (
          <g>
            <line x1={hx} x2={hx} y1={PT} y2={H - PB} stroke="rgba(60,60,67,0.25)" strokeWidth="1" strokeDasharray="3 3" />
            {SERIES.map((s) => {
              const v = hp[s.key as SeriesKey];
              const cy = sy(v);
              if (cy < PT || cy > H - PB) return null;
              return <circle key={s.key} cx={hx} cy={cy} r="3.5" fill={s.color} stroke="#fff" strokeWidth="1.2" />;
            })}
            <g transform={`translate(${tooltipOnLeft ? hx - tooltipW - 10 : hx + 10},${PT + 2})`}>
              <rect x="0" y="0" width={tooltipW} height="50" rx="5"
                fill="rgba(255,255,255,0.96)" stroke="rgba(60,60,67,0.12)" strokeWidth="1"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.10))" }} />
              <text x="7" y="11" fontSize="5.5" fontWeight="600" fill="rgba(60,60,67,0.55)" style={NUM}>{hp.label}</text>
              <text x="7" y="23" fontSize="5.5" fill={C.blue} style={NUM}>평가액 {fmtExact(hp.value)}</text>
              <text x="7" y="34" fontSize="5.5" fill={C.gray} style={NUM}>투입금 {fmtExact(hp.invested)}</text>
              <text x="7" y="45" fontSize="5.5" fill={C.green} style={NUM}>수익금 {fmtExact(hp.profit)}</text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

// ===== 기간별 수익금 막대 차트 =====
export function ProfitBarChart({ bars }: { bars: ProfitBar[] }) {
  const W = 600, H = 264, PL = 28, PR = 10, PT = 14, PB = 28;

  const [xView, setXView] = useState<[number, number]>([0, Math.max(bars.length - 1, 1)]);
  const [yView, setYView] = useState<[number, number]>([-1, 1]);
  const [isDragging, setIsDragging] = useState(false);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ cx: number; cy: number; xv: [number, number]; yv: [number, number] } | null>(null);

  useEffect(() => {
    if (!bars.length) return;
    const maxAbs = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
    const hasNeg = bars.some((b) => b.value < 0);
    const rawMin = hasNeg ? -maxAbs : 0;
    const ti = niceTickInterval(maxAbs - rawMin || 1, 4);
    setXView([0, bars.length - 1]);
    setYView([Math.floor(rawMin / ti) * ti, Math.ceil(maxAbs / ti) * ti]);
  }, [bars.length]);

  const yTi = niceTickInterval(yView[1] - yView[0] || 1, 4);
  const yTicks: number[] = [];
  for (let v = Math.floor(yView[0] / yTi) * yTi; v <= yView[1] + yTi * 0.01; v += yTi) yTicks.push(v);

  // 보이는 바 범위 (소수 인덱스 → 정수 클램프)
  const iMin = Math.max(0, Math.floor(xView[0]));
  const iMax = Math.min(bars.length - 1, Math.ceil(xView[1]));
  const visCount = xView[1] - xView[0] + 1;

  const sy = (v: number) => H - PB - ((v - yView[0]) / (yView[1] - yView[0])) * (H - PB - PT);
  const barX = (i: number) => PL + ((i - xView[0]) / visCount) * (W - PL - PR);
  const barW = Math.max(2, Math.min(36, (W - PL - PR) / visCount * 0.65));

  // 휠 (non-passive)
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const svgX = ((e.clientX - rect.left) / rect.width) * W;
      const svgY = ((e.clientY - rect.top) / rect.height) * H;
      const factor = e.deltaY < 0 ? 0.8 : 1.25;
      if (svgX < PL) {
        setYView(([lo, hi]) => {
          const center = (lo + hi) / 2;
          const half = (hi - lo) / 2 * factor;
          return [center - half, center + half];
        });
      } else if (svgY > H - PB) {
        const frac = Math.max(0, Math.min(1, (svgX - PL) / (W - PL - PR)));
        setXView(([lo, hi]) => {
          const pivot = lo + frac * (hi - lo);
          const newLo = Math.max(0, pivot - (pivot - lo) * factor);
          const newHi = Math.min(bars.length - 1, pivot + (hi - pivot) * factor);
          return [newLo, newHi];
        });
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [bars.length]);

  // 드래그 시작
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (isDragging) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const svgY = ((e.clientY - rect.top) / rect.height) * H;
    if (svgX < PL || svgX > W - PR || svgY < PT || svgY > H - PB) { setHoverIdx(null); return; }
    const frac = (svgX - PL) / (W - PL - PR);
    const idx = Math.round(xView[0] + frac * (xView[1] - xView[0]));
    setHoverIdx(Math.max(iMin, Math.min(iMax, idx)));
  }, [isDragging, xView, iMin, iMax]);

  const handleMouseDown = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    const svgY = ((e.clientY - rect.top) / rect.height) * H;
    if (svgX < PL || svgX > W - PR || svgY < PT || svgY > H - PB) return;
    const snap = { cx: e.clientX, cy: e.clientY, xv: xView, yv: yView };
    dragRef.current = snap;
    setIsDragging(true);
    setHoverIdx(null);
    const svgEl = svgRef.current;
    const onMove = (ev: MouseEvent) => {
      if (!svgEl) return;
      const r = svgEl.getBoundingClientRect();
      const dx = ev.clientX - snap.cx;
      const dy = ev.clientY - snap.cy;
      const xSpan = snap.xv[1] - snap.xv[0];
      const ySpan = snap.yv[1] - snap.yv[0];
      const dxData = -(dx / r.width) * W / (W - PL - PR) * xSpan;
      const dyData = (dy / r.height) * H / (H - PB - PT) * ySpan;
      const newLo = snap.xv[0] + dxData;
      const newHi = snap.xv[1] + dxData;
      if (newLo >= 0 && newHi <= bars.length - 1) setXView([newLo, newHi]);
      setYView([snap.yv[0] + dyData, snap.yv[1] + dyData]);
    };
    const onUp = () => {
      setIsDragging(false);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [xView, yView, bars.length]);

  const cursor = isDragging ? "grabbing" : "crosshair";

  // 툴팁
  const hb = hoverIdx !== null ? bars[hoverIdx] : null;
  const hbX = hoverIdx !== null ? barX(hoverIdx) + ((W - PL - PR) / visCount) / 2 : 0;
  const fmtExactBar = (v: number) => (v >= 0 ? "+" : "-") + Math.round(Math.abs(v)).toLocaleString("ko-KR") + "원";
  const tooltipLabel = hb ? (hb.full ?? hb.label) : "";
  const tooltipVal = hb ? fmtExactBar(hb.value) : "";
  const ttLines = [tooltipLabel, tooltipVal];
  const ttW = Math.max(...ttLines.map((l) => l.length)) * 3.05 + 14;
  const ttOnLeft = hbX > W * 0.6;

  return (
    <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} width="100%"
      style={{ display: "block", cursor, userSelect: "none" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}
      onMouseDown={handleMouseDown}>
      <defs>
        <linearGradient id="pb-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.red} stopOpacity="0.95" />
          <stop offset="100%" stopColor={C.red} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="pb-dn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.blue} stopOpacity="0.55" />
          <stop offset="100%" stopColor={C.blue} stopOpacity="0.95" />
        </linearGradient>
        <clipPath id="pb-clip">
          <rect x={PL} y={PT} width={W - PL - PR} height={H - PT - PB} />
        </clipPath>
      </defs>

      {/* Y축 눈금선 + 라벨 */}
      {yTicks.map((v, i) => {
        const y = sy(v);
        if (y < PT || y > H - PB) return null;
        return (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={y} y2={y} stroke="rgba(60,60,67,0.09)" strokeWidth="1" />
            <text x={PL - 5} y={y + 3} fontSize="6" fill="rgba(60,60,67,0.45)" textAnchor="end" style={NUM}>{fmtM(v)}</text>
          </g>
        );
      })}

      {/* X축 세로 눈금선 */}
      {bars.slice(iMin, iMax + 1).map((_, ii) => {
        const i = iMin + ii;
        const x = barX(i) + barW / 2;
        return <line key={i} x1={x} x2={x} y1={PT} y2={H - PB} stroke="rgba(60,60,67,0.07)" strokeWidth="1" />;
      })}

      {/* X/Y 기준선 */}
      <line x1={PL} x2={PL} y1={PT} y2={H - PB} stroke="rgba(20,20,25,0.75)" strokeWidth="1.2" />
      {sy(0) >= PT && sy(0) <= H - PB && (
        <line x1={PL} x2={W - PR} y1={sy(0)} y2={sy(0)} stroke="rgba(20,20,25,0.75)" strokeWidth="1.2" />
      )}

      {/* 막대 (clipPath 적용) */}
      <g clipPath="url(#pb-clip)">
        {bars.slice(iMin, iMax + 1).map((b, ii) => {
          const i = iMin + ii;
          const x = barX(i) + ((W - PL - PR) / visCount - barW) / 2;
          const yZero = sy(0);
          const yVal = sy(b.value);
          const barTop = b.value >= 0 ? yVal : yZero;
          const barH = Math.max(Math.abs(yZero - yVal), 2);
          return (
            <rect key={i} x={x} y={barTop} width={barW} height={barH} rx={Math.min(4, barW / 3)}
              fill={b.value >= 0 ? C.red : C.blue} opacity="0.75" />
          );
        })}
      </g>

      {/* X축 라벨: 겹치지 않게, 연도 바뀌는 첫 막대는 연도, 나머지는 월-일 */}
      {(() => {
        const minGap = 36;
        let lastX = -999;
        let lastYear = "";
        return bars.slice(iMin, iMax + 1).map((b, ii) => {
          const i = iMin + ii;
          const x = barX(i) + ((W - PL - PR) / visCount) / 2;
          if (x < PL || x > W - PR) return null;
          if (x - lastX < minGap) return null;
          const full = b.full ?? "";
          const year = full.slice(0, 4);
          const isNewYear = year !== lastYear && year.length === 4;
          const displayLabel = isNewYear
            ? year
            : full.length >= 10 ? full.slice(5, 10) : b.label;
          lastX = x;
          if (isNewYear) lastYear = year;
          return (
            <text key={i} x={x} y={H - 9} fontSize="6"
              fill={isNewYear ? "rgba(60,60,67,0.7)" : "rgba(60,60,67,0.45)"}
              fontWeight={isNewYear ? "700" : "400"}
              textAnchor="middle" style={NUM}>{displayLabel}</text>
          );
        });
      })()}

      {/* 호버 툴팁 */}
      {hb !== null && !isDragging && hbX >= PL && hbX <= W - PR && (
        <g>
          <line x1={hbX} x2={hbX} y1={PT} y2={H - PB} stroke="rgba(60,60,67,0.2)" strokeWidth="1" strokeDasharray="3 3" />
          <g transform={`translate(${ttOnLeft ? hbX - ttW - 8 : hbX + 8},${PT + 4})`}>
            <rect x="0" y="0" width={ttW} height="26" rx="4"
              fill="rgba(255,255,255,0.96)" stroke="rgba(60,60,67,0.12)" strokeWidth="1"
              style={{ filter: "drop-shadow(0 2px 5px rgba(0,0,0,0.10))" }} />
            <text x="7" y="10" fontSize="5.5" fontWeight="600" fill="rgba(60,60,67,0.55)" style={NUM}>{tooltipLabel}</text>
            <text x="7" y="21" fontSize="5.5" fill={hb.value >= 0 ? C.red : C.blue} style={NUM}>{tooltipVal}</text>
          </g>
        </g>
      )}
    </svg>
  );
}

// ===== 계좌별 성과 바 =====
export function AcctBar({ a, max, delay }: { a: AcctPerf; max: number; delay: number }) {
  const [w, setW] = useState(0);
  const isPos = a.pct >= 0;
  const accent = isPos ? C.red : C.blue;
  const didAnimate = useRef(false);
  useEffect(() => {
    const target = (Math.abs(a.pct) / max) * 100;
    if (didAnimate.current) { setW(target); return; }
    didAnimate.current = true;
    const t = setTimeout(() => setW(target), 200 + delay);
    return () => clearTimeout(t);
  }, [a.pct, max, delay]);
  return (
    <div style={{ padding: "13px 0", borderTop: "none" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: 17, fontWeight: 600 }}>{a.name}</span>
        <span style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
          <span style={{ ...NUM, fontSize: 14, color: C.sec }}>{a.val}</span>
          <span style={{ ...NUM, fontSize: 17, fontWeight: 700, color: accent }}>{isPos ? "+" : ""}{a.pct.toFixed(2)}%</span>
        </span>
      </div>
      <div style={{ height: 5, borderRadius: 3, background: C.fill, margin: "9px 0 7px", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${w}%`, borderRadius: 3, background: accent, transition: "width .8s cubic-bezier(.25,.8,.3,1)" }} />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <span style={{ ...NUM, fontSize: 13, color: C.sec }}>투입 {a.inv}</span>
        <span style={{ ...NUM, fontSize: 13, fontWeight: 600, color: accent }}>{a.gain}</span>
      </div>
    </div>
  );
}
