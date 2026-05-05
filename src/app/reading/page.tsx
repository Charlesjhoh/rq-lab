"use client";
import dynamic from "next/dynamic";

const ReadingLevelClient = dynamic(
  () => import("@/app/components/ReadingLevelClient"),
  { ssr: false }
);

export default function QuickReadingPage() {
  return (
    <main
      style={{
        padding: 40,
        fontFamily: "system-ui",
        background: "#fafafa",
        maxWidth: 900,
        margin: "0 auto",
      }}
    >
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>📘 AR 레벨 간이 테스트 (Quick)</h1>
      <p style={{ color: "#555", marginBottom: 30 }}>
        1~2문장만 읽고 현재 영어 원서 리딩 레벨을 빠르게 예측해보세요.
      </p>

      <section
        style={{
          border: "1.5px solid #ddd",
          borderRadius: 12,
          background: "#fff",
          padding: 24,
          boxShadow: "2px 3px 6px rgba(0,0,0,0.05)",
        }}
      >
        <p style={{ color: "#666", marginBottom: 16 }}>
          🎤 마이크 사용을 허용한 뒤, 아래 문장을 소리 내어 읽어보세요.
        </p>

        {/* 핵심 테스트 컴포넌트 */}
        <ReadingLevelClient />

        <div style={{ marginTop: 20, textAlign: "center", color: "#666" }}>
          <p style={{ fontSize: 13 }}>
            ⚙️ 정확한 결과를 위해 조용한 환경에서 녹음하세요.
          </p>
        </div>
      </section>
    </main>
  );
}
