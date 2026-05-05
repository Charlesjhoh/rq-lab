// src/components/evaluation/RecordControl.tsx
"use client";

import PrimaryButton from "@/components/ui/PrimaryButton";

type RecordControlProps = {
  isRecording: boolean;
  onStart: () => void;
  onStop: () => void;
};

export default function RecordControl({
  isRecording,
  onStart,
  onStop,
}: RecordControlProps) {
  return (
    <section
      aria-label="녹음 조작"
      className="flex flex-col items-center gap-2 mt-6"
    >
      <PrimaryButton
        onClick={isRecording ? onStop : onStart}
        variant={isRecording ? "danger" : "primary"}
      >
        {isRecording ? "⏹ 녹음 종료" : "🎤 녹음 시작"}
      </PrimaryButton>

      <p className="text-sm text-gray-500">
        {isRecording
          ? "읽기를 마치면 녹음을 종료하세요."
          : "버튼을 누르면 녹음이 시작됩니다."}
      </p>
    </section>
  );
}
