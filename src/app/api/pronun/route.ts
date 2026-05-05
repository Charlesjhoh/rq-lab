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

    const recognizer = new SpeechSDK.SpeechRecognizer(
      speechConfig,
      audioConfig
    );

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
    let wrongWords: string[] = [];
    let badPronunciations: string[] = [];
    await new Promise<void>((resolve) => {
      recognizer.recognized = (s, e) => {
        const json = e.result.properties.getProperty(
          SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult
        );

        if (json) {
          const parsed = JSON.parse(json);
          const words = parsed.NBest?.[0]?.Words || [];

          words.forEach((w: any) => {
            const word = w.Word;
            const score = w.PronunciationAssessment?.AccuracyScore;

          });
        }
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          collectedText += e.result.text + " ";

          const paResult =
            SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);

          const words = e.result.json
            ? JSON.parse(e.result.json).NBest?.[0]?.Words
            : [];

          if (words) {
            words.forEach((w: any) => {

            });
          }

          if (typeof paResult?.accuracyScore === "number") {
            finalAccuracy = paResult.accuracyScore;
          }
            const json = e.result.properties.getProperty(
              SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult
            );

            if (json) {
              const parsed = JSON.parse(json);
              const words = parsed.NBest?.[0]?.Words || [];

              words.forEach((w: any) => {
                const score = w.PronunciationAssessment?.AccuracyScore;

                if (score < 60) {
                  badPronunciations.push(w.Word.toLowerCase());
                }
              });
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
    
    const normalize = (text: string) =>
      text
        .toLowerCase()
        .replace(/[^a-z\s]/g, "")
        .trim()
        .split(/\s+/);

    const refWords = normalize(text);
    const spokenWords = normalize(collectedText);

    let matchCount = 0;

    // 👉 길이 mismatch 대비 (중요)
    const minLen = Math.min(refWords.length, spokenWords.length);

      let j = 0;

      for (let i = 0; i < refWords.length; i++) {
        const original = refWords[i];

        let found = false;

        for (let k = j; k < j + 3 && k < spokenWords.length; k++) {
          if (spokenWords[k] === original) {
            found = true;
            j = k + 1;
            matchCount++;   // 🔥 이거 추가
            break;
          }
        }

        if (!found) {
          wrongWords.push(original);
        }
      }


// 👉 여기서 정리
const uniqueBad = [...new Set(badPronunciations)];
const uniqueWrong = [...new Set(wrongWords)];



      const cleanRef = normalize(text).join(" ");
      const cleanSpoken = normalize(collectedText).join(" ");

      const readingAccuracy =
        cleanRef === cleanSpoken ? 100 : Math.round((matchCount / refWords.length) * 100);

        const durationSec = totalDuration / 10000000;

      const OpenAI = (await import("openai")).default;

      const client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY!,
      });

      let pronunciationComment = "";

      if (wrongWords.length > 0) {
        const prompt = `
        아이의 발음 정확도 점수는 ${finalAccuracy}점입니다.

        다음 단어들은 인식 과정에서 불일치가 발생한 단어입니다:
        ${wrongWords.join(", ")}

        이 결과를 바탕으로 아이의 발음 특징과
        연습 방법을 한국어로 2~3줄로 설명하세요.
        `;

        const gptRes = await client.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
        });

        pronunciationComment = gptRes.choices[0].message.content || "";
      }
    
      return NextResponse.json({
        accuracy: readingAccuracy,
        pronunciationAccuracy: finalAccuracy,
        pronunciationComment,
        badPronunciations: uniqueBad,   // 🔥 교체
        wrongWords: uniqueWrong,        // 🔥 추가
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