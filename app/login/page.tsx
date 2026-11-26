"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";

function LoginForm() {
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const next = params.get("next") || "/Desktop";
        // 외부 주소로 튕기지 않도록 내부 경로만 허용
        window.location.href = next.startsWith("/") && !next.startsWith("//") ? next : "/Desktop";
        return;
      }
      const d = await res.json().catch(() => ({}));
      setError(d.error || "로그인에 실패했습니다");
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={{ width: "100%", maxWidth: 320, display: "flex", flexDirection: "column", gap: 12 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, textAlign: "center" }}>GLOW</h1>
      <input
        type="password"
        autoFocus
        autoComplete="current-password"
        placeholder="비밀번호"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        style={{ padding: "12px 14px", fontSize: 16, borderRadius: 10, border: "1px solid #C7C7CC", background: "inherit", color: "inherit" }}
      />
      <button
        type="submit"
        disabled={busy || !password}
        style={{ padding: "12px 14px", fontSize: 16, fontWeight: 600, borderRadius: 10, border: "none", background: "#007AFF", color: "#fff", opacity: busy || !password ? 0.5 : 1 }}
      >
        {busy ? "확인 중..." : "로그인"}
      </button>
      {error && <p style={{ color: "#FF3B30", fontSize: 14, margin: 0, textAlign: "center" }}>{error}</p>}
    </form>
  );
}

export default function LoginPage() {
  return (
    <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 16, background: "#F2F2F7", color: "#1C1C1E" }}>
      <Suspense>
        <LoginForm />
      </Suspense>
    </main>
  );
}
