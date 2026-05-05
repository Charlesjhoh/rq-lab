import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const {
      wpm,
      accuracy,
      comprehension,
      finalAR
    } = await req.json();

    const prompt = `
다음 학생의 읽기 데이터를 기반으로
전문가 상담용 분석 리포트를 작성하십시오.

[데이터]
WPM: ${wpm}
정확도: ${accuracy}%
이해도: ${comprehension}점
최종 AR: ${finalAR}

다음 구조로 작성하십시오:

1. 현재 읽기 상태 분석
2. 문제 원인 진단
3. 향후 학습 리스크
4. 구체적 훈련 처방

전문가 상담용 톤으로 작성하고,
학부모에게 신뢰를 줄 수 있는 문장으로 작성하십시오.
`;

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0.4,
          messages: [
            { role: "system", content: "You are a reading assessment expert." },
            { role: "user", content: prompt },
          ],
        }),
      }
    );

    const data = await response.json();

    const content = data.choices?.[0]?.message?.content ?? "";

    return NextResponse.json({ report: content });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}