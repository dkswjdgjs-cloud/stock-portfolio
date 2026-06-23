"use client";
import { useState } from "react";
import { C, FONT, NUM } from "@/lib/glow-theme";
import { ACCT_LIST } from "@/lib/tabletV2Helpers";

// ===== 등락률 배지 =====
export function Badge({ pct, size = 15 }: { pct: number; size?: number }) {
  const bg = pct > 0 ? C.red : pct < 0 ? C.blue : C.gray;
  const txt = pct > 0 ? `+${pct.toFixed(2)}%` : pct < 0 ? `${pct.toFixed(2)}%` : "0.00%";
  return (
    <span
      style={{
        ...NUM, display: "inline-block", minWidth: 78, textAlign: "right", padding: "3px 8px",
        borderRadius: 7, fontSize: size, fontWeight: 600, color: "#fff", background: bg,
      }}>
      {txt}
    </span>
  );
}

// ===== iOS 세그먼트 컨트롤 =====
export function Segment({
  items, value, onChange, compact,
}: {
  items: string[];
  value: string;
  onChange: (v: string) => void;
  compact?: boolean;
}) {
  return (
    <div style={{ display: "inline-flex", background: C.search, borderRadius: 9, padding: 2 }}>
      {items.map((it) => (
        <button key={it} onClick={() => onChange(it)}
          style={{
            border: "none", padding: compact ? "4px 14px" : "5px 20px", borderRadius: 7, fontSize: 13,
            fontFamily: FONT, fontWeight: value === it ? 600 : 500, cursor: "pointer",
            background: value === it ? "#fff" : "transparent",
            boxShadow: value === it ? "0 1px 3px rgba(0,0,0,0.12)" : "none",
            color: C.label, transition: "all .15s",
          }}>
          {it}
        </button>
      ))}
    </div>
  );
}

// ===== 계좌 드롭다운 =====
export function AcctDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer", fontFamily: FONT,
          background: value === "전체" ? C.search : C.blue, color: value === "전체" ? C.label : "#fff",
          borderRadius: 9, padding: "6px 12px", fontSize: 13, fontWeight: 600,
        }}>
        {value === "전체" ? "계좌 · 전체" : value}
        <svg width="9" height="6" viewBox="0 0 10 6" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }}>
          <path d="M1 1l4 4 4-4" stroke={value === "전체" ? "rgba(60,60,67,0.6)" : "#fff"} strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div
            style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, minWidth: 168,
              background: "rgba(250,250,250,0.97)", borderRadius: 13, padding: "5px 0",
              boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(60,60,67,0.15)",
            }}>
            {ACCT_LIST.map((a, i) => (
              <div key={a} onClick={() => { onChange(a); setOpen(false); }}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "9px 14px", fontSize: 15, cursor: "pointer",
                  borderTop: i ? `0.5px solid ${C.sep}` : "none",
                }}>
                <span style={{ fontWeight: value === a ? 600 : 400 }}>{a}</span>
                {value === a && (
                  <svg width="13" height="11" viewBox="0 0 14 11">
                    <path d="M1 6l4 4L13 1" stroke={C.blue} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ===== 사이드바 토글 버튼 =====
export function SidebarToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} title="사이드바"
      style={{
        width: 34, height: 34, borderRadius: "50%", border: "none", background: C.fill,
        cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0,
      }}>
      <svg width="17" height="15" viewBox="0 0 18 16">
        <rect x="1" y="1" width="16" height="14" rx="3.2" fill="none" stroke={C.blue} strokeWidth="1.7" />
        <line x1="6.7" y1="1.5" x2="6.7" y2="14.5" stroke={C.blue} strokeWidth="1.7" />
        {open && <rect x="2.2" y="2.2" width="3.4" height="11.6" rx="1.2" fill={C.blue} opacity="0.35" />}
      </svg>
    </button>
  );
}

// ===== 즐겨찾기 별 버튼 =====
export function StarButton({ active, onClick, size = 22 }: { active: boolean; onClick: () => void; size?: number }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick(); }}
      title={active ? "즐겨찾기 해제" : "즐겨찾기 추가"}
      style={{
        border: "none", background: "transparent", cursor: "pointer", padding: 4,
        display: "grid", placeItems: "center", flexShrink: 0, lineHeight: 0,
      }}>
      <svg width={size} height={size} viewBox="0 0 24 24"
        fill={active ? C.orange : "none"} stroke={active ? C.orange : C.ter}
        strokeWidth="1.8" strokeLinejoin="round">
        <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 18.6 6 20.8l1.1-6.6L2.4 9.5l6.6-.9z" />
      </svg>
    </button>
  );
}

// ===== 헤더 ⋯ 메뉴 (내 종목 / 즐겨찾기) =====
export function HeaderMenu({ listMode, onMode }: { listMode: string; onMode: (m: string) => void }) {
  const [open, setOpen] = useState(false);
  const items = [
    { key: "보유", label: "내 종목" },
    { key: "즐겨찾기", label: "즐겨찾기" },
  ];
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{ width: 32, height: 32, borderRadius: "50%", border: "none", background: C.fill, color: C.sec, fontSize: 18, cursor: "pointer", display: "grid", placeItems: "center" }}>⋯</button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
          <div style={{
            position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 50, minWidth: 180,
            background: "rgba(250,250,250,0.97)", borderRadius: 13, padding: "5px 0",
            boxShadow: "0 8px 40px rgba(0,0,0,0.18), 0 0 0 0.5px rgba(60,60,67,0.15)",
          }}>
            {items.map((it, i) => (
              <div key={it.key} onClick={() => { onMode(it.key); setOpen(false); }}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  padding: "10px 14px", fontSize: 15, cursor: "pointer",
                  borderTop: i ? `0.5px solid ${C.sep}` : "none",
                }}>
                <span style={{ fontWeight: listMode === it.key ? 600 : 400 }}>{it.label}</span>
                {listMode === it.key && (
                  <svg width="13" height="11" viewBox="0 0 14 11"><path d="M1 6l4 4L13 1" stroke={C.blue} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" /></svg>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
