export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const SpeechSDK = await import("microsoft-cognitiveservices-speech-sdk");

  try {
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
                if (typeof score === "number" && score < 60) {
                  const cleanedWord = w.Word.toLowerCase().replace(/[^a-z]/g, "");
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
    const wrongWords: string[] = [];
    let j = 0;

    // Window 크기를 12로 확장하여 단어 생략/추가 시에도 매칭 위치를 찾아냄
    const LOOK_AHEAD = 12;

    for (let i = 0; i < refWords.length; i++) {
      const original = refWords[i];
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
      }
    }

    const uniqueBad = [...new Set(badPronunciations)];
    const uniqueWrong = [...new Set(wrongWords)];

    // ---------------- 읽기 정확도 계산 ----------------
    const readingAccuracy =
      refWords.length === 0
        ? 0
        : Math.min(100, Math.round((matchCount / refWords.length) * 100));

    const durationSec = Math.max(1, totalDuration / 10000000);

    // ---------------- OpenAI 코멘트 생성 ----------------
    let pronunciationComment = "";

    if (uniqueWrong.length > 0 || uniqueBad.length > 0) {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

      const prompt = `
      학생의 발음 점수: ${finalAccuracy}점
      놓치거나 잘못 읽은 단어: ${uniqueWrong.slice(0, 5).join(", ")}
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