"use client";
import dynamic from "next/dynamic";

const PronunTestClient = dynamic(() => import("@/app/components/PronunTestClient"), { ssr: false });

export default function PronunPage() {
  return (
    <main style={{ padding: 40 }}>
      <h1>🔊 발음 평가 (Pronunciation Test)</h1>
      <p>문장을 듣고 따라 읽어 보세요.</p>
      <PronunTestClient />
    </main>
  );
}
