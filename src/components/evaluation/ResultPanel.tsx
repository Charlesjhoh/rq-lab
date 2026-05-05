// src/components/evaluation/ResultPanel.tsx
"use client";

type Props = {
  audio: Blob | null;
  mode?: "practice" | "quick-check" | "level-test";
};

export default function ResultPanel({ audio, mode = "practice" }: Props) {
  return (
    <section
      aria-label="발음 평가 결과"
      className="flex flex-col gap-6 py-8"
    >
      {/* 결과 헤더 */}
      <header className="text-center">
        <h2 className="text-xl font-semibold">
          발음 평가 결과
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          방금 읽은 문장의 발음 상태를 확인해 보세요.
        </p>
      </header>

      {/* 점수 요약 (더미) */}
      <div className="flex flex-col items-center gap-2 rounded-xl border p-4">
        <p className="text-4xl font-bold text-blue-600">
          82
        </p>
        <p className="text-sm text-gray-600">
          전체 발음 점수
        </p>
      </div>

      {/* 피드백 (더미) */}
      <ul className="space-y-2 text-sm text-gray-700">
        <li>• 강세와 리듬이 비교적 안정적입니다.</li>
        <li>• 일부 단어에서 모음 소리가 약하게 들렸어요.</li>
        <li>• 문장을 끝까지 또렷하게 읽은 점이 좋습니다.</li>
      </ul>

      {/* 신뢰 문구 */}
      <p className="mt-4 text-xs text-gray-400 text-center">
        이 평가는 AI 발음 분석 엔진(Azure Speech)을 사용해 계산되었습니다.
      </p>

      {/* 디버그용 정보 (나중에 제거 가능) */}
      {audio && (
        <p className="text-xs text-gray-400 text-center">
          녹음 파일 생성 완료 ({Math.round(audio.size / 1024)} KB)
        </p>
      )}
    </section>
  );
}
