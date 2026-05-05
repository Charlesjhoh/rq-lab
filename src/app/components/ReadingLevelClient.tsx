"use client";

import { useRef, useState } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { blobToPCM16kMono } from "./utilsAudio";

/* ===============================
   AR별 추천 도서
================================ */
const AR_BOOK_RECOMMENDATIONS = [
  {
    range: "AR 1.5–2.2",
    label: "리더스북 중",
    books: ["Elephant & Piggie", "Pete the Cat", "Fly Guy", "Little Bear"],
  },
  {
    range: "AR 2.3–2.8",
    label: "리더스북 상",
    books: ["Henry and Mudge", "Frog and Toad", "Danny and the Dinosaur"],
  },
  {
    range: "AR 2.9–3.4",
    label: "챕터북 초입",
    books: ["Amelia Bedelia", "Pinky and Rex", "Mr. Putter & Tabby"],
  },
  {
    range: "AR 3.5–4.0",
    label: "챕터북 중",
    books: ["Nate the Great", "A to Z Mysteries", "Cam Jansen"],
  },
  {
    range: "AR 4.1+",
    label: "챕터북 상",
    books: ["My Weird School", "Dragon Masters", "Magic Tree House"],
  },
];

const FUNCTION_WORDS = new Set([
  "a","an","the","to","of","in","on","at","for","from","with",
  "and","or","but","is","am","are","was","were","be","been","being",
  "do","does","did","have","has","had","i","you","he","she","we","they","it",
  "my","your","his","her","our","their","its","me","him","her","us","them",
]);

const average = (nums: number[]) =>
  nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;

function computeFunctionWordScore(words: any[]) {
  const scores: number[] = [];
  for (const w of words) {
    if (FUNCTION_WORDS.has((w.Word || "").toLowerCase())) {
      const acc = w.PronunciationAssessment?.AccuracyScore;
      if (typeof acc === "number") scores.push(acc);
    }
  }
  return average(scores) || 80;
}

function computeFinalConsonantAccuracy(words: any[]) {
  const finals = new Set(["s","z","t","d","k","g","p","b","f","v","th","dh","n","m","ng","sh","ch","jh","zh","l","r"]);
  const scores: number[] = [];
  for (const w of words) {
    for (const p of w.Phonemes ?? []) {
      const acc = p.PronunciationAssessment?.AccuracyScore;
      if (typeof acc === "number" && finals.has((p.Phoneme || "").toLowerCase())) {
        scores.push(acc);
      }
    }
  }
  return average(scores) || 80;
}

function predictARBand({ fluencyAvg, finalConsAvg, functionWordAvg }: any) {
  const score =
    fluencyAvg * 0.5 +
    finalConsAvg * 0.3 +
    functionWordAvg * 0.2;

  if (score < 72) return { band: "AR 1.5–2.2", label: "리더스북 중", score: Math.round(score) };
  if (score < 79) return { band: "AR 2.3–2.8", label: "리더스북 상", score: Math.round(score) };
  if (score < 86) return { band: "AR 2.9–3.4", label: "챕터북 초입", score: Math.round(score) };
  if (score < 92) return { band: "AR 3.5–4.0", label: "챕터북 중", score: Math.round(score) };
  return { band: "AR 4.1+", label: "챕터북 상", score: Math.round(score) };
}

/* ===============================
   메인 컴포넌트
================================ */
export default function ReadingLevelClient() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const refText = `Henry liked to read books.
Sometimes he read with Mudge.
They liked stories about adventures and dogs.`;

  /* ===== 녹음 ===== */
  const startRecording = async () => {
    setError(null);
    setResult(null);
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      stream.getTracks().forEach((t) => t.stop());
      runAssessment(blob);
    };

    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  /* ===== 분석 ===== */
  const runAssessment = async (blob: Blob) => {
    try {
      setLoading(true);

      const pcm = await blobToPCM16kMono(blob);
      const pushStream = SpeechSDK.AudioInputStream.createPushStream(
        SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
      );
      pushStream.write(pcm.buffer as ArrayBuffer);
      pushStream.close();

      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
        process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY!,
        process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION!
      );
      speechConfig.speechRecognitionLanguage = "en-US";

      const recognizer = new SpeechSDK.SpeechRecognizer(
        speechConfig,
        SpeechSDK.AudioConfig.fromStreamInput(pushStream)
      );

      const paConfig = new (SpeechSDK as any).PronunciationAssessmentConfig(
        refText,
        (SpeechSDK as any).PronunciationAssessmentGradingSystem.HundredMark,
        (SpeechSDK as any).PronunciationAssessmentGranularity.Phoneme,
        true
      );
      paConfig.applyTo(recognizer);

      const res: any = await new Promise((resolve, reject) =>
        recognizer.recognizeOnceAsync(resolve, reject)
      );
      recognizer.close();

      const pa = (SpeechSDK as any).PronunciationAssessmentResult.fromResult(res);
      const words = pa.detailResult?.Words ?? [];

      const fluencyAvg = pa.fluencyScore ?? 0;
      const finalConsAvg = computeFinalConsonantAccuracy(words);
      const functionWordAvg = computeFunctionWordScore(words);
      const ar = predictARBand({ fluencyAvg, finalConsAvg, functionWordAvg });

      setResult({
        text: res.text,
        fluencyAvg,
        finalConsAvg,
        functionWordAvg,
        ar,
        books: AR_BOOK_RECOMMENDATIONS.find(b => b.range === ar.band)?.books ?? [],
      });
    } catch (e: any) {
      setError("분석 중 문제가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  /* ===== UI ===== */
  return (
    <div style={{ marginTop: 20 }}>
      <pre style={{ background: "#f7f7f7", padding: 12 }}>{refText}</pre>

      {!recording ? (
        <button onClick={startRecording}>🎤 녹음 시작</button>
      ) : (
        <button onClick={stopRecording}>⏹ 녹음 종료</button>
      )}

      {audioUrl && <audio controls src={audioUrl} style={{ marginTop: 10 }} />}

      {loading && (
        <p style={{ marginTop: 12, color: "#555" }}>
          읽은 내용을 바탕으로 리딩 레벨을 분석 중입니다…
        </p>
      )}

      {error && <p style={{ color: "red" }}>{error}</p>}

      {result && (
        <div style={{ marginTop: 20 }}>
          <h3>📘 예상 리딩 레벨</h3>
          <p>{result.ar.band} ({result.ar.label})</p>
          <p>점수: {result.ar.score}</p>

          <h4>📚 추천 도서</h4>
          <ul>
            {result.books.map((b: string) => <li key={b}>{b}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}
