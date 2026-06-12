"use client";
import { C, FONT, NUM } from "@/lib/glow-theme";
import { fmtAvg, fmtN, fmtPrice, fmtW, holdingOf, type MockStock, type PortfolioView } from "@/lib/tabletV2Helpers";
import { type FavEntry } from "@/lib/tabletV2Favorites";
import { AcctDropdown, Badge, HeaderMenu, Segment, StarButton } from "./ui";

export default function Sidebar({
  open, view, tab, onTab, acctSel, onAcct, selected, onPick, onHome,
  query, onQuery, listMode, onListMode, favs, onToggleFav, favStocks,
}: {
  open: boolean;
  view: PortfolioView;
  tab: string;
  onTab: (t: string) => void;
  acctSel: string;
  onAcct: (a: string) => void;
  selected: string | null;
  onPick: (id: string) => void;
  onHome: () => void;
  query: string;
  onQuery: (q: string) => void;
  listMode: string;
  onListMode: (m: string) => void;
  favs: FavEntry[];
  onToggleFav: (s: MockStock) => void;
  favStocks: MockStock[];
}) {
  const isSearching = query.trim().length > 0;

  // 검색: 보유 종목 + 즐겨찾기 종목 합산 후 필터
  const allStocks = [...view.rows.map((r) => r.stock), ...favStocks.filter((fs) => !view.rows.some((r) => r.stock.id === fs.id))];
  const searchResults = isSearching
    ? allStocks.filter((s) =>
        s.name.toLowerCase().includes(query.trim().toLowerCase()) ||
        s.code.toLowerCase().includes(query.trim().toLowerCase())
      )
    : [];

  const isFav = (ticker: string) => favs.some((f) => f.ticker === ticker);

  // 종목 행 렌더
  const renderRow = (s: MockStock, idx: number, opts: { showStar?: boolean; subType?: "holding" | "quote" } = {}) => {
    const h = holdingOf(s, acctSel);
    return (
      <div key={s.id} onClick={() => onPick(s.id)}
        style={{
          display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", cursor: "pointer",
          borderTop: idx ? `0.5px solid ${C.sep}` : "none",
          background: selected === s.id ? "#E4E4E9" : "transparent",
          transition: "background .15s",
        }}>
        {opts.showStar && <StarButton active={isFav(s.code)} onClick={() => onToggleFav(s)} size={20} />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.name}</p>
          <p style={{ ...NUM, margin: "1px 0 0", fontSize: 13, color: C.sec }}>
            {opts.subType === "holding" && h
              ? (tab === "시세" ? `평균 ${fmtAvg(s, h.avg)}` : `${fmtN(h.qty)}주 보유`)
              : `${s.code} · ${s.market}`}
          </p>
        </div>
        <div style={{ textAlign: "right", flexShrink: 0 }}>
          <p style={{ ...NUM, margin: 0, fontSize: 17, fontWeight: 600 }}>
            {opts.subType === "holding" && h && tab === "평가" ? fmtW(h.value) : fmtPrice(s)}
          </p>
          <div style={{ marginTop: 3, height: 27, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            {opts.subType === "holding" && h && tab === "평가" ? (
              <span style={{ ...NUM, fontSize: 12, fontWeight: 600, color: h.pl >= 0 ? C.red : C.blue }}>
                {h.pl >= 0 ? "+" : ""}{fmtW(h.pl)} ({h.pl >= 0 ? "+" : ""}{h.plPct.toFixed(1)}%)
              </span>
            ) : (
              <Badge pct={s.dayPct} />
            )}
          </div>
        </div>
      </div>
    );
  };

  // 리스트 본문
  let listBody: React.ReactNode;
  if (isSearching) {
    listBody = searchResults.length ? (
      searchResults.map((s, i) => renderRow(s, i, { showStar: true, subType: holdingOf(s, acctSel) ? "holding" : "quote" }))
    ) : (
      <div style={{ padding: "28px 16px", textAlign: "center" }}>
        <p style={{ margin: 0, fontSize: 15, color: C.sec }}>'{query}'에 대한 결과가 없어요</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.ter }}>종목명 또는 코드로 검색해 보세요</p>
      </div>
    );
  } else if (listMode === "즐겨찾기") {
    const favList = allStocks.filter((s) => isFav(s.code));
    listBody = favList.length ? (
      favList.map((s, i) => renderRow(s, i, { showStar: true, subType: holdingOf(s, acctSel) ? "holding" : "quote" }))
    ) : (
      <div style={{ padding: "28px 16px", textAlign: "center" }}>
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke={C.ter} strokeWidth="1.6" strokeLinejoin="round" style={{ margin: "0 auto 8px", display: "block" }}>
          <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.7 1.2 6.6L12 18.6 6 20.8l1.1-6.6L2.4 9.5l6.6-.9z" />
        </svg>
        <p style={{ margin: 0, fontSize: 15, color: C.sec }}>즐겨찾기한 종목이 없어요</p>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: C.ter }}>검색 후 ☆를 눌러 추가하세요</p>
      </div>
    );
  } else {
    // 보유 종목 + 현금
    listBody = (
      <>
        {view.rows.map(({ stock: s }, i) => renderRow(s, i, { subType: "holding" }))}
        {view.cash > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 14px", borderTop: `0.5px solid ${C.sep}` }}>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 17, fontWeight: 600 }}>현금성 자산</p>
              <p style={{ margin: "1px 0 0", fontSize: 13, color: C.sec }}>예수금</p>
            </div>
            <div style={{ textAlign: "right" }}>
              <p style={{ ...NUM, margin: 0, fontSize: 17, fontWeight: 600 }}>{fmtW(view.cash)}</p>
              <div style={{ marginTop: 3, height: 27 }} />
            </div>
          </div>
        )}
      </>
    );
  }

  const listLabel = isSearching ? `검색 결과 · ${searchResults.length}개`
    : listMode === "즐겨찾기" ? `즐겨찾기 · ${allStocks.filter((s) => isFav(s.code)).length}개`
    : null;

  return (
    <aside
      style={{
        width: open ? 375 : 0, flexShrink: 0, overflow: "hidden",
        background: C.bgSidebar, borderRight: open ? `0.5px solid ${C.sep}` : "none",
        transition: "width .34s cubic-bezier(.32,.72,.25,1)",
      }}>
      <div style={{ width: 375, height: "100%", overflowY: "auto", padding: "20px 16px 24px", boxSizing: "border-box" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.026em", cursor: "pointer" }}
            onClick={() => { onHome(); onListMode("보유"); onQuery(""); }}>
            GLOW
          </h1>
          <HeaderMenu listMode={listMode} onMode={(m) => { onListMode(m); onPick(""); onQuery(""); }} />
        </div>

        {/* 검색 입력 */}
        <div style={{ display: "flex", alignItems: "center", gap: 7, background: C.search, borderRadius: 10, padding: "8px 10px", marginBottom: 14 }}>
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="6.8" cy="6.8" r="5.3" stroke="rgba(60,60,67,0.6)" strokeWidth="1.6" />
            <path d="M11 11l3.6 3.6" stroke="rgba(60,60,67,0.6)" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="종목명 · 코드 검색"
            style={{
              flex: 1, border: "none", outline: "none", background: "transparent",
              fontSize: 17, fontFamily: FONT, color: C.label, minWidth: 0,
            }}
          />
          {isSearching && (
            <button onClick={() => onQuery("")}
              style={{ border: "none", background: "rgba(60,60,67,0.3)", color: "#fff", width: 18, height: 18, borderRadius: "50%", fontSize: 12, lineHeight: 1, cursor: "pointer", display: "grid", placeItems: "center", flexShrink: 0 }}>✕</button>
          )}
        </div>

        {/* 시세/평가 + 계좌 드롭다운 (보유 모드에서만) */}
        {!isSearching && listMode === "보유" && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <Segment compact items={["시세", "평가"]} value={tab} onChange={onTab} />
            <AcctDropdown value={acctSel} onChange={onAcct} />
          </div>
        )}

        {/* 모드 라벨 */}
        {listLabel && (
          <div style={{ margin: "0 4px 10px" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: C.sec }}>{listLabel}</span>
          </div>
        )}

        <div style={{ background: C.card, borderRadius: 10, overflow: "hidden" }}>
          {listBody}
        </div>

        <p style={{ margin: "14px 0 0", fontSize: 13, color: C.ter, textAlign: "center" }}>
          GLOW · KIS 실시간 시세
        </p>
      </div>
    </aside>
  );
}
