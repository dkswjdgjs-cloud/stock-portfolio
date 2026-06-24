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

  const vals = points.flatMap((p) => [p.value, p.invested, p.profit]);
  const rawMax = Math.max(...vals, 0);
  const rawMin = Math.min(0, ...vals);

  const tickInterval = niceTickInterval(rawMax - rawMin || 1, 5);
  const tickMin = Math.floor(rawMin / tickInterval) * tickInterval;
  const tickMax = Math.ceil(rawMax / tickInterval) * tickInterval;
  const yTicks: number[] = [];
  for (let v = tickMin; v <= tickMax + tickInterval * 0.01; v += tickInterval) yTicks.push(v);

  const sx = (i: number) => PL + (i / Math.max(points.length - 1, 1)) * (W - PL - PR);
  const sy = (v: number) => H - PB - ((v - tickMin) / (tickMax - tickMin || 1)) * (H - PB - PT);

  type SeriesKey = "value" | "invested" | "profit";
  const coords = (key: SeriesKey): [number, number][] => points.map((p, i) => [sx(i), sy(p[key])]);
  const line = (key: SeriesKey) =>
    points.length > 120
      ? coords(key).map((c, i) => `${i ? "L" : "M"}${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(" ")
      : smoothPath(coords(key));
  const area = (key: SeriesKey) =>
    `${line(key)} L${sx(points.length - 1).toFixed(1)},${(H - PB).toFixed(1)} L${PL},${(H - PB).toFixed(1)} Z`;

  const SERIES: { key: SeriesKey; label: string; color: string; width: number; dash?: string }[] = [
    { key: "invested", label: "누적투자금", color: C.gray, width: 1.5, dash: "1 4" },
    { key: "profit", label: "누적수익금", color: C.green, width: 2 },
    { key: "value", label: "누적평가액", color: C.blue, width: 2.4 },
  ];

  // X축 라벨: 겹치지 않게 월 단위로 추출 (최대 약 12개)
  const xLabels: { i: number; label: string }[] = [];
  if (points.length > 1) {
    const minGapPx = 52; // SVG 단위 기준 최소 간격
    let lastX = -999;
    // 월의 첫 날짜 인덱스만 선택
    let prevMonth = "";
    points.forEach((p, i) => {
      const ym = p.label.slice(0, 7);
      if (ym !== prevMonth) {
        prevMonth = ym;
        const x = sx(i);
        if (x - lastX >= minGapPx) {
          xLabels.push({ i, label: ym });
          lastX = x;
        }
      }
    });
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!points.length) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const frac = Math.max(0, Math.min(1, (px - PL) / (W - PL - PR)));
    const idx = Math.round(frac * (points.length - 1));
    setHoverIdx(idx);
  }, [points.length]);

  const hp = hoverIdx !== null ? points[hoverIdx] : null;
  const hx = hoverIdx !== null ? sx(hoverIdx) : 0;

  // 툴팁 위치: 오른쪽 넘치면 왼쪽에 표시
  const tooltipW = 148, tooltipOnLeft = hoverIdx !== null && hx > W * 0.6;

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
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHoverIdx(null)}>
        <defs>
          <linearGradient id="pf-v" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={C.blue} stopOpacity="0.18" />
            <stop offset="100%" stopColor={C.blue} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Y축 눈금선 + 라벨 */}
        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={PL} x2={W - PR} y1={sy(v)} y2={sy(v)} stroke="rgba(60,60,67,0.09)" strokeWidth="1" />
            <text x={PL - 5} y={sy(v) + 3} fontSize="7.5" fill="rgba(60,60,67,0.45)" textAnchor="end" style={NUM}>{fmtM(v)}</text>
          </g>
        ))}

        {/* X축 세로 눈금선 */}
        {xLabels.map(({ i }) => (
          <line key={i} x1={sx(i)} x2={sx(i)} y1={PT} y2={H - PB} stroke="rgba(60,60,67,0.07)" strokeWidth="1" />
        ))}

        {/* 차트 영역 */}
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

        {/* X축 라벨 */}
        {xLabels.map(({ i, label }) => (
          <text key={i} x={sx(i)} y={H - 9} fontSize="7.5" fill="rgba(60,60,67,0.45)"
            textAnchor="middle" style={NUM}>{label}</text>
        ))}

        {/* 호버 크로스헤어 + 툴팁 */}
        {hp !== null && hoverIdx !== null && (
          <g>
            <line x1={hx} x2={hx} y1={PT} y2={H - PB} stroke="rgba(60,60,67,0.25)" strokeWidth="1" strokeDasharray="3 3" />
            {/* 각 시리즈 교차점 */}
            {SERIES.map((s) => {
              const v = hp[s.key as SeriesKey];
              return <circle key={s.key} cx={hx} cy={sy(v)} r="3.5" fill={s.color} stroke="#fff" strokeWidth="1.2" />;
            })}
            {/* 툴팁 박스 */}
            <g transform={`translate(${tooltipOnLeft ? hx - tooltipW - 10 : hx + 10},${PT + 2})`}>
              <rect x="0" y="0" width={tooltipW} height="62" rx="6"
                fill="rgba(255,255,255,0.96)" stroke="rgba(60,60,67,0.12)" strokeWidth="1"
                style={{ filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.10))" }} />
              <text x="9" y="14" fontSize="10" fontWeight="600" fill="rgba(60,60,67,0.55)" style={NUM}>{hp.label}</text>
              <text x="9" y="29" fontSize="10.5" fill={C.blue} style={NUM}>
                평가액 {fmtEok(hp.value)}
              </text>
              <text x="9" y="44" fontSize="10.5" fill={C.gray} style={NUM}>
                투입금 {fmtEok(hp.invested)}
              </text>
              <text x="9" y="59" fontSize="10.5" fill={C.green} style={NUM}>
                수익금 {hp.profit >= 0 ? "+" : ""}{fmtEok(hp.profit)}
              </text>
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

// ===== 기간별 수익금 막대 차트 =====
export function ProfitBarChart({ bars }: { bars: ProfitBar[] }) {
  const W = 600, H = 264, PL = 10, PR = 52, PT = 18, PB = 26;
  const maxAbs = Math.max(...bars.map((b) => Math.abs(b.value)), 1);
  const hasNeg = bars.some((b) => b.value < 0);
  const yLen = hasNeg ? (H - PB - PT) / 2 : H - PB - PT;
  const y0 = hasNeg ? PT + yLen : H - PB;
  const step = (W - PL - PR) / bars.length;
  const bw = Math.min(30, step * 0.58);
  const labelEvery = bars.length > 16 ? 5 : 1;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: "block" }}>
      <defs>
        <linearGradient id="pb-up" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.red} stopOpacity="0.95" />
          <stop offset="100%" stopColor={C.red} stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="pb-dn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={C.blue} stopOpacity="0.55" />
          <stop offset="100%" stopColor={C.blue} stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <line x1={PL} x2={W - PR + 6} y1={PT} y2={PT} stroke="rgba(60,60,67,0.10)" strokeWidth="1" />
      <text x={W - PR + 10} y={PT + 3.5} fontSize="10.5" fill="rgba(60,60,67,0.45)" style={NUM}>{fmtEok(maxAbs)}</text>
      {hasNeg && (
        <>
          <line x1={PL} x2={W - PR + 6} y1={H - PB} y2={H - PB} stroke="rgba(60,60,67,0.10)" strokeWidth="1" />
          <text x={W - PR + 10} y={H - PB + 3.5} fontSize="10.5" fill="rgba(60,60,67,0.45)" style={NUM}>{fmtEok(-maxAbs)}</text>
        </>
      )}
      <line x1={PL} x2={W - PR + 6} y1={y0} y2={y0} stroke="rgba(60,60,67,0.22)" strokeWidth="1" />
      <text x={W - PR + 10} y={y0 + 3.5} fontSize="10.5" fill="rgba(60,60,67,0.45)" style={NUM}>0</text>
      {bars.map((b, i) => {
        const h = (Math.abs(b.value) / maxAbs) * yLen;
        const x = PL + i * step + (step - bw) / 2;
        const y = b.value >= 0 ? y0 - h : y0;
        return (
          <g key={i}>
            <rect x={x} y={y} width={bw} height={Math.max(h, 2)} rx={Math.min(5, bw / 2.4)}
              fill={b.value >= 0 ? "url(#pb-up)" : "url(#pb-dn)"} />
            {bars.length <= 13 && (
              <text x={x + bw / 2} y={b.value >= 0 ? y - 6 : y + h + 12} textAnchor="middle" fontSize="10"
                fontWeight="600" fill={b.value >= 0 ? C.red : C.blue} style={NUM}>{fmtEok(b.value)}</text>
            )}
            {i % labelEvery === 0 && (
              <text x={x + bw / 2} y={H - 7} textAnchor="middle" fontSize="10.5" fill="rgba(60,60,67,0.45)">{b.label}</text>
            )}
          </g>
        );
      })}
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
