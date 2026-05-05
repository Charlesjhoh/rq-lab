// src/hooks/useRecorder.ts
"use client";

import { useRef } from "react";

export function useRecorder() {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);

  // 🎤 녹음 시작
  const start = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const recorder = new MediaRecorder(stream);
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
  };

  // ⏹ 녹음 종료 → audio Blob 반환
  const stop = async (): Promise<Blob> => {
    return new Promise((resolve) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder) return;

      recorder.onstop = () => {
        const audioBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });

        // 마이크 스트림 종료
        recorder.stream.getTracks().forEach((track) => track.stop());

        resolve(audioBlob);
      };

      recorder.stop();
    });
  };

  return {
    start,
    stop,
  };
}
