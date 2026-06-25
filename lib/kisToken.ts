import { Redis } from '@upstash/redis';

const KIS_APP_KEY = process.env.KIS_APP_KEY!;
const KIS_APP_SECRET = process.env.KIS_APP_SECRET!;
const KIS_BASE_URL = 'https://openapi.koreainvestment.com:9443';
const TOKEN_KEY = 'kis_token';

const redis = new Redis({
  url: process.env.KV_REST_API_URL!,
  token: process.env.KV_REST_API_TOKEN!,
});

// 모든 KIS API 라우트가 이 함수 하나만 씁니다.
// Redis에 토큰이 있으면 재사용, 없을 때만 발급합니다.
// 여러 요청이 동시에 들어와도 Redis SET NX로 중복 발급을 방지합니다.
export async function getKisToken(): Promise<string> {
  const cached = await redis.get<string>(TOKEN_KEY);
  if (cached) return cached;

  // 중복 발급 방지: 락 키가 이미 있으면 잠시 대기 후 재시도
  const lockKey = 'kis_token_lock';
  const locked = await redis.set(lockKey, '1', { nx: true, ex: 10 });
  if (!locked) {
    // 다른 요청이 발급 중 — 최대 3초 대기
    for (let i = 0; i < 6; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const retried = await redis.get<string>(TOKEN_KEY);
      if (retried) return retried;
    }
  }

  try {
    const res = await fetch(`${KIS_BASE_URL}/oauth2/tokenP`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ grant_type: 'client_credentials', appkey: KIS_APP_KEY, appsecret: KIS_APP_SECRET }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error(`KIS 토큰 발급 실패: ${JSON.stringify(data).slice(0, 200)}`);

    const token = data.access_token as string;
    const ttl = (data.expires_in || 86400) - 300; // 만료 5분 전 갱신
    await redis.set(TOKEN_KEY, token, { ex: ttl });
    return token;
  } finally {
    await redis.del(lockKey);
  }
}

export const KIS_BASE = KIS_BASE_URL;
export const KIS_KEY = KIS_APP_KEY;
export const KIS_SECRET = KIS_APP_SECRET;
