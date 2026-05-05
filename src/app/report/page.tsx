"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";

function ClientPart() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const paramUserId = searchParams.get("user_id");
//  const profileId = searchParams.get("profile_id");

  const [userId, setUserId] = useState<string | null>(paramUserId);
  const [results, setResults] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);

  useEffect(() => {
    const init = async () => {
      let finalUserId = paramUserId;

      // 👉 없으면 session에서 가져오기
      if (!finalUserId) {
        const { data } = await supabase.auth.getSession();
        finalUserId = data.session?.user?.id || null;
      }

      if (!finalUserId) return;

      setUserId(finalUserId);

      // 👉 프로필
      const { data: p } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", finalUserId)
        .single();

      if (p) setProfile(p);

      // 👉 결과
      const { data: r } = await supabase
        .from("reading_results")
        .select("*")
        .eq("profile_id", finalUserId)
        .order("created_at", { ascending: false });

      if (r) setResults(r);
    };

    init();
  }, [paramUserId]);

  if (!userId) return <div>로그인이 필요합니다</div>;
const latest = results[0];

return (
  <div style={{ padding: 20, maxWidth: 800, margin: "0 auto" }}>
    <h2>📊 리포트</h2>

    <p>👤 {profile?.student_name}</p>

    {/* ✅ 최신 결과 */}
    {latest && (
      <div style={{ border: "2px solid #333", padding: 16, marginTop: 20 }}>
        <h3>🔥 최신 결과</h3>
        <p>📘 AR: {latest.final_ar.toFixed(1)}</p>
        <p>⚡ 속도: {Math.round(latest.wpm)} WPM</p>
        <p>🎯 정확도: {Math.round(latest.accuracy)}%</p>
        <p>📚 이해도: {Math.round(latest.comprehension)}%</p>
        <p>💬 코멘트: {latest.ai_comment}</p>
      </div>
    )}

    {/* ✅ CTA */}
    <div style={{ marginTop: 30, padding: 20, background: "#fff3cd" }}>
      <p><b>👉 지금 상태로 계속 읽히고 계신가요?</b></p>
      <p>
        아이의 읽기 문제는<br />
        책 선택과 학습 방법에서 시작됩니다.
      </p>

      <button
          onClick={() => {
            const id = results?.[0]?.id;
            if (!id) return;

            router.push(`/premium-report?result_id=${id}`);
          }}
        style={{
          marginTop: 10,
          padding: "12px 16px",
          background: "#ff5722",
          color: "white",
          border: "none",
          cursor: "pointer"
        }}
      >
        👉 맞춤 추천 + 학습 전략 보기
      </button>
    </div>

    {/* ✅ 이전 기록 */}
    {results.length > 1 && (
      <div style={{ marginTop: 30 }}>
        <h3>📊 이전 기록</h3>

        {results.slice(1).map((d, i) => (
          <div
            key={i}
            style={{
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
              background: "#fafafa",
            }}
          >
            <p>📅 {new Date(d.created_at).toLocaleDateString()}</p>
            <p>📘 AR: {d.final_ar.toFixed(1)}</p>
            <p>⚡ 속도: {Math.round(d.wpm)} WPM</p>
            <p>🎯 정확도: {Math.round(d.accuracy)}%</p>
            <p>📚 이해도: {Math.round(d.comprehension)}%</p>
            <button
              onClick={() =>
                router.push(`/premium-report?result_id=${d.id}`)
              }
              style={{
                marginTop: 8,
                padding: "6px 10px",
                fontSize: 12,
                background: "#ff5722",
                color: "white",
                border: "none",
                cursor: "pointer"
              }}
            >
              👉 이 결과 분석 보기
            </button>
          </div>
          
        ))}

      </div>
    )}
  </div>
);
}

export default function ReportPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ClientPart />
    </Suspense>
  );
}