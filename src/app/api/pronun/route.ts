export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/supabase-admin";
import { checkTestEligibility } from "@/lib/test-eligibility";

// Azure 발음 평가가 아이 목소리에서 상습적으로 낮은 점수를 주는 기능어들.
// "발음이 어려운 단어" 목록에서 제외한다(빼먹은 단어 판정에는 계속 사용).
const FUNCTION_WORDS = new Set([
  "a", "an", "the", "to", "of", "in", "on", "at", "is", "it", "as", "and",
  "or", "but", "if", "so", "up", "we", "he", "she", "be", "do", "by", "no",
  "not", "are", "was", "for", "you", "our", "her", "his", "him", "my", "me",
  "i", "they", "them", "their", "this", "that", "with", "from", "has", "had",
  "who", "she", "its", "am", "us",
]);

// -s / -es / -ed 로 끝나 보이지만 굴절 어미가 아닌 흔한 단어들. 어미 누락 감지에서 제외.
// (음소 점수 게이트가 1차 필터라 목록은 짧게만 유지)
const SUFFIX_LOOKALIKES = new Set([
  "this", "his", "was", "has", "yes", "its", "less", "goes", "does", "across",
  "bread", "instead", "ahead", "afraid", "said", "toward", "world",
]);

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
    // 아이들은 단어마다 한참 뜸을 들이며 읽는다. 기본 구간 종료 무음(500ms)이면 문장
    // 중간에서 인식이 끊겨 뒷단어가 통째로 누락되고, 그게 "놓친 단어"로 잡힌다.
    // 1.5초로 늘려 읽는 도중의 멈칫거림에 인식이 끊기지 않게 한다.
    speechConfig.setProperty(
      SpeechSDK.PropertyId.Speech_SegmentationSilenceTimeoutMs,
      "1500"
    );

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
    // 연속 인식(continuous)에서 recognized 콜백은 발화 구간마다 여러 번 호출된다.
    // 구간별 accuracyScore를 그때그때 덮어쓰면 "마지막 구간" 점수만 남아, 앞부분을
    // 아무리 틀려도 뒤를 깨끗이 읽으면 높게 나온다. 그래서 두 종류를 다 누적한다:
    //  - segmentAccuracies: 구간 단위 Azure 집계 점수 (Azure 자체 가중치, 덜 뾰족함)
    //  - assessedWordScores: 단어 단위 점수 (엄격함, 오발음 폭주 시 과하게 낮아짐)
    // 최종 발음 점수는 이 둘의 평균으로 잡아 한쪽 편향을 완화한다.
    const segmentAccuracies: number[] = [];
    const assessedWordScores: number[] = [];
    // 발음이 약한 단어 -> 가장 낮게 나온 점수. 아이 목소리에서 Azure가 지나치게 많은
    // 단어를 Mispronunciation으로 찍기 때문에(실측 26개 중 15개), 화면에는 점수가
    // 확실히 낮은 소수만, 기능어(the/to/and 등 Azure가 상습적으로 오채점)는 빼고 보여준다.
    const badWordScores = new Map<string, number>();
    // -ed / -s 어미 누락으로 판정된 단어 -> 마지막 음소 점수. ASR은 어미를 빼먹어도
    // 원문 단어로 인식해버려 "놓친 단어"로는 안 잡히므로 별도로 모은다.
    const endingDropScores = new Map<string, number>();
    // Azure가 인식한 단어를 원문 순서대로 누적. 연속 모드에서는 Omission을 안 내보내므로
    // "빼먹은 단어"는 아래 LCS 전사본 정렬로 잡고, 여기 값은 "읽긴 읽었다"의 근거로만 쓴다.
    const azureWords: { w: string; errorType: string; score: number | null }[] = [];
    // 녹음 시작부터 아이가 실제로 첫 단어를 말하기까지 걸린 무음 구간 — 첫 인식 결과의
    // offset(스트림 시작 기준 오프셋)이 곧 그 길이다. 클라이언트가 wall-clock 기반
    // 소요시간에서 이 값만 빼면, 읽는 도중의 의도적인 쉬는 시간(WPM에 반영되어야 함)은
    // 그대로 두면서 "카운트다운 끝나고 멍하니 있던 시간"만 걷어낼 수 있다.
    let leadingSilenceTicks: number | null = null;

    await new Promise<void>((resolve) => {
      recognizer.recognized = (s, e) => {
        if (e.result.reason === SpeechSDK.ResultReason.RecognizedSpeech) {
          if (leadingSilenceTicks === null) {
            leadingSilenceTicks = e.result.offset ?? 0;
          }
          collectedText += e.result.text + " ";

          const paResult = SpeechSDK.PronunciationAssessmentResult.fromResult(e.result);
          if (typeof paResult?.accuracyScore === "number") {
            finalAccuracy = paResult.accuracyScore;
            segmentAccuracies.push(paResult.accuracyScore);
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
                const errorType: string = w.PronunciationAssessment?.ErrorType ?? "None";
                const cleanedWord = (w.Word || "").toLowerCase().replace(/[^a-z]/g, "");
                if (cleanedWord.length < 1) return;

                const numericScore = typeof score === "number" ? score : null;
                azureWords.push({ w: cleanedWord, errorType, score: numericScore });

                if (errorType === "Omission") return; // 안 읽은 단어 — 발음 채점 대상 아님

                // 전체 발음 정확도 집계용: 시도한 단어의 점수를 모은다.
                // 점수가 안 채워진 심한 오발음(Mispronunciation)은 0점으로 반영한다.
                const effectiveScore =
                  numericScore !== null
                    ? numericScore
                    : errorType === "Mispronunciation"
                    ? 0
                    : null;
                if (effectiveScore !== null) {
                  assessedWordScores.push(effectiveScore);
                }

                // 화면에 띄울 "발음이 어려운 단어": 점수가 확실히 낮고(<40), 3글자 이상,
                // 기능어가 아닌 것만. (기능어는 Azure가 상습 오채점)
                if (
                  effectiveScore !== null &&
                  effectiveScore < 40 &&
                  cleanedWord.length >= 3 &&
                  !FUNCTION_WORDS.has(cleanedWord)
                ) {
                  badWordScores.set(
                    cleanedWord,
                    Math.min(badWordScores.get(cleanedWord) ?? 100, effectiveScore)
                  );
                }

                // -ed / -s 어미 누락 감지: 어간 음소는 제대로 났는데 마지막 음소
                // (주로 -ed의 /t,d/ 또는 -s의 /s,z/)만 점수가 급락하면 어미를 빠뜨린 것.
                const rawPhonemes = w.Phonemes || w.phonemes || [];
                const phonemeScores: number[] = rawPhonemes
                  .map(
                    (p: any) =>
                      p?.PronunciationAssessment?.AccuracyScore ?? p?.AccuracyScore
                  )
                  .filter((v: unknown): v is number => typeof v === "number");
                // 굴절 어미 후보: -ed 로 끝나거나, -s 로 끝나되 -ss/-us/-is(=-ous 포함)
                // 처럼 굴절이 아닌 어미는 제외.
                const endsEd =
                  cleanedWord.length >= 4 && /ed$/.test(cleanedWord);
                const endsInflectionalS =
                  cleanedWord.length >= 4 &&
                  /s$/.test(cleanedWord) &&
                  !/(?:ss|us|is)$/.test(cleanedWord);
                const looksInflected =
                  (endsEd || endsInflectionalS) &&
                  !SUFFIX_LOOKALIKES.has(cleanedWord);
                if (
                  looksInflected &&
                  phonemeScores.length >= 3 &&
                  effectiveScore !== null &&
                  // Azure의 단어 총점도 뭔가 잘못됐다고 동의할 때만 (완벽히 읽은 단어의
                  // 끝소리를 짧게 낸 걸 오탐하지 않도록)
                  effectiveScore < 78
                ) {
                  const last = phonemeScores[phonemeScores.length - 1];
                  const stem = phonemeScores.slice(0, -1);
                  const stemMean =
                    stem.reduce((sum, v) => sum + v, 0) / stem.length;
                  // 실측: 어미를 빼먹으면 끝 음소 점수가 0으로 떨어지기보다 40~50대로
                  // 앉는다. 절대값(<25)만 보면 대부분 놓친다. 어간 대비 상대 하락을 본다:
                  //  - 어간은 어느 정도 살아있고(>=45)
                  //  - 끝 음소가 어간 평균보다 20점 이상 낮고 55 미만
                  if (stemMean >= 45 && last < 55 && last <= stemMean - 20) {
                    endingDropScores.set(
                      cleanedWord,
                      Math.min(endingDropScores.get(cleanedWord) ?? 100, last)
                    );
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

    // ---------------- 시퀀스 정렬 (LCS 기반) ----------------
    // 예전 그리디 매칭은 "the/a/and/on/i" 같은 흔한 단어가 뒤쪽의 같은 단어에 잘못
    // 붙으면 포인터가 앞서나가, 그 사이 실제로 읽은 단어들이 전부 "놓친 단어"로 잡혔다.
    // LCS로 최장 공통 부분수열을 구해 원문↔음성을 최적 정렬하고, 그 정렬에서 빠진
    // 원문 단어만 골라낸다.
    const R = refWords.length;
    const S = spokenWords.length;
    const dp: number[][] = Array.from({ length: R + 1 }, () =>
      new Array(S + 1).fill(0)
    );
    for (let i = R - 1; i >= 0; i--) {
      for (let k = S - 1; k >= 0; k--) {
        dp[i][k] =
          refWords[i] === spokenWords[k]
            ? dp[i + 1][k + 1] + 1
            : Math.max(dp[i + 1][k], dp[i][k + 1]);
      }
    }

    const matchedRefIdx = new Set<number>();
    {
      let i = 0;
      let k = 0;
      while (i < R && k < S) {
        if (refWords[i] === spokenWords[k]) {
          matchedRefIdx.add(i);
          i++;
          k++;
        } else if (dp[i + 1][k] >= dp[i][k + 1]) {
          i++;
        } else {
          k++;
        }
      }
    }

    // ---------------- 원문 단어별 "읽었는가" 판정 ----------------
    // 두 신호를 OR로 합친다:
    //  (a) LCS 전사본 정렬에서 매칭됨  (b) Azure가 그 단어를 인식함(오발음 포함)
    // Azure는 연속 모드에서 Omission을 안 주므로 "안 읽음"은 두 신호 모두 없을 때로 본다.
    // 오발음(Mispronunciation)도 "읽긴 읽은 것"이라 커버리지에는 포함한다 — 발음 품질은
    // 아래 발음 정확도 점수에서 따로 반영된다.
    const readRef: boolean[] = new Array(R).fill(false);
    {
      let ri = 0;
      for (const aw of azureWords) {
        if (aw.errorType === "Insertion" || aw.errorType === "Omission") continue;
        for (let k = ri; k < Math.min(ri + 10, R); k++) {
          if (refWords[k] === aw.w) {
            readRef[k] = true;
            ri = k + 1;
            break;
          }
        }
      }
    }
    for (const i of matchedRefIdx) readRef[i] = true;

    const matchCount = readRef.filter(Boolean).length;
    // "어디까지 읽었나"의 경계는 LCS 매칭(refWords↔전사본의 최적 정렬)의 마지막 지점만
    // 쓴다. readRef 전체를 쓰면, 아이가 도중에 멈췄을 때 전사본 끝의 흔한 단어("her rock")가
    // 뒤쪽 원문 위치에 잘못 붙어 경계가 꼬리까지 늘어나고, 안 읽은 마지막 문장이 통째로
    // "놓친 단어"로 새어나온다.
    const lastReadRef =
      matchedRefIdx.size > 0 ? Math.max(...matchedRefIdx) : -1;

    // wrongWords: 커버리지 계산용 — 안 읽은 단어 전부(못다 읽은 꼬리 포함).
    // missedWords: 화면 표시용 — 마지막으로 읽은 단어 "앞"의 진짜 공백만(꼬리 제외).
    const wrongWords: string[] = [];
    const missedWords: string[] = [];
    for (let i = 0; i < R; i++) {
      if (readRef[i]) continue;
      wrongWords.push(refWords[i]);
      if (i < lastReadRef) missedWords.push(refWords[i]);
    }

    // -ed / -s 어미 누락 단어: 마지막 음소 점수 낮은 순 최대 6개
    const uniqueEndingDrops = [...endingDropScores.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 6)
      .map(([w]) => w);

    // 발음 약한 단어: 점수 낮은 순으로 최대 6개 (어미 누락으로 이미 잡힌 건 제외)
    const uniqueBad = [...badWordScores.entries()]
      .sort((a, b) => a[1] - b[1])
      .filter(([w]) => !uniqueEndingDrops.includes(w))
      .slice(0, 6)
      .map(([w]) => w);
    const uniqueWrong = [...new Set(wrongWords)];
    // "놓친 단어" = 읽은 구간 안에서 LCS·Azure 어느 쪽도 잡지 못한 원문 단어.
    // 기능어(the/a/at 등)도 아이가 일부러 건너뛰면 실제 읽기 오류이므로 그대로 노출한다.
    // 단, 1글자(a/i)는 ASR가 워낙 자주 흘려 노이즈라 제외.
    const uniqueMissed = [...new Set(missedWords)].filter(
      (w) => !uniqueBad.includes(w) && w.length >= 2
    );

    // ---------------- 읽기 정확도 계산 ----------------
    const readingAccuracy =
      refWords.length === 0
        ? 0
        : Math.min(100, Math.round((matchCount / refWords.length) * 100));

    // ---------------- 발음 정확도 계산 ----------------
    // (1) 읽은 단어의 발음 품질: 구간 평균과 단어 평균의 평균.
    //     - 구간 평균만 쓰면(과거 버그) 마지막 구간만 남아 과대평가
    //     - 단어 평균만 쓰면 Azure가 아이 목소리에 오발음을 남발할 때 과소평가
    //     둘을 섞어 편향을 줄인다. 데이터가 없으면 마지막 구간 점수 → 읽기 정확도 순 대체.
    const mean = (xs: number[]) =>
      xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
    const segMean = mean(segmentAccuracies);
    const wordMean = mean(assessedWordScores);
    const wordAccuracy =
      segMean !== null && wordMean !== null
        ? (segMean + wordMean) / 2
        : segMean ?? wordMean ?? (finalAccuracy || readingAccuracy);

    // (2) 완성도 보정: Azure accuracyScore는 "생략한 단어"를 감점하지 않으므로,
    //     일부러 건너뛰어도 점수가 유지된다. 실제로 읽은 비율(completeness)로 눌러준다.
    //     선형으로 곱하면 STT 누락까지 과하게 반영되므로 sqrt로 완화한다.
    //     (completeness 0.9 -> x0.95, 0.5 -> x0.71, 0.3 -> x0.55)
    const completeness =
      refWords.length === 0 ? 0 : Math.min(1, matchCount / refWords.length);
    const pronunciationScore = Math.max(
      0,
      Math.min(100, Math.round(wordAccuracy * Math.sqrt(completeness)))
    );

    const durationSec = Math.max(1, totalDuration / 10000000);
    const leadingSilenceSec = Math.max(0, (leadingSilenceTicks ?? 0) / 10000000);

    // ---------------- OpenAI 코멘트 생성 ----------------
    let pronunciationComment = "";

    if (
      uniqueMissed.length > 0 ||
      uniqueBad.length > 0 ||
      uniqueEndingDrops.length > 0
    ) {
      const OpenAI = (await import("openai")).default;
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

      const prompt = `
      학생의 발음 점수: ${pronunciationScore}점
      놓치거나 잘못 읽은 단어: ${uniqueMissed.slice(0, 5).join(", ")}
      발음이 다소 약했던 단어: ${uniqueBad.slice(0, 5).join(", ")}
      -ed / -s 어미를 빠뜨린 단어: ${uniqueEndingDrops.slice(0, 5).join(", ")}

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
      pronunciationAccuracy: pronunciationScore,
      pronunciationComment,
      badPronunciations: uniqueBad,
      endingDrops: uniqueEndingDrops,
      wrongWords: uniqueWrong,
      missedWords: uniqueMissed,
      durationSec,
      leadingSilenceSec,
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