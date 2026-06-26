"use client";
import { useEffect, useRef, useState } from "react";
import { C, NUM, FONT } from "@/lib/glow-theme";
import { EARNINGS, INDUSTRY_ROWS, REPORT_DATE, LAST_UPDATED } from "@/lib/daily-report/constants";

// ===== 타입 =====
interface InvestorFlowRow {
  trade_date: string;
  individual: number;
  foreign_inv: number;
  institution: number;
  pension: number;
  kospi_change: number;
}

// ===== 유틸 =====
function surprise(consensus: number | null, actual: number | null): number | null {
  if (consensus == null || actual == null || consensus === 0) return null;
  return ((actual - consensus) / Math.abs(consensus)) * 100;
}

function fmtAmt(n: number | null, unit = ""): string {
  if (n == null) return "-";
  return `${n.toFixed(1)}${unit}`;
}

function fmtSurprise(pct: number | null): string {
  if (pct == null) return "대기";
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function fmtFlow(n: number): string {
  const abs = Math.abs(n);
  const sign = n >= 0 ? "+" : "-";
  if (abs >= 10000) return `${sign}${(abs / 10000).toFixed(1)}조`;
  return `${sign}${abs.toLocaleString("ko-KR")}억`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  return `${mm}/${dd}(${dayNames[d.getDay()]})`;
}

// ===== 신호 판단 =====
function earningsSignal(label: "삼성전자" | "SK하이닉스"): "🟢" | "🟡" | "🔴" {
  const d = label === "삼성전자" ? EARNINGS.samsung : EARNINGS.hynix;
  // 가장 최근 발표된 분기 서프라이즈 사용
  const quarters = [
    surprise(d.q1_2026_consensus, d.q1_2026_actual),
    surprise(d.q4_2025_consensus, d.q4_2025_actual),
    surprise(d.q3_2025_consensus, d.q3_2025_actual),
  ];
  const latest = quarters.find((q) => q != null) ?? null;
  if (latest == null) return "🟡";
  if (latest >= 10) return "🟢";
  if (latest >= 0) return "🟡";
  return "🔴";
}

function industrySignal(): "🟢" | "🟡" | "🔴" {
  const dram = INDUSTRY_ROWS.find((r) => r.label.startsWith("DRAM"));
  const guidance = INDUSTRY_ROWS.find((r) => r.label.startsWith("마이크론 가이던스"));
  const dramUp = dram?.direction === "up";
  const guideUp = guidance?.direction === "up";
  if (dramUp && guideUp) return "🟢";
  if (!dramUp && !guideUp) return "🔴";
  return "🟡";
}

function flowSignal(rows: InvestorFlowRow[]): "🟢" | "🟡" | "🔴" {
  if (!rows.length) return "🟡";
  const sum = rows.slice(0, 5).reduce((s, r) => s + r.foreign_inv, 0);
  const sumWon = sum * 100000000; // 억원 → 원
  if (sum > 0) return "🟢";
  if (sumWon > -1_000_000_000_000) return "🟡"; // -1조 이상
  return "🔴";
}

function overallSignal(a: "🟢" | "🟡" | "🔴", b: "🟢" | "🟡" | "🔴", c: "🟢" | "🟡" | "🔴") {
  const score = [a, b, c].reduce((s, x) => s + (x === "🟢" ? 2 : x === "🟡" ? 1 : 0), 0);
  const label = score >= 5 ? "매수" : score >= 3 ? "관망" : "주의";
  const icon = score >= 5 ? "🟢" : score >= 3 ? "🟡" : "🔴";
  return { icon, label, score };
}

// ===== 스타일 헬퍼 =====
const tdBase: React.CSSProperties = { padding: "9px 12px", fontSize: 13, borderBottom: `0.5px solid ${C.sep}`, whiteSpace: "nowrap" };
const thBase: React.CSSProperties = { ...tdBase, fontWeight: 700, color: C.sec, background: C.fill, textAlign: "left" };
const numTd = (val: number | null, unit?: string): React.CSSProperties => ({
  ...tdBase, ...NUM, textAlign: "right",
  color: val == null ? C.ter : val > 0 ? "var(--glow-red)" : val < 0 ? "var(--glow-blue)" : C.label,
});

function SurpriseCell({ pct }: { pct: number | null }) {
  const txt = fmtSurprise(pct);
  const col = pct == null ? "#F5A623" : pct >= 0 ? "var(--glow-red)" : "var(--glow-blue)";
  return (
    <td style={{ ...tdBase, ...NUM, textAlign: "right" }}>
      <span style={{ color: "#fff", background: col, borderRadius: 6, padding: "2px 7px", fontSize: 12, fontWeight: 700 }}>{txt}</span>
    </td>
  );
}

// ===== 섹션 래퍼 =====
function Section({ title, signal, children }: { title: string; signal: "🟢" | "🟡" | "🔴"; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 28 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 18 }}>{signal}</span>
        <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>{title}</h2>
      </div>
      <div style={{ background: C.card, borderRadius: 12, overflow: "hidden" }}>
        {children}
      </div>
    </div>
  );
}

// ===== 수급 막대차트 (Canvas) =====
function FlowBarChart({ rows }: { rows: InvestorFlowRow[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labels = ["개인", "외국인", "기관", "연기금"];
  const colors = ["#007AFF", "#5856D6", "#FF9500", "#30B0C7"];
  const sorted = [...rows].reverse();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !sorted.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    const padL = 54, padR = 16, padT = 20, padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    ctx.clearRect(0, 0, W, H);

    const series = [
      sorted.map((r) => r.individual),
      sorted.map((r) => r.foreign_inv),
      sorted.map((r) => r.institution),
      sorted.map((r) => r.pension),
    ];
    const allVals = series.flat();
    const maxAbs = Math.max(...allVals.map(Math.abs), 1);

    const groupW = chartW / sorted.length;
    const barW = Math.min(groupW * 0.18, 12);

    const yZero = padT + chartH / 2;
    ctx.strokeStyle = "rgba(120,120,128,0.2)";
    ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(padL, yZero); ctx.lineTo(W - padR, yZero); ctx.stroke();

    // 날짜 라벨
    ctx.fillStyle = "rgba(60,60,67,0.5)";
    ctx.font = `10px ${FONT}`;
    ctx.textAlign = "center";
    sorted.forEach((r, i) => {
      const x = padL + groupW * (i + 0.5);
      ctx.fillText(fmtDate(r.trade_date), x, H - 6);
    });

    // 막대
    series.forEach((vals, si) => {
      vals.forEach((v, i) => {
        const x = padL + groupW * (i + 0.5) + (si - 1.5) * (barW + 1);
        const h = Math.abs(v) / maxAbs * (chartH / 2) * 0.85;
        const y = v >= 0 ? yZero - h : yZero;
        ctx.fillStyle = colors[si];
        ctx.beginPath();
        ctx.roundRect(x - barW / 2, y, barW, h || 1, 2);
        ctx.fill();
      });
    });

    // y축 레이블
    ctx.fillStyle = "rgba(60,60,67,0.5)";
    ctx.font = `9px ${FONT}`;
    ctx.textAlign = "right";
    [1, 0.5, -0.5, -1].forEach((frac) => {
      const val = Math.round(maxAbs * frac);
      const y = yZero - (chartH / 2) * frac;
      if (frac !== 0) {
        ctx.fillText(`${val > 0 ? "+" : ""}${val}억`, padL - 4, y + 3);
      }
    });
  }, [rows]);

  return (
    <div>
      <div style={{ display: "flex", gap: 14, padding: "14px 16px 4px", flexWrap: "wrap" }}>
        {labels.map((l, i) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12 }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: colors[i] }} />
            <span style={{ color: C.sec }}>{l}</span>
          </div>
        ))}
      </div>
      <canvas ref={canvasRef} width={700} height={200} style={{ width: "100%", height: 200, display: "block" }} />
    </div>
  );
}

// ===== 메인 컴포넌트 =====
export default function DailyReportPage() {
  const [flowRows, setFlowRows] = useState<InvestorFlowRow[]>([]);
  const [loadingFlow, setLoadingFlow] = useState(true);

  useEffect(() => {
    fetch("/api/investor-flow")
      .then((r) => r.json())
      .then((d) => { setFlowRows(Array.isArray(d) ? d : []); })
      .catch(() => {})
      .finally(() => setLoadingFlow(false));
  }, []);

  const sigEarnings = earningsSignal("삼성전자") === "🟢" && earningsSignal("SK하이닉스") === "🟢" ? "🟢"
    : earningsSignal("삼성전자") === "🔴" && earningsSignal("SK하이닉스") === "🔴" ? "🔴" : "🟡";
  const sigIndustry = industrySignal();
  const sigFlow = flowSignal(flowRows);
  const overall = overallSignal(sigEarnings, sigIndustry, sigFlow);

  const lastUpdated = new Date(LAST_UPDATED).toLocaleString("ko-KR", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // ① 실적 표 데이터
  const QUARTERS = [
    { key: "q3_2025", label: "3Q 2025" },
    { key: "q4_2025", label: "4Q 2025" },
    { key: "q1_2026", label: "1Q 2026" },
    { key: "q2_2026", label: "2Q 2026(예정)" },
  ] as const;

  const earningsTableRows = (
    company: typeof EARNINGS.samsung | typeof EARNINGS.hynix
  ) => [
    {
      label: "컨센서스 영업이익",
      cells: QUARTERS.map((q) => ({ val: (company as any)[`${q.key}_consensus`] as number | null, isSurprise: false })),
    },
    {
      label: "실제 영업이익",
      cells: QUARTERS.map((q) => ({ val: (company as any)[`${q.key}_actual`] as number | null, isSurprise: false })),
    },
    {
      label: "서프라이즈",
      cells: QUARTERS.map((q) => ({
        val: surprise((company as any)[`${q.key}_consensus`], (company as any)[`${q.key}_actual`]),
        isSurprise: true,
      })),
    },
  ];

  // ③ 수급 합계
  const flowSum = {
    individual: flowRows.reduce((s, r) => s + r.individual, 0),
    foreign_inv: flowRows.reduce((s, r) => s + r.foreign_inv, 0),
    institution: flowRows.reduce((s, r) => s + r.institution, 0),
    pension: flowRows.reduce((s, r) => s + r.pension, 0),
  };

  const flowCards = [
    { label: "개인", val: flowSum.individual, color: "#007AFF" },
    { label: "외국인", val: flowSum.foreign_inv, color: "#5856D6" },
    { label: "기관계", val: flowSum.institution, color: "#FF9500" },
  ];

  return (
    <main style={{ height: "100%", overflowY: "auto", padding: "20px 28px 60px", boxSizing: "border-box" }}>
      {/* 종합 신호등 카드 */}
      <div style={{ background: C.card, borderRadius: 16, padding: "20px 24px", marginBottom: 28 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: C.sec, fontWeight: 600 }}>📊 반도체 투자 건강지수</p>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: C.ter }}>{REPORT_DATE} 기준</p>
          </div>
          <p style={{ margin: 0, fontSize: 12, color: C.ter }}>마지막 업데이트: {lastUpdated}</p>
        </div>

        <div style={{ display: "flex", gap: 24, margin: "16px 0 12px", flexWrap: "wrap" }}>
          {[
            { label: "실적", sig: sigEarnings },
            { label: "업황", sig: sigIndustry },
            { label: "수급", sig: sigFlow },
          ].map(({ label, sig }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 22 }}>{sig}</span>
              <span style={{ fontSize: 15, fontWeight: 600, color: C.label }}>{label}</span>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 26 }}>{overall.icon}</span>
          <span style={{ fontSize: 20, fontWeight: 700, color: C.label }}>종합: {overall.label}</span>
          <span style={{ fontSize: 13, color: C.sec }}>({overall.score}/6)</span>
        </div>
      </div>

      {/* ① 실적지표 */}
      <Section title="실적지표" signal={sigEarnings}>
        {[EARNINGS.samsung, EARNINGS.hynix].map((company) => (
          <div key={company.label}>
            <div style={{ padding: "10px 16px 6px", fontSize: 14, fontWeight: 700, color: C.label, borderBottom: `0.5px solid ${C.sep}` }}>
              {company.label} {earningsSignal(company.label as "삼성전자" | "SK하이닉스")}
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 500 }}>
                <thead>
                  <tr>
                    <th style={{ ...thBase, width: 160 }}>구분</th>
                    {QUARTERS.map((q) => <th key={q.key} style={{ ...thBase, textAlign: "right" }}>{q.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {earningsTableRows(company).map((row) => (
                    <tr key={row.label}>
                      <td style={{ ...tdBase, color: C.sec, fontWeight: 600 }}>{row.label}</td>
                      {row.cells.map((cell, ci) =>
                        row.label === "서프라이즈"
                          ? <SurpriseCell key={ci} pct={cell.val} />
                          : <td key={ci} style={{ ...tdBase, ...NUM, textAlign: "right", color: cell.val == null ? C.ter : C.label }}>
                              {cell.val == null ? "-" : `${cell.val.toFixed(1)}조`}
                            </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </Section>

      {/* ② 업황 선행지표 */}
      <Section title="업황 선행지표" signal={sigIndustry}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 480 }}>
            <thead>
              <tr>
                <th style={{ ...thBase, width: 200 }}>항목</th>
                <th style={{ ...thBase, textAlign: "right" }}>4월</th>
                <th style={{ ...thBase, textAlign: "right" }}>5월</th>
                <th style={{ ...thBase, textAlign: "right" }}>6월(최신)</th>
                <th style={{ ...thBase, textAlign: "center", width: 50 }}>방향</th>
              </tr>
            </thead>
            <tbody>
              {INDUSTRY_ROWS.map((row) => (
                <tr key={row.label}>
                  <td style={{ ...tdBase, fontWeight: 600 }}>{row.label}</td>
                  {[row.apr, row.may, row.jun].map((val, i) => (
                    <td key={i} style={{ ...tdBase, ...NUM, textAlign: "right", color: val == null ? C.ter : C.label }}>
                      {val == null ? "-" : typeof val === "number" ? `${val}${row.unit}` : val}
                    </td>
                  ))}
                  <td style={{ ...tdBase, textAlign: "center", fontSize: 16 }}>
                    {row.direction === "up"
                      ? <span style={{ color: "var(--glow-red)" }}>↑</span>
                      : row.direction === "down"
                      ? <span style={{ color: "var(--glow-blue)" }}>↓</span>
                      : <span style={{ color: C.ter }}>→</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ③ 수급지표 */}
      <Section title="수급지표" signal={sigFlow}>
        {/* 요약 카드 3개 */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 0, borderBottom: `0.5px solid ${C.sep}` }}>
          {flowCards.map((fc, i) => (
            <div key={fc.label} style={{ padding: "14px 16px", borderRight: i < 2 ? `0.5px solid ${C.sep}` : "none" }}>
              <p style={{ margin: 0, fontSize: 12, color: C.sec, fontWeight: 600 }}>{fc.label} 1주 누적</p>
              <p style={{ ...NUM, margin: "4px 0 0", fontSize: 18, fontWeight: 700, color: fc.val >= 0 ? "var(--glow-red)" : "var(--glow-blue)" }}>
                {fmtFlow(fc.val)}
              </p>
            </div>
          ))}
        </div>

        {/* 일별 표 */}
        {loadingFlow ? (
          <div style={{ padding: 24, textAlign: "center", color: C.ter, fontSize: 14 }}>수급 데이터 불러오는 중…</div>
        ) : flowRows.length === 0 ? (
          <div style={{ padding: 24, textAlign: "center", color: C.ter, fontSize: 14 }}>
            아직 수급 데이터가 없습니다.<br />
            <span style={{ fontSize: 12 }}>Oracle Cloud 크론잡 설정 후 자동 수집됩니다.</span>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 560 }}>
                <thead>
                  <tr>
                    {["일자", "개인", "외국인", "기관계", "연기금", "코스피"].map((h) => (
                      <th key={h} style={{ ...thBase, textAlign: h === "일자" ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {flowRows.map((r) => (
                    <tr key={r.trade_date}>
                      <td style={{ ...tdBase, color: C.sec }}>{fmtDate(r.trade_date)}</td>
                      {[r.individual, r.foreign_inv, r.institution, r.pension].map((v, i) => (
                        <td key={i} style={numTd(v)}>
                          {fmtFlow(v)}
                        </td>
                      ))}
                      <td style={{ ...tdBase, ...NUM, textAlign: "right", color: r.kospi_change >= 0 ? "var(--glow-red)" : "var(--glow-blue)" }}>
                        {r.kospi_change >= 0 ? "+" : ""}{r.kospi_change.toFixed(2)}%
                      </td>
                    </tr>
                  ))}
                  {/* 합계 행 */}
                  <tr style={{ background: C.fill }}>
                    <td style={{ ...tdBase, fontWeight: 700 }}>1주 누적</td>
                    {[flowSum.individual, flowSum.foreign_inv, flowSum.institution, flowSum.pension].map((v, i) => (
                      <td key={i} style={{ ...numTd(v), fontWeight: 700 }}>
                        {fmtFlow(v)}
                      </td>
                    ))}
                    <td style={{ ...tdBase }} />
                  </tr>
                </tbody>
              </table>
            </div>
            <FlowBarChart rows={flowRows} />
          </>
        )}
      </Section>
    </main>
  );
}
