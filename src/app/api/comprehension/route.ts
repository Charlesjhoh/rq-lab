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
    
    const uint8Array = new Uint8Array(buffer);
    pushStream.write(uint8Array.buffer);
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

Scoring bands (use the FULL width of the matching band — do NOT default to the
lower boundary number just because the recall clears that band):
- 90-100: Main idea + most key events. Score near 90 if only the main idea and
  the most important events are covered; score near 100 the more additional
  correct events/details are also recalled.
- 75-89: Main idea + some key details. Score near 75 if just a couple of details
  are present beyond the main idea; score near 89 the more of the key details
  are correctly recalled.
- 60-74: Partial understanding of the main idea, missing several key events.
- 40-59: Very limited recall — only fragments are correct.
- Below 40: Minimal understanding.

Judge how many distinct key events/details are correctly recalled and place the
score accordingly across the band's full range, not just at its edges.

Calibration examples (illustrative only, unrelated to the passage below — use
these to see how specific, non-round numbers should look in practice):
- Main idea + 4 of 5 key events, missing only a minor detail -> 87 (not 90)
- Main idea + 2 of 5 key events -> 79 (not 75 or 80)
- Main idea only, no supporting events -> 68 (not 60 or 75)
- Everything correct except one trivial detail (a number, a name) -> 96 (not 90 or 100)

Avoid landing on an exact multiple of 5 or 10 unless the recall genuinely sits at
a natural extreme (0 for no understanding at all, 100 for a flawless retelling).
Most real answers fall between the clean numbers — your score should too.
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

    let parsed;
    let content = ""; // 🔥 먼저 선언

    try {
      content = gptData.choices?.[0]?.message?.content;

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

      return NextResponse.json({
        recallText,
        score: 0,
        good: [],
        bad: [],
        summary: "분석 실패"
      });
    }
    const rawScore =
      typeof parsed.score === "number" ? parsed.score : 60;

    // GPT가 프롬프트에 적힌 구간 경계값(75, 90) 자체를 대표값으로 찍어버리는 경향이 있어
    // "75-89: 세부까지 이해"/"90-100: 대부분 이해"를 받은 아이도 실제로는 75/90에 몰려서
    // 이해도가 부당하게 낮게 보였다. 두 상위 구간은 후하게 재매핑해 이 편향을 상쇄한다.
    const score =
      rawScore >= 90 ? 100 : rawScore >= 75 ? 90 : rawScore;

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