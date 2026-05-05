// src/components/evaluation/NextActionBar.tsx
"use client";

type Props = {
  onRetry: () => void;
  onNext?: () => void;
};

export default function NextActionBar({ onRetry, onNext }: Props) {
  return (
    <section
      aria-label="다음 행동"
      className="mt-6 flex items-center justify-center gap-3"
    >
      <button
        onClick={onRetry}
        className="px-5 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-100 transition"
      >
        🔁 다시 읽기
      </button>

      {onNext && (
        <button
          onClick={onNext}
          className="px-5 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 transition"
        >
          ➡️ 다음으로
        </button>
      )}
    </section>
  );
}
