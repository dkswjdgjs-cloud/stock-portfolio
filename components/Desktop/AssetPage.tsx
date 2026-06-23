"use client";
import { useMemo, useState } from "react";
import { C, COUNTRY_COLOR, NUM, SECTOR_COLOR } from "@/lib/glow-theme";
import {
  fmtW,
  type AcctPerf, type PortfolioView, type TradeRow,
} from "@/lib/tabletV2Helpers";
import { AcctBar, Donut, type DonutItem } from "./charts";
import { Segment } from "./ui";

const ACCOUNTS = ['ISA', 'IRP', '연금저축', 'DC형 연금', '일반직투1', '일반직투2'];

const INIT_FORM = () => ({
  trade_date: new Date().toISOString().split('T')[0],
  account: 'ISA', account_transfer: '', transfer_amount: '',
  ticker: '', stock_name: '', sector: '', trade_type: '',
  quantity: '', buy_price: '', sell_price: '', currency: 'KRW', memo: '',
});

const LBL: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: C.sec, marginBottom: 5, display: 'block' };
const INP: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 10,
  border: `1px solid ${C.sep}`, background: C.bgGrouped, color: C.label,
  fontSize: 15, fontFamily: 'inherit', outline: 'none',
};

export default function AssetPage({
  view, acctSel, sbOpen, allTrades, accounts, onRefresh,
}: {
  view: PortfolioView;
  acctSel: string;
  sbOpen: boolean;
  allTrades: TradeRow[];
  accounts: AcctPerf[];
  onRefresh: () => void;
}) {
  const [pieMode, setPieMode] = useState("종목별");
  const [pieActive, setPieActive] = useState<string | null>(null);
  const [showTrades, setShowTrades] = useState(false);
  const [tradesOpen, setTradesOpen] = useState(false);
  const [tradeTap, setTradeTap] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState(INIT_FORM());
  const [saving, setSaving] = useState(false);
  const [saveErr, setSaveErr] = useState('');
  const setF = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async () => {
    setSaving(true); setSaveErr('');
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trade_date: form.trade_date, account: form.account,
          account_transfer: form.account_transfer || null,
          transfer_amount: form.transfer_amount ? parseFloat(form.transfer_amount) : null,
          ticker: form.ticker || null, stock_name: form.stock_name || null,
          sector: form.sector || null, trade_type: form.trade_type || null,
          quantity: form.quantity ? parseFloat(form.quantity) : null,
          buy_price: form.buy_price ? parseFloat(form.buy_price) : null,
          sell_price: form.sell_price ? parseFloat(form.sell_price) : null,
          currency: form.currency, memo: form.memo || null,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setShowAddForm(false); setForm(INIT_FORM()); onRefresh();
    } catch (e: unknown) {
      setSaveErr(e instanceof Error ? e.message : '저장 실패');
    } finally { setSaving(false); }
  };

  const pieItems: DonutItem[] = useMemo(() => {
    if (pieMode === "종목별") {
      return [
        ...view.rows.map((r) => ({ key: r.stock.id, label: r.stock.name, value: r.h.value, color: r.stock.color })),
        ...(view.cash ? [{ key: "CASH", label: "현금성 자산", value: view.cash, color: C.green }] : []),
      ];
    }
    const groupKey = pieMode === "섹터별" ? ("sector" as const) : ("country" as const);
    const colors = pieMode === "섹터별" ? SECTOR_COLOR : COUNTRY_COLOR;
    const map: Record<string, number> = {};
    view.rows.forEach((r) => {
      const g = r.stock[groupKey];
      map[g] = (map[g] || 0) + r.h.value;
    });
    if (view.cash) map["현금"] = (map["현금"] || 0) + view.cash;
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([g, v]) => ({ key: g, label: g, value: v, color: colors[g] || C.gray }));
  }, [view, pieMode]);

  const pieTotal = pieItems.reduce((s, it) => s + it.value, 0) || 1;

  const filteredTrades = useMemo(() => acctSel === "전체" ? allTrades : allTrades.filter((t) => t.acct === acctSel), [allTrades, acctSel]);

  const acctCards = acctSel === "전체" ? accounts : accounts.filter((a) => a.name === acctSel);
  const maxPct = acctCards.length ? Math.max(...acctCards.map((a) => Math.abs(a.pct)), 1) : 1;

  return (
    <>
      <main style={{ height: "100%", overflowY: "auto", padding: "20px 28px 40px", boxSizing: "border-box" }}>
        <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, letterSpacing: "-0.026em", marginBottom: 10 }}>
          자산배분{acctSel !== "전체" ? ` · ${acctSel}` : ""}
        </h1>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, alignItems: "start" }}>
          {/* 왼쪽: 자산 배분 */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>자산 배분</h2>
              <Segment compact items={["종목별", "섹터별", "국가별"]} value={pieMode} onChange={(m) => { setPieMode(m); setPieActive(null); }} />
            </div>
            <div style={{ background: C.card, borderRadius: 16, padding: 22, flex: 1, height: 385, boxSizing: "border-box", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 0 }}>
                <div style={{ position: "relative", width: 220, height: 220, flexShrink: 0, alignSelf: "flex-start" }}>
                  <Donut items={pieItems} active={pieActive} size={220}
                    onPick={(key) => setPieActive((p) => (p === key ? null : key))} />
                  <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", pointerEvents: "none" }}>
                    <div style={{ maxWidth: 100 }}>
                      <p style={{ margin: 0, fontSize: 10, color: C.sec, letterSpacing: "0.05em", lineHeight: 1.3 }}>
                        {pieActive ? pieItems.find((it) => it.key === pieActive)?.label : "MARKET VALUE"}
                      </p>
                      <p style={{ ...NUM, margin: "2px 0 0", fontSize: 15, fontWeight: 700 }}>
                        {pieActive ? fmtW(pieItems.find((it) => it.key === pieActive)?.value || 0) : fmtW(view.totalValue)}
                      </p>
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, overflowY: "auto" }}>
                  {pieItems.map((it, i) => (
                    <div key={it.key}
                      onClick={() => setPieActive((p) => (p === it.key ? null : it.key))}
                      style={{
                        display: "flex", alignItems: "center", gap: 10, padding: "7px 6px",
                        cursor: "pointer", borderTop: i ? `0.5px solid ${C.sep}` : "none",
                        opacity: pieActive && pieActive !== it.key ? 0.4 : 1, transition: "opacity .2s",
                      }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: it.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 14 }}>{it.label}</span>
                      <span style={{ ...NUM, fontSize: 14, fontWeight: 600 }}>
                        {((it.value / pieTotal) * 100).toFixed(2)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 오른쪽: 계좌별 성과 */}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h2 style={{ margin: "0 0 10px", fontSize: 22, fontWeight: 700 }}>계좌별 성과</h2>
            <div style={{ background: C.card, borderRadius: 16, padding: "8px 22px 10px", overflowY: "auto", boxSizing: "border-box", height: 385, maxHeight: 385 }}>
              {acctCards.length === 0 ? (
                <p style={{ padding: "20px 0", fontSize: 14, color: C.sec, textAlign: "center" }}>계좌 데이터가 없습니다.</p>
              ) : (
                acctCards.map((a, i) => <AcctBar key={a.name + acctSel} a={a} max={maxPct} delay={i * 80} />)
              )}
              <div style={{ height: 8 }} />
            </div>
          </div>

          {/* 전체 너비 버튼 */}
          <button onClick={() => setShowTrades(true)}
            style={{ gridColumn: "1 / -1", textAlign: "center", background: C.card, borderRadius: 10, padding: 13, fontSize: 17, color: C.blue, border: "none", cursor: "pointer", fontFamily: "inherit" }}>
            전체 거래 내역 보기 · {filteredTrades.length}건
          </button>
        </div>
      </main>

      {/* 슬라이드업 거래 내역 시트 */}
      <div onClick={() => setShowTrades(false)}
        style={{
          position: "absolute", inset: 0, background: "rgba(0,0,0,0.25)", zIndex: 90,
          opacity: showTrades ? 1 : 0, pointerEvents: showTrades ? "auto" : "none", transition: "opacity .3s",
        }} />
      <div
        style={{
          position: "absolute", left: 16, right: 16, bottom: 0, zIndex: 100,
          height: "min(680px, calc(100% - 90px))",
          background: C.card, borderRadius: "18px 18px 0 0",
          boxShadow: "0 -10px 50px rgba(0,0,0,0.22)",
          transform: showTrades ? "translateY(0)" : "translateY(105%)",
          transition: "transform .42s cubic-bezier(.32,.72,.25,1)",
          display: "flex", flexDirection: "column",
        }}>
        <div style={{ width: 40, height: 5, borderRadius: 3, background: "rgba(60,60,67,0.25)", margin: "8px auto 0" }} />
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 24px 10px" }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>전체 거래 내역{acctSel !== "전체" ? ` · ${acctSel}` : ""}</h2>
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <button onClick={() => setShowAddForm(true)}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 14px", borderRadius: 10, border: "none", background: C.blue, color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              <span style={{ fontSize: 16, lineHeight: 1 }}>+</span> 거래 추가
            </button>
            <button onClick={() => setShowTrades(false)}
              style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: C.fill, color: C.sec, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>✕</button>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "104px 1fr 110px 58px 64px 104px", gap: 8, padding: "9px 24px", background: C.fill }}>
          {["날짜", "종목", "계좌", "구분", "수량", "단가"].map((h) => (
            <span key={h} style={{ fontSize: 12, fontWeight: 600, color: C.sec, textAlign: h === "수량" || h === "단가" ? "right" : "left" }}>{h}</span>
          ))}
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 24px 20px" }}>
          {filteredTrades.map((t, i) => (
            <div key={i} onClick={() => (t.type === "매도" && t.profitLoss != null) ? setTradeTap(tradeTap === i ? null : i) : null}
              style={{ cursor: t.type === "매도" ? "pointer" : "default" }}>
              <div style={{ display: "grid", gridTemplateColumns: "104px 1fr 110px 58px 64px 104px", gap: 8, alignItems: "center", padding: "12px 0", borderTop: i ? `0.5px solid ${C.sep}` : "none" }}>
              <span style={{ ...NUM, fontSize: 14 }}>{t.date}</span>
              <span style={{ fontSize: 14, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.stockName}</span>
              <span style={{ fontSize: 14 }}>{t.acct}</span>
              <span style={{ fontSize: 12, fontWeight: 600, textAlign: "center", padding: "2px 0", borderRadius: 5, color: t.type === "매수" ? C.red : t.type === "매도" ? C.blue : t.type === "입금" ? C.green : C.sec, background: t.type === "매수" ? "rgba(255,59,48,0.10)" : t.type === "매도" ? "rgba(0,122,255,0.10)" : t.type === "입금" ? "rgba(52,199,89,0.10)" : "rgba(142,142,147,0.10)" }}>{t.type}</span>
              <span style={{ ...NUM, fontSize: 14, textAlign: "right" }}>{t.qty}주</span>
              <span style={{ ...NUM, fontSize: 14, textAlign: "right" }}>{t.unit}</span>
              </div>
              {tradeTap === i && t.profitLoss != null && (
                <div style={{ display: "flex", gap: 16, padding: "8px 14px 10px", background: C.fill, borderRadius: 8, margin: "4px 0 2px", alignItems: "center" }}>
                  <span style={{ fontSize: 12, color: C.sec }}>매도 손익</span>
                  <span style={{ ...NUM, fontSize: 14, fontWeight: 700, color: (t.profitLoss ?? 0) >= 0 ? C.red : C.blue }}>
                    {(t.profitLoss ?? 0) >= 0 ? "+" : ""}{"₩"}{Math.round(Math.abs(t.profitLoss ?? 0)).toLocaleString("ko-KR")}
                  </span>
                  {t.profitRate != null && (
                    <span style={{ ...NUM, fontSize: 13, fontWeight: 600, color: (t.profitRate ?? 0) >= 0 ? C.red : C.blue }}>
                      ({(t.profitRate ?? 0) >= 0 ? "+" : ""}{(t.profitRate ?? 0).toFixed(2)}%)
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {filteredTrades.length === 0 && <p style={{ padding: "18px 0", fontSize: 15, color: C.sec }}>거래 내역이 없습니다.</p>}
        </div>
      </div>

      {/* 거래 추가 모달 */}
      {showAddForm && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
          onClick={(e) => { if (e.target === e.currentTarget) { setShowAddForm(false); setForm(INIT_FORM()); setSaveErr(''); } }}>
          <div style={{ background: C.card, borderRadius: 18, width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <div style={{ padding: "22px 24px 18px", borderBottom: `1px solid ${C.sep}` }}>
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>거래 추가</h2>
            </div>
            <div style={{ padding: "20px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px 20px" }}>
              <div>
                <label style={LBL}>날짜</label>
                <input type="date" value={form.trade_date} onChange={e => setF('trade_date', e.target.value)} style={INP} />
              </div>
              <div>
                <label style={LBL}>계좌</label>
                <select value={form.account} onChange={e => setF('account', e.target.value)} style={INP}>
                  {ACCOUNTS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label style={LBL}>티커</label>
                <input type="text" placeholder="예: AAPL" value={form.ticker} onChange={e => setF('ticker', e.target.value)} style={INP} />
              </div>
              <div>
                <label style={LBL}>종목명</label>
                <input type="text" placeholder="예: 애플" value={form.stock_name} onChange={e => setF('stock_name', e.target.value)} style={INP} />
              </div>
              <div>
                <label style={LBL}>섹터</label>
                <input type="text" placeholder="예: IT" value={form.sector} onChange={e => setF('sector', e.target.value)} style={INP} />
              </div>
              <div>
                <label style={LBL}>매수/매도</label>
                <select value={form.trade_type} onChange={e => setF('trade_type', e.target.value)} style={INP}>
                  <option value="">-</option>
                  <option value="매수">매수</option>
                  <option value="매도">매도</option>
                </select>
              </div>
              <div>
                <label style={LBL}>수량</label>
                <input type="number" placeholder="0" value={form.quantity} onChange={e => setF('quantity', e.target.value)} style={INP} />
              </div>
              <div>
                <label style={LBL}>매수단가</label>
                <input type="number" placeholder="0" value={form.buy_price} onChange={e => setF('buy_price', e.target.value)} style={INP} />
              </div>
              <div>
                <label style={LBL}>매도단가</label>
                <input type="number" placeholder="0" value={form.sell_price} onChange={e => setF('sell_price', e.target.value)} style={INP} />
              </div>
              <div>
                <label style={LBL}>입출금</label>
                <select value={form.account_transfer} onChange={e => setF('account_transfer', e.target.value)} style={INP}>
                  <option value="">-</option>
                  <option value="입금">입금</option>
                  <option value="출금">출금</option>
                </select>
              </div>
              <div>
                <label style={LBL}>입출금 금액</label>
                <input type="number" placeholder="0" value={form.transfer_amount} onChange={e => setF('transfer_amount', e.target.value)} style={INP} />
              </div>
              <div>
                <label style={LBL}>통화</label>
                <select value={form.currency} onChange={e => setF('currency', e.target.value)} style={INP}>
                  <option value="KRW">KRW</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={LBL}>메모</label>
                <input type="text" placeholder="메모 (선택)" value={form.memo} onChange={e => setF('memo', e.target.value)} style={INP} />
              </div>
            </div>
            {saveErr && (
              <div style={{ margin: "0 24px", padding: "10px 14px", background: "rgba(255,59,48,0.10)", borderRadius: 8, color: C.red, fontSize: 13, fontWeight: 600 }}>{saveErr}</div>
            )}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", padding: "16px 24px 22px" }}>
              <button onClick={() => { setShowAddForm(false); setForm(INIT_FORM()); setSaveErr(''); }}
                style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: C.fill, color: C.label, fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
                취소
              </button>
              <button onClick={handleSave} disabled={saving}
                style={{ padding: "10px 22px", borderRadius: 10, border: "none", background: C.blue, color: "#fff", fontSize: 15, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1, fontFamily: "inherit" }}>
                {saving ? "저장 중…" : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}