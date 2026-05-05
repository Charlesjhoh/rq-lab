"use client";

import { useRef, useState } from "react";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";
import { blobToPCM16kMono } from "./utilsAudio";

export default function PronunTestClient() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const [recording, setRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [refText, setRefText] = useState("I like pancakes.");
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 🎙️ 녹음 시작
  const startRecording = async () => {
    setErr(null);
    setResult(null);

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);

    audioChunksRef.current = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      stream.getTracks().forEach((t) => t.stop());

      // ✅ 녹음 종료 후 자동 분석
      setTimeout(() => {
        runAssessment(blob);
      }, 300);
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setRecording(true);
  };

  // ⏹️ 녹음 종료
  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  // 📊 분석 실행
  const runAssessment = async (blob?: Blob) => {
    const targetBlob = blob ?? audioBlob;
    if (!targetBlob) {
      setErr("먼저 녹음해 주세요.");
      return;
    }

    const key = process.env.NEXT_PUBLIC_AZURE_SPEECH_KEY!;
    const region = process.env.NEXT_PUBLIC_AZURE_SPEECH_REGION!;

    try {
      setLoading(true);

      const pcmBytes = await blobToPCM16kMono(targetBlob);

      const pushStream = SpeechSDK.AudioInputStream.createPushStream(
        SpeechSDK.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1)
      );
      pushStream.write(pcmBytes);
      pushStream.close();

      const audioConfig = SpeechSDK.AudioConfig.fromStreamInput(pushStream);
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

      const res: any = await new Promise((resolve, reject) => {
        recognizer.recognizeOnceAsync(resolve, reject);
      });

      recognizer.close();

      const paResult = (SpeechSDK as any).PronunciationAssessmentResult.fromResult(res);

      setResult({
        text: res.text,
        accuracy: paResult.accuracyScore,
        fluency: paResult.fluencyScore,
        completeness: paResult.completenessScore,
        pronunciation: paResult.pronunciationScore,
      });
    } catch (e: any) {
      setErr(e.message ?? "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 20 }}>
      <input
        value={refText}
        onChange={(e) => setRefText(e.target.value)}
        style={{ width: "100%", padding: 10 }}
      />

      <div style={{ marginTop: 10 }}>
        {!recording ? (
          <button onClick={startRecording}>🎙️ 녹음 시작</button>
        ) : (
          <button onClick={stopRecording}>⏹️ 녹음 종료</button>
        )}

        {audioUrl && (
          <audio controls src={audioUrl} style={{ display: "block", marginTop: 10 }} />
        )}

        {loading && (
          <p style={{ marginTop: 10, color: "#666" }}>
            읽은 내용을 바탕으로 발음과 리딩 수준을 분석 중입니다.
          </p>
        )}
      </div>

      {err && <p style={{ color: "red" }}>{err}</p>}

      {result && (
        <div style={{ marginTop: 10 }}>
          <p><b>인식 결과:</b> {result.text}</p>
          <p>Accuracy: {result.accuracy}</p>
          <p>Fluency: {result.fluency}</p>
          <p>Pronunciation: {result.pronunciation}</p>
        </div>
      )}
    </div>
  );
}
