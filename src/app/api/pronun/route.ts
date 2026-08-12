export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-admin";
import { checkTestEligibility } from "@/lib/test-eligibility";

export async function POST(req: NextRequest) {
  const SpeechSDK = await import("microsoft-cognitiveservices-speech-sdk");

  try {
    // Azure Speech 호출은 건당 실비용이 든다 — 응시 자격(소속 선생님 구독 상태,
    // 일일 응시 횟수)을 이 비용 발생 전에 먼저 확인한다.
    const auth = await requireUser(req.headers.get("Authorization"));
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const eligibility = await checkTestEligibility(auth.user.id);
    if (!eligibility.allowed) {
      return NextResponse.json({ error: eligibility.reason }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("audio") as File;
    const text = formData.get("text") as string;

    if (!file || !text) {
      return NextResponse.json(
        { error: "Missing audio or reference text" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const key = process.env.AZURE_SPEECH_KEY!;
    const region = process.env.AZURE_SPEECH_REGION!;

    const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
    speechConfig.speechRecognitionLanguage = "en-US";

    const pushStream = SpeechSDK.AudioInputStream.createPushStream(
      SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
    );

    const uint8Array = new Uint8Array(buffer);
    pushStream.write(uint8Array.buffer);
    pushStream.close();

    const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);
    const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

    const paConfig = new SpeechSDK.PronunciationAssessmentConfig(
      text,
      SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
      SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
      true
    );

    paConfig.applyTo(recognizer);

    let collectedText = "";
    let finalAccuracy = 0;
    let totalDuration = 0;
    let badPronunciations: string[] = [];

    await new Promise<void>((resolve) => {
      recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          collectedText += e.result.text + " ";

          const paResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
          if (typeof paResult?.accuracyScore === "number") {
            finalAccuracy = paResult.accuracyScore;
          }

          const json = e.result.properties.getProperty(
            SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult
          );

          if (json) {
            try {
              const parsed = JSON.parse(json);
              const words = parsed.NBest?.[0]?.Words || [];

              words.forEach((w: any) => {
                const score = w.PronunciationAssessment?.AccuracyScore;
                const errorType = w.PronunciationAssessment?.ErrorType;
                // 아주 심하게 뭉개진 발음은 Azure가 점수를 낮게 주는 대신 아예
                // Mispronunciation/Omission으로만 분류하고 AccuracyScore를 안 채우는
                // 경우가 있어, 점수 기준만으로는 걸러지지 않고 결과에서 통째로 빠졌었다.
                // ErrorType도 함께 봐서 그런 케이스를 잡는다.
                const isBad =
                  (typeof score === "number" && score < 60) ||
                  errorType === "Mispronunciation" ||
                  errorType === "Omission";

                if (isBad) {
                  const cleanedWord = (w.Word || "").toLowerCase().replace(/[^a-z]/g, "");
                  if (cleanedWord.length > 1) {
                    badPronunciations.push(cleanedWord);
                  }
                }
              });
            } catch (err) {
              console.error("JSON Parse Error:", err);
            }
          }

          if (typeof e.result?.duration === "number") {
            totalDuration += e.result.duration;
          }
        }
      };

      recognizer.sessionStopped = () => resolve();
      recognizer.canceled = () => resolve();

      recognizer.startContinuousRecognitionAsync();
    });

    recognizer.close();

    // ---------------- 텍스트 정규화 ----------------
    const normalize = (str: string) =>
      str
        .toLowerCase()
        .replace(/n't/g, " not")
        .replace(/'s/g, " is")
        .replace(/[^a-z\s]/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    const refWords = normalize(text);
    const spokenWords = normalize(collectedText);

    // ---------------- 유연 매칭 알고리즘 (Alignment Fix) ----------------
    let matchCount = 0;
    // wrongWords: 커버리지/정확도 계산용 — 못다 읽은 뒷부분까지 전부 포함해야 점수가 정확히
    // 깎이므로 기존 그대로 둔다. missedWords: 화면 표시용 — "시도했지만 놓친 단어"만 담아서,
    // 녹음이 도중에 끝나 통째로 남은 뒷부분이 전부 "놓친 단어"로 뜨는 문제를 피한다.
    const wrongWords: string[] = [];
    const missedWords: string[] = [];
    let j = 0;

    // Window 크기를 12로 확장하여 단어 생략/추가 시에도 매칭 위치를 잘 찾아내도록 보정
    const LOOK_AHEAD = 12;

    for (let i = 0; i < refWords.length; i++) {
      const original = refWords[i];
      const stillHasSpeechAhead = j < spokenWords.length;
      let found = false;

      const searchEnd = Math.min(j + LOOK_AHEAD, spokenWords.length);

      for (let k = j; k < searchEnd; k++) {
        if (spokenWords[k] === original) {
          found = true;
          j = k + 1;
          matchCount++;
          break;
        }
      }

      if (!found) {
        wrongWords.push(original);
        // 남은 음성이 없으면 이후 원문 단어는 "아직 못 읽은 부분"이지 "틀리게 읽은 단어"가
        // 아니므로 화면 표시용 목록에는 넣지 않는다
        if (stillHasSpeechAhead) {
          missedWords.push(original);
        }
      }
    }

    const uniqueBad = [...new Set(badPronunciations)];
    const uniqueWrong = [...new Set(wrongWords)];
    // 발음이 어려운 단어로 이미 표시되는 단어는 놓친 단어 목록에서 중복 제외
    const uniqueMissed = [...new Set(missedWords)].filter((w) => !uniqueBad.includes(w));

    // ---------------- 읽기 정확도 계산 ----------------
    const readingAccuracy =
      refWords.length === 0
        ? 0
        : Math.min(100, Math.round((matchCount / refWords.length) * 100));

    const durationSec = Math.max(1, totalDuration / 10000000);

    // ---------------- OpenAI 코멘트 생성 ----------------
    let pronunciationComment = "";

    if (uniqueMissed.length > 0 || uniqueBad.length > 0) {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

      const prompt = `
      학생의 발음 점수: ${finalAccuracy}점
      놓치거나 잘못 읽은 단어: ${uniqueMissed.slice(0, 5).join(", ")}
      발음이 다소 약했던 단어: ${uniqueBad.slice(0, 5).join(", ")}

      위 결과를 바탕으로 학부모가 이해하기 쉽게 격려와 함께 2~3줄의 학습 가이드를 한국어로 작성해 주세요.
      `;

      try {
        const gptRes = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
        });
        pronunciationComment = gptRes.choices[0]?.message?.content || "";
      } catch (e) {
        console.error("OpenAI Error:", e);
      }
    }

    return NextResponse.json({
      accuracy: readingAccuracy,
      pronunciationAccuracy: Math.round(finalAccuracy || readingAccuracy),
      pronunciationComment,
      badPronunciations: uniqueBad,
      wrongWords: uniqueWrong,
      missedWords: uniqueMissed,
      durationSec,
      recognizedText: collectedText.trim(),
    });
  } catch (e: any) {
    console.error("Pronun API Error:", e);
    return NextResponse.json(
      { error: e.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}