"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  User,
  Flame,
  BookOpen,
  Timer,
  Target,
  Brain,
  MessageSquare,
  Calendar,
  Sparkles,
  ArrowRight,
} from "lucide-react";

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

  if (!userId)
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-8 py-6 text-center shadow-sm">
          <p className="text-sm font-medium text-slate-600">로그인이 필요합니다</p>
        </div>
      </div>
    );

  const latest = results[0];

  return (
    <div className="min-h-screen w-full bg-slate-50 px-4 py-10 sm:py-14">
      <div className="mx-auto w-full max-w-3xl space-y-5">
        {/* Header */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 to-slate-800 shadow-sm">
          <div className="px-6 py-8 sm:px-10">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-300">
              <BarChart3 className="h-4 w-4" aria-hidden={true} />
              Reading Report
            </div>
            <h2 className="mt-3 text-2xl font-semibold text-white sm:text-3xl text-balance">
              리포트
            </h2>
            {profile?.student_name && (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-sm font-medium text-white">
                <User className="h-4 w-4 text-indigo-300" aria-hidden={true} />
                {profile.student_name}
              </div>
            )}
          </div>
        </div>

        {/* ✅ 최신 결과 */}
        {latest && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5 sm:px-10">
              <Flame className="h-5 w-5 text-orange-500" aria-hidden={true} />
              <h3 className="text-base font-semibold text-slate-900">최신 결과</h3>
            </div>

            <div className="px-6 py-6 sm:px-10">
              <div className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 px-6 py-5">
                <span className="text-sm font-medium uppercase tracking-widest text-indigo-300">
                  AR Level
                </span>
                <span className="text-3xl font-bold text-white tabular-nums">
                  {latest.final_ar.toFixed(1)}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <Timer className="h-4 w-4" aria-hidden={true} />
                    속도
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                    {Math.round(latest.wpm)}
                    <span className="ml-1 text-sm font-normal text-slate-400">WPM</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <Target className="h-4 w-4" aria-hidden={true} />
                    정확도
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                    {Math.round(latest.accuracy)}
                    <span className="ml-0.5 text-sm font-normal text-slate-400">%</span>
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <Brain className="h-4 w-4" aria-hidden={true} />
                    이해도
                  </div>
                  <p className="mt-2 text-2xl font-semibold text-slate-900 tabular-nums">
                    {Math.round(latest.comprehension)}
                    <span className="ml-0.5 text-sm font-normal text-slate-400">%</span>
                  </p>
                </div>
              </div>

              {latest.ai_comment && (
                <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                  <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500">
                    <MessageSquare className="h-4 w-4" aria-hidden={true} />
                    코멘트
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">
                    {latest.ai_comment}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ✅ CTA */}
        <div className="overflow-hidden rounded-3xl border border-amber-200 bg-amber-50 shadow-sm">
          <div className="px-6 py-6 sm:px-10">
            <p className="text-base font-semibold text-amber-900">
              지금 상태로 계속 읽히고 계신가요?
            </p>
            <p className="mt-2 text-sm leading-relaxed text-amber-800">
              아이의 읽기 문제는 책 선택과 학습 방법에서 시작됩니다.
            </p>

            <button
              onClick={() => {
                const id = results?.[0]?.id;
                if (!id) return;

                router.push(`/premium-report?result_id=${id}`);
              }}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-orange-600 sm:w-auto"
            >
              <Sparkles className="h-4 w-4" aria-hidden={true} />
              우리 아이 수준에 맞는 정확한 훈련 방법 보기
            </button>
          </div>
        </div>

        {/* ✅ 이전 기록 */}
        {results.length > 1 && (
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-center gap-2 border-b border-slate-100 px-6 py-5 sm:px-10">
              <BarChart3 className="h-5 w-5 text-indigo-500" aria-hidden={true} />
              <h3 className="text-base font-semibold text-slate-900">이전 기록</h3>
            </div>

            <div className="space-y-3 px-6 py-6 sm:px-10">
              {results.slice(1).map((d, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-slate-200 bg-slate-50 p-4 transition-colors hover:border-slate-300"
                >
                  <p className="flex items-center gap-2 text-xs font-medium text-slate-500">
                    <Calendar className="h-4 w-4" aria-hidden={true} />
                    {new Date(d.created_at).toLocaleString("ko-KR", {
                      timeZone: "Asia/Seoul",
                    })}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <BookOpen className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                      AR {d.final_ar.toFixed(1)}
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Timer className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                      {Math.round(d.wpm)} WPM
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Target className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                      {Math.round(d.accuracy)}%
                    </span>
                    <span className="flex items-center gap-1.5 text-slate-700">
                      <Brain className="h-4 w-4 text-indigo-500" aria-hidden={true} />
                      {Math.round(d.comprehension)}%
                    </span>
                  </div>

                  <button
                    onClick={() => {
                      alert("베타 기간 동안 프리미엄 리포트를 무료로 제공합니다.");
                      router.push(`/premium-report?result_id=${d.id}`);
                    }}
                    className="mt-4 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                  >
                    이 결과 분석 보기
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden={true} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
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
