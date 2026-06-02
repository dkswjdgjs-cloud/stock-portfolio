import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stockName, ticker, market } = body;

    const isKR = market === 'KR';
    const prompt = isKR
      ? `${stockName}(${ticker}) 관련 최신 뉴스를 Google Search로 검색해서 최근 7일 이내 뉴스 위주로 10개 이내로 정리해주세요. 각 뉴스는 다음 형식으로 작성해주세요:\n\n[날짜] 제목\n출처: 언론사명\n내용: 1~2줄 요약\n\n최신 순서로 정렬해주세요. 한국어로 작성해주세요.`
      : `Search for the latest news about ${stockName}(${ticker}) from the past 7 days. List up to 10 news items in the following format:\n\n[Date] Title\nSource: Media outlet\nSummary: 1-2 sentence summary\n\nSort by most recent first. Write in Korean.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ google_search: {} }],
          generationConfig: { temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('Gemini API error:', data);
      return NextResponse.json({ error: 'Gemini API 오류' }, { status: 500 });
    }

    const text = data.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.text)
      ?.map((p: any) => p.text)
      ?.join('') || '분석 결과를 가져올 수 없습니다.';

    return NextResponse.json({ news: text });
  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json({ error: '분석 중 오류가 발생했습니다' }, { status: 500 });
  }
}
