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

// 제목 비교용 정규화 (공백/특수문자 제거 후 소문자화)
function normalizeTitle(title: string): string {
  return title.replace(/\s+/g, "").replace(/[\[\]()【】<>…·,."'“”‘’|\-–—]/g, "").toLowerCase();
}

// 동일 기사(언론사별 재배포 포함) 중복 제거 — link 또는 정규화된 제목 기준
export function dedupeNews(items: NewsItem[]): NewsItem[] {
  const seenLinks = new Set<string>();
  const seenTitles = new Set<string>();
  const result: NewsItem[] = [];

  for (const item of items) {
    const normTitle = normalizeTitle(item.title);
    if ((item.link && seenLinks.has(item.link)) || seenTitles.has(normTitle)) continue;
    if (item.link) seenLinks.add(item.link);
    seenTitles.add(normTitle);
    result.push(item);
  }

  return result;
}

// ===== 뉴스 선별 규칙 (강제 적용) =====

// 화이트리스트 매체: 이 매체의 기사는 항상 통과
export const WHITELIST_SOURCES = new Set([
  "연합뉴스", "매일경제", "한국경제", "머니투데이", "이데일리",
  "서울경제", "조선일보", "중앙일보", "동아일보", "뉴스1",
]);

// 광고/스팸성 키워드 — 제목/본문에 포함되면 즉시 제거
const SPAM_KEYWORDS = [
  "무료체험", "주식리딩", "단독상담", "수익보장", "급등주", "추천주", "광고", "제공",
];

// 거시 경제 지표 · 국가적 주요 이슈 키워드 — 화이트리스트 외 매체는 이 키워드가 있어야 통과
const MACRO_KEYWORDS = [
  "금리", "기준금리", "환율", "물가", "인플레이션", "한국은행", "연준", "Fed", "FOMC",
  "정부", "정책", "세법", "추경", "예산", "GDP", "경제성장률", "수출", "무역", "관세",
  "코스피", "코스닥", "증시",
];

// 강제 필터: 화이트리스트 매체 + 스팸 키워드 제거 + (비화이트리스트는 거시경제/국가 이슈만)
export function passesNewsFilter(item: NewsItem): boolean {
  const text = `${item.title} ${item.description}`;
  if (SPAM_KEYWORDS.some((kw) => text.includes(kw))) return false;
  if (WHITELIST_SOURCES.has(item.source)) return true;
  return MACRO_KEYWORDS.some((kw) => text.includes(kw));
}
