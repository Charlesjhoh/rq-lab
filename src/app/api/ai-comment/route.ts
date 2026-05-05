import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { wrongWords, referenceText, recognizedText } = await req.json();

    const prompt = `
학생이 영어 문장을 읽었습니다.

원문:
${referenceText}

학생 발화:
${recognizedText}

틀린 단어:
${wrongWords.map((w: any) => `${w.original} → ${w.spoken}`).join(", ")}

위 정보를 바탕으로 부모에게 보여줄 간단한 피드백을 작성하세요.

조건:
- 한국어로 작성
- 2~3줄
- 발음 문제를 구체적으로 설명
- 과장하지 말고 객관적으로
`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
      }),
    });

    const data = await res.json();
    const comment = data.choices?.[0]?.message?.content || "";

    return NextResponse.json({ comment });

  } catch (e) {
    return NextResponse.json({ comment: "분석 실패" });
  }
}