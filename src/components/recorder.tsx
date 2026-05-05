// src/components/recorder.tsx
"use client";

import { useEffect, useRef, useState } from "react";

type ApiResult = {
  ok: boolean;
  message?: string;
  meta?: any;
};

export default function Recorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const [recording, setRecording] = useState(false);
  const [status, setStatus] = useState<string>("");
  const [result, setResult] = useState<ApiResult | null>(null);

  useEffect(() => {
    return () => {
      // 컴포넌트 언마운트 시 녹음 중지/정리
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  async function startRecording() {
    try {
      setResult(null);
      setStatus("마이크 권한 확인 중…");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType =
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];

      mr.ondataavailable = (e) => {
        if (e.data?.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstart = () => {
        setRecording(true);
        setStatus("녹음 중…");
      };
      mr.onstop = async () => {
        setRecording(false);
        setStatus("업로드 중…");
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || "audio/webm" });
        const file = new File([blob], `recording.${mimeToExt(mr.mimeType)}`, {
          type: mr.mimeType || "audio/webm",
        });

        const fd = new FormData();
        fd.append("audio", file);
        // 샘플 문장(채점 대상 텍스트)을 같이 보낼 수도 있음
        fd.append("text", "This is a sample sentence for scoring.");

        try {
          const res = await fetch("/api/score", { method: "POST", body: fd });
          const json = (await res.json()) as ApiResult;
          setResult(json);
          setStatus("완료");
        } catch (err: any) {
          setResult({ ok: false, message: err?.message || "업로드 실패" });
          setStatus("오류");
        }
      };

      mediaRecorderRef.current = mr;
      mr.start();
    } catch (e: any) {
      setStatus("마이크 접근 실패");
      setResult({ ok: false, message: e?.message || "마이크 권한을 확인하세요." });
    }
  }

  function stopRecording() {
    const mr = mediaRecorderRef.current;
    if (mr && mr.state === "recording") {
      mr.stop();
      mr.stream.getTracks().forEach((t) => t.stop());
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-4 p-4 border rounded-2xl">
      <h2 className="text-xl font-semibold">🎤 Recorder (MVP)</h2>
      <p className="text-sm text-gray-600">{status || "준비됨"}</p>
      <div className="flex gap-2">
        <button
          onClick={startRecording}
          disabled={recording}
          className="px-4 py-2 rounded-xl bg-black text-white disabled:opacity-40"
        >
          녹음 시작
        </button>
        <button
          onClick={stopRecording}
          disabled={!recording}
          className="px-4 py-2 rounded-xl border"
        >
          녹음 정지 & 업로드
        </button>
      </div>

      {result && (
        <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-3 rounded-xl overflow-x-auto">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
      <p className="text-xs text-gray-500">
        *브라우저마다 녹음 포맷이 달라 기본은 <code>webm/opus</code>로 전송합니다. (MVP 단계)
      </p>
    </div>
  );
}

function mimeToExt(mime?: string) {
  if (!mime) return "webm";
  if (mime.includes("webm")) return "webm";
  if (mime.includes("ogg")) return "ogg";
  if (mime.includes("mp4") || mime.includes("mpeg")) return "m4a";
  return "webm";
}
