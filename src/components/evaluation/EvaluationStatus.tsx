// src/components/evaluation/EvaluationStatus.tsx
"use client";

export default function EvaluationStatus() {
  return (
    <section
      aria-label="발음 분석 중"
      className="flex flex-col items-center justify-center gap-4 py-10"
    >
      {/* 로딩 아이콘 */}
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-gray-300 border-t-blue-500" />

      {/* 상태 문구 */}
      <p className="text-lg font-medium text-gray-800">
        발음을 분석 중입니다
      </p>
      <p className="text-sm text-gray-500">
        잠시만 기다려 주세요.
      </p>
    </section>
  );
}
