import { NextRequest, NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY!;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { stockName, ticker, market, info, holding } = body;

    const prompt = `당신은 주식 투자 전문 애널리스트입니다. 아래 종목에 대해 실시간 최신 정보를 검색하여 상세한 투자 분석을 해주세요.

## 분석 대상
- 종목명: ${stockName}
- 티커: ${ticker}
- 시장: ${market === 'KR' ? '국내(한국)' : '해외'}

## 보유 현황
- 보유 수량: ${holding?.quantity || 0}주
- 평균 매수단가: ${holding?.avg_price || 0}원
- 현재가: ${holding?.curr_price || 0}원
- 평가 손익률: ${holding?.return_rate?.toFixed(2) || 0}%

## 재무지표
- 시가총액: ${info?.mktCap || '-'}
- PER: ${info?.per || '-'}
- PBR: ${info?.pbr || '-'}
- EPS: ${info?.eps || '-'}
- ROE: ${info?.roe || '-'}
- 부채비율: ${info?.debtRate || '-'}
- 매출 성장률: ${info?.salesGrowth || '-'}

## 분석 요청
Google Search를 통해 최신 정보를 검색한 후 다음 4가지 섹션으로 분석해주세요. 반드시 한국어로 작성하세요.

1. **밸류에이션 분석** (현재 주가의 저평가/고평가 여부, 동종업계 비교)
2. **업황 및 최신 동향** (최근 뉴스, 실적, 업황 흐름)
3. **리스크 요인** (단기/중장기 위험 요소)
4. **기회 요인** (성장 동력, 긍정적 요소)
5. **종합 의견** (매수/중립/매도 의견과 근거, 내 보유 관점에서의 조언)

각 섹션은 구체적인 수치와 근거를 포함해서 작성해주세요.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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

    return NextResponse.json({ analysis: text });
  } catch (error) {
    console.error('AI analyze error:', error);
    return NextResponse.json({ error: '분석 중 오류가 발생했습니다' }, { status: 500 });
  }
}
