// =============================================================
// 네이버 뉴스 검색 API 관련 공통 타입 + 유틸
// /app/api/news/route.ts (서버) 와 lib/useStockNews.ts (클라이언트) 에서 공유
// =============================================================

export interface NewsItem {
  title: string;
  description: string;
  link: string;
  source: string;
  timeAgo: string;
}

// 네이버 검색 결과의 title/description에는 <b> 태그와 HTML 엔티티가 섞여있음
export function stripHtml(s: string): string {
  return s
    .replace(/<\/?b>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

// 주요 언론사 도메인 → 한글 표기 (없으면 도메인 그대로 표시)
const SOURCE_MAP: Record<string, string> = {
  "yna.co.kr": "연합뉴스",
  "yonhapnewstv.co.kr": "연합뉴스TV",
  "hankyung.com": "한국경제",
  "mk.co.kr": "매일경제",
  "edaily.co.kr": "이데일리",
  "news1.kr": "뉴스1",
  "newsis.com": "뉴시스",
  "fnnews.com": "파이낸셜뉴스",
  "sedaily.com": "서울경제",
  "biz.chosun.com": "조선비즈",
  "chosun.com": "조선일보",
  "donga.com": "동아일보",
  "joongang.co.kr": "중앙일보",
  "hani.co.kr": "한겨레",
  "seoul.co.kr": "서울신문",
  "mt.co.kr": "머니투데이",
  "asiae.co.kr": "아시아경제",
  "heraldcorp.com": "헤럴드경제",
  "etnews.com": "전자신문",
  "zdnet.co.kr": "지디넷코리아",
  "ddaily.co.kr": "디지털데일리",
};

export function sourceFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "").replace(/^biz\.m\./, "biz.").replace(/^m\./, "");
    for (const [domain, name] of Object.entries(SOURCE_MAP)) {
      if (host === domain || host.endsWith(`.${domain}`)) return name;
    }
    return host;
  } catch {
    return "";
  }
}

// RFC822 pubDate → "n분 전" / "n시간 전" / "n일 전" 등
export function timeAgo(pubDate: string): string {
  const d = new Date(pubDate);
  if (isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  if (diffMs < 0) return "방금 전";

  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}일 전`;

  const week = Math.floor(day / 7);
  if (week < 5) return `${week}주 전`;

  const month = Math.floor(day / 30);
  return `${month}개월 전`;
}
