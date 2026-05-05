"use client";

import { useRef, useState } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

// 🔹 타입 정의
type WordItem = {
  Word: string;
  PronunciationAssessment?: { AccuracyScore?: number };
  Syllables?: Array<{ Grapheme?: string; PronunciationAssessment?: { AccuracyScore?: number } }>;
  Phonemes?: Array<{ Phoneme?: string; PronunciationAssessment?: { AccuracyScore?: number } }>;
};

// 🔹 평균 계산
function average(nums: number[]) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

// 🔹 약한 단어 / 음소 추출
function pickWeakestWords(words: WordItem[], topN = 3) {
  return words
    .map((w) => ({
      word: w.Word,
      acc: w.PronunciationAssessment?.AccuracyScore ?? 0,
    }))
    .sort((a, b) => a.acc - b.acc)
    .slice(0, topN);
}

function pickWeakestPhonemes(words: WordItem[], topN = 5) {
  const list: any[] = [];
  words.forEach((w) =>
    (w.Phonemes ?? []).forEach((p) => {
      if (p.PronunciationAssessment?.AccuracyScore != null) {
        list.push({
          phoneme: p.Phoneme,
          acc: p.PronunciationAssessment.AccuracyScore,
        });
      }
    })
  );
  return list.sort((a, b) => a.acc - b.acc).slice(0, topN);
}

// 🔹 AR 예측
function predictARBand(score: number) {
  if (score < 72) return { band: "AR 1.5–2.2", label: "리더스북 중" };
  if (score < 79) return { band: "AR 2.3–2.8", label: "리더스북 상" };
  if (score < 86) return { band: "AR 2.9–3.4", label: "챕터북 초입" };
  if (score < 92) return { band: "AR 3.5–4.0", label: "챕터북 중" };
  return { band: "AR 4.1+", label: "챕터북 상" };
}

// 🔹 webm → PCM
async function blobToPCM16kMono(blob: Blob): Promise<Uint8Array> {
  const arrayBuf = await blob.arrayBuffer();
  const audioCtx = new AudioContext();
  const decoded = await audioCtx.decodeAudioData(arrayBuf.slice(0));

  const targetRate = 16000;
  const offlineCtx = new OfflineAudioContext(1, decoded.duration * targetRate, targetRate);
  const src = offlineCtx.createBufferSource();
  src.buffer = decoded;
  src.connect(offlineCtx.destination);
  src.start(0);

  const rendered = await offlineCtx.startRendering();
  const data = rendered.getChannelData(0);

  const pcm16 = new Int16Array(data.length);
  for (let i = 0; i < data.length; i++) {
    const s = Math.max(-1, Math.min(1, data[i]));
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return new Uint8Array(pcm16.buffer);
}

export default function PronunClient() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [refText, setRefText] = useState("I like pancakes.");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const startRecording = async () => {
    setErr(null);
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
    };
    recorder.start();
    recorderRef.current = recorder;
    setRecording(true);
  };

  const stopRecording = () => {
    recorderRef.current?.stop();
    setRecording(false);
  };

  const runAssessment = async () => {
    if (!audioBlob) return setErr("먼저 녹음해 주세요.");

    const key = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY!;
    const region = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION!;

    try {
      setLoading(true);

      const pcm = await blobToPCM16kMono(audioBlob);
      const push = SpeechSDK.AudioInputStream.createPushStream(
        SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
      );
      push.write(pcm.buffer as ArrayBuffer);
      push.close();

      const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(push);
      const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(key, region);
      speechConfig.speechRecognitionLanguage = "en-US";

      const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);
      const paConfig = new (SpeechSDK as any).PronunciationAssessmentConfig(
        refText,
        (SpeechSDK as any).PronunciationAssessmentGradingSystem.HundredMark,
        (SpeechSDK as any).PronunciationAssessmentGranularity.Phoneme,
        true
      );
      paConfig.applyTo(recognizer);

      const res: any = await new Promise((resolve) =>
        recognizer.recognizeOnceAsync(resolve)
      );
      recognizer.close();

      const pa = (SpeechSDK as any).PronunciationAssessmentResult.fromResult(res);
      const words = pa.detailResult?.Words ?? [];
      const avgScore = average(words.map((w: any) => w.PronunciationAssessment?.AccuracyScore ?? 0));

      setResult({
        recognizedText: res.text,
        ar: predictARBand(avgScore),
        weakWords: pickWeakestWords(words),
        weakPhonemes: pickWeakestPhonemes(words),
      });
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 20 }}>
      <h2>발음 기반 리딩 진단</h2>

      <input
        value={refText}
        onChange={(e) => setRefText(e.target.value)}
        style={{ width: "100%", padding: 10 }}
      />

      {!recording ? (
        <button onClick={startRecording}>🎙️ 녹음 시작</button>
      ) : (
        <button onClick={stopRecording}>⏹️ 녹음 종료</button>
      )}

      {audioUrl && <audio controls src={audioUrl} />}

      <button onClick={runAssessment} disabled={loading}>
        {loading ? "분석 중입니다…" : "읽은 내용 분석하기"}
      </button>

      {result && (
        <div>
          <p>예측 레벨: {result.ar.band}</p>
        </div>
      )}
    </div>
  );
}
