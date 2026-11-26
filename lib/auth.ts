// =============================================================
// 간단한 비밀번호 로그인 (본인 1명용)
//
// - 환경변수 APP_PASSWORD 가 설정되어 있으면 로그인을 요구한다.
//   설정되어 있지 않으면 기존처럼 누구나 접근할 수 있다 (배포 직후 잠기지 않도록).
// - 로그인하면 APP_PASSWORD 로 서명한 쿠키를 발급한다.
//   비밀번호를 바꾸면 기존 로그인은 모두 풀린다.
// - 서버 간 호출(cron 등)은 Authorization: Bearer $CRON_SECRET 으로 통과한다.
// =============================================================

export const SESSION_COOKIE = "glow_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30일

const SESSION_PAYLOAD = "glow-session-v1";

async function hmac(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// 길이가 달라도 시간 차이로 정보가 새지 않도록 비교
function safeEqual(a: string, b: string): boolean {
  let diff = a.length ^ b.length;
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

export function authEnabled(): boolean {
  return !!process.env.APP_PASSWORD;
}

export async function createSessionToken(): Promise<string> {
  return hmac(process.env.APP_PASSWORD!, SESSION_PAYLOAD);
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token || !authEnabled()) return false;
  return safeEqual(token, await createSessionToken());
}

export async function checkPassword(input: string): Promise<boolean> {
  const pw = process.env.APP_PASSWORD;
  if (!pw) return false;
  // 같은 키로 둘 다 HMAC 해서 고정 길이로 비교
  return safeEqual(await hmac(pw, input), await hmac(pw, pw));
}

export function isCronRequest(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  return !!secret && !!authHeader && safeEqual(authHeader, `Bearer ${secret}`);
}

// 서버 내부에서 다른 API를 호출할 때 붙이는 헤더
export function internalAuthHeaders(): Record<string, string> {
  const secret = process.env.CRON_SECRET;
  return secret ? { Authorization: `Bearer ${secret}` } : {};
}
