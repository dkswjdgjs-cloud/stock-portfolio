"use client";
import { C, NUM } from "@/lib/glow-theme";

export function Badge({ pct, size = 13 }: { pct: number; size?: number }) {
  const bg = pct > 0 ? C.red : pct < 0 ? C.blue : C.gray;
  const txt = pct > 0 ? `+${pct.toFixed(2)}%` : pct < 0 ? `${pct.toFixed(2)}%` : "0.00%";
  return <span style={{ ...NUM, padding: "3px 8px", borderRadius: 6, fontSize: size, fontWeight: 600, color: "#fff", background: bg }}>{txt}</span>;
}

export function AssetBars({ items }: { items: { id: string; label: string; value: number; color: string }[] }) {
  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  return (
    <div>
      <div style={{ display: "flex", height: 28, borderRadius: 9, overflow: "hidden", marginBottom: 14 }}>
        {items.map((it, i) => (
          <div key={it.id} style={{ width: `${(it.value / total) * 100}%`, height: "100%", background: it.color, marginLeft: i ? 1.5 : 0 }} />
        ))}
      </div>
      {items.map((it, i) => (
        <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
          <span style={{ width: 28, height: 28, borderRadius: 8, background: it.color + "22", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <span style={{ width: 10, height: 10, borderRadius: "50%", background: it.color }} />
          </span>
          <span style={{ flex: 1, fontSize: 15, color: C.label }}>{it.label}</span>
          <span style={{ ...NUM, fontSize: 15, fontWeight: 600, color: C.label }}>{((it.value / total) * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

export function MiniChart({ data, color, h = 140 }: { data: { value: number }[]; color: string; h?: number }) {
  const w = 353;
  const vals = data.map(d => d.value);
  if (vals.length < 2) return null;
  const min = Math.min(...vals), max = Math.max(...vals);
  const pts = vals.map((v, i) => `${6+(i/(vals.length-1))*(w-12)},${h-6-((v-min)/(max-min||1))*(h-16)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" style={{ display: "block" }}>
      <defs><linearGradient id="mcg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity="0.18" /><stop offset="100%" stopColor={color} stopOpacity="0" /></linearGradient></defs>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <polygon points={`${pts} ${w-6},${h-6} 6,${h-6}`} fill="url(#mcg)" />
    </svg>
  );
}

export function BottomTabBar({ tab, onTab }: { tab: number; onTab: (t: number) => void }) {
  const tabs = [
    { label: "포트폴리오", icon: (c: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg> },
    { label: "자산배분", icon: (c: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3v9l6.36 3.64"/></svg> },
    { label: "성과", icon: (c: string) => <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  ];
  return (
    <div style={{ flexShrink: 0, borderTop: `0.5px solid ${C.sep}`, padding: "6px 0 env(safe-area-inset-bottom, 20px)", display: "flex", justifyContent: "space-around", background: C.card }}>
      {tabs.map((tb, i) => (
        <button key={tb.label} onClick={() => onTab(i)}
          style={{ border: "none", background: "transparent", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "4px 20px", fontFamily: "inherit" }}>
          {tb.icon(tab === i ? C.blue : C.gray)}
          <span style={{ fontSize: 10, fontWeight: 500, color: tab === i ? C.blue : C.gray }}>{tb.label}</span>
        </button>
      ))}
    </div>
  );
}
