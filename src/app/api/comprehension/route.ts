export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const SpeechSDK = await import("microsoft-cognitiveservices-speech-sdk");

  try {
    const formData = await req.formData();
    const file = formData.get("audio") as File;
    const originalText = formData.get("text") as string;

    if (!file || !originalText) {
      return NextResponse.json({ score: 60, comment: "Invalid input" });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const key = process.env.AZURE_SPEECH_KEY!;
    const region = process.env.AZURE_SPEECH_REGION!;

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechRecognitionLanguage = "ko-KR";

    // 🔥 Push Stream 생성
    const pushStream = SpeechSDK.AudioInputStream.createPushStream();
    pushStream.write(
    buffer.buffer.slice(
    buffer.byteOffset,
    buffer.byteOffset + buffer.byteLength
  )
);
    pushStream.close();

    const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);

    const recognizer = new SpeechSDK.SpeechRecognizer(
      speechConfig,
      audioConfig
    );

    let collectedText = "";

    // 🔥 Continuous Recognition (완전 안정 버전)
    await new Promise<void>((resolve) => {
      recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          collectedText += e.result.text + " ";
        }
      };

      recognizer.sessionStopped = () => {
        resolve();
      };

      recognizer.canceled = () => {
        // Azure가 스트림 종료 시 cancel을 보내는 경우가 있음
        resolve();
      };

      recognizer.startContinuousRecognitionAsync();
    });

    recognizer.close();

    const recallText = collectedText.trim();

    console.log("Recall text:", recallText);

    if (!recallText || recallText.length < 5) {
      return NextResponse.json({
        recallText,
        score: 55,
        comment: "Low speech content",
      });
    }

    // 🔥 GPT 채점
    const openaiRes = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          temperature: 0,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content: `
You are an elementary-level reading comprehension grader.

The original passage is in English.
The student's recall is in Korean.
All responses must be in Korean.

Focus on meaning and key events, not wording.

Scoring:
90-100: Main idea + most key events
75-89: Main idea + some key details
60-74: Partial understanding
40-59: Very limited recall
Below 40: Minimal understanding
`
            },
            {
              role: "user",
              content: `
Original passage:
${originalText}

Student recall:
${recallText}

Return JSON in this format:

{
  "score": number,
  "good": string[],
  "bad": string[],
  "summary": string
}

Rules:
- good: what the student understood
- bad: what is missing
- summary: short level description
- If recall is too short, score must be 0
- All text must be in Korean
`
            }
          ]
        })
      }
    );

const gptData = await openaiRes.json();
console.log("🔥 GPT RAW:", gptData);

let parsed;
let content = ""; // 🔥 먼저 선언

try {
  content = gptData.choices?.[0]?.message?.content;

  console.log("🔥 GPT CONTENT:", content); // ✅ 여기서 찍어야 함

  if (!content) {
    throw new Error("GPT 응답 없음");
  }

  content = content
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  parsed = JSON.parse(content);

} catch (e) {
  console.error("🔥 JSON 파싱 실패:", e);
  console.log("🔥 content:", content);

  return NextResponse.json({
    recallText,
    score: 0,
    good: [],
    bad: [],
    summary: "분석 실패"
  });
}
    const score =
  typeof parsed.score === "number" ? parsed.score : 60;


return NextResponse.json({
  recallText,
  score,
  good: parsed.good ?? [],
  bad: parsed.bad ?? [],
  summary: parsed.summary ?? "",
});

  } catch (e: any) {
    console.error("Comprehension API error:", e?.message || e);
    return NextResponse.json({
      recallText: "",
      score: 0,
      good: [],
      bad: [],
      summary: "서버 오류",
    });
  }
}