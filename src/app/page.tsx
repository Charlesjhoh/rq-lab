"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import {
  Sparkles,
  BookOpen,
  Gauge,
  Compass,
  Gift,
  Megaphone,
  ArrowRight,
  Rocket,
  CheckCircle2,
} from "lucide-react";

export default function HomePage() {
  const router = useRouter();

  const [showForm, setShowForm] = useState(false);
  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [birth, setBirth] = useState("");

  useEffect(() => {
    const loadUserProfile = async () => {
      const { data } = await supabase.auth.getUser();
      const user = data.user;

      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("parent_name, student_name, birth")
        .eq("id", user.id)
        .maybeSingle();

      if (profile) {
        setParentName(profile.parent_name || "");
        setStudentName(profile.student_name || "");
        setBirth(profile.birth || "");
      }
    };

    loadUserProfile();
  }, []);

  return (
    <div className="-m-5 min-h-screen bg-slate-50 p-4 font-sans text-slate-900 md:p-8">
      <main className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-5xl flex-col items-center justify-center gap-10 lg:flex-row lg:items-stretch lg:gap-12">
        {/* ==================== Left: Hero + Feature cards ==================== */}
        <section className="flex w-full flex-col justify-center lg:w-1/2">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-600 ring-1 ring-inset ring-indigo-100">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            AI Diagnosis Engine v2.4
          </span>

          <h1 className="mt-6 text-balance text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            AI가 분석하는
            <br />
            영어 원서 읽기 진단
          </h1>

          <p className="mt-4 max-w-md text-pretty text-base leading-relaxed text-slate-600">
            아이의 영어 원서 읽기 수준을 AI가 정밀하게 분석하고, 결과를 바탕으로
            맞춤 도서와 학습 방향을 제안해드립니다.
          </p>

          {/* Feature cards */}
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FeatureCard
              icon={Gauge}
              title="정밀 레벨 진단"
              description="AI가 읽기 수준을 세밀하게 측정합니다."
            />
            <FeatureCard
              icon={BookOpen}
              title="맞춤 도서 추천"
              description="진단 결과 기반 최적의 원서를 제안합니다."
            />
            <FeatureCard
              icon={Compass}
              title="학습 방향 제안"
              description="다음 단계 성장 로드맵을 안내합니다."
            />
            <FeatureCard
              icon={Gift}
              title="무료 베타 제공"
              description="지금은 리딩 진단을 무료로 이용할 수 있어요."
            />
          </div>
        </section>

        {/* ==================== Right: Form card ==================== */}
        <section className="flex w-full flex-col justify-center lg:w-1/2 lg:max-w-md">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                <BookOpen className="h-5 w-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Reading App</h2>
                <p className="text-sm text-slate-500">무료 리딩 진단 테스트</p>
              </div>
            </div>

            {/* Beta notice */}
            <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
              <div className="flex items-center gap-2 text-indigo-700">
                <Megaphone className="h-4 w-4" aria-hidden="true" />
                <span className="text-xs font-semibold uppercase tracking-wider">
                  베타 테스트 안내
                </span>
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-indigo-900/80">
                <p>현재 무료로 리딩 진단 테스트를 제공하고 있습니다.</p>
                <p>테스트 결과를 기반으로 맞춤 도서와 학습 방향을 제안합니다.</p>
              </div>
              <p className="mt-4 border-t border-indigo-100 pt-3 text-xs text-indigo-700/70">
                ※ 일부 기능은 테스트 단계로 제한될 수 있습니다
              </p>
            </div>

            {/* First entry button */}
            {!showForm && (
              <button
                onClick={async () => {
                  const {
                    data: { user },
                  } = await supabase.auth.getUser();
                  if (!user) {
                    router.push("/login");
                    return;
                  }
                  setShowForm(true);
                }}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:ring-offset-2"
              >
                무료 테스트 시작하기
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            )}

            {/* Form */}
            {showForm && (
              <div className="mt-6 flex flex-col gap-4">
                <Field
                  label="학부모 이름"
                  placeholder="이름을 입력하세요"
                  value={parentName}
                  onChange={setParentName}
                />
                <Field
                  label="학생 이름"
                  placeholder="이름을 입력하세요"
                  value={studentName}
                  onChange={setStudentName}
                />
                <Field
                  label="생년월일"
                  placeholder="예: 2015-03-21"
                  value={birth}
                  onChange={setBirth}
                />

                <button
                  onClick={async () => {
                    const {
                      data: { user },
                    } = await supabase.auth.getUser();

                    if (!user) {
                      alert("로그인 후 이용해주세요");
                      router.push("/login");
                      return;
                    }

                    if (!parentName || !studentName || !birth) {
                      alert("모든 정보를 입력해주세요");
                      return;
                    }

                    const { data, error } = await supabase
                      .from("profiles")
                      .upsert(
                        {
                          id: user.id,
                          student_name: studentName,
                          parent_name: parentName,
                          birth: birth,
                        },
                        {
                          onConflict: "id",
                        }
                      )
                      .select()
                      .single();

                    if (error) {
                      console.error("❌ DB 에러:", error);
                      alert("저장 실패");
                      return;
                    }

                    if (!data) {
                      console.error("❌ data 없음");
                      alert("데이터 없음");
                      return;
                    }

                    router.push(`/reading-test?profile_id=${data.id}`);
                  }}
                  className="mt-1 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 py-3.5 text-base font-semibold text-white shadow-sm transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2"
                >
                  <Rocket className="h-4 w-4" aria-hidden="true" />
                  정보 저장하고 테스트 시작하기
                </button>
              </div>
            )}

            <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
              결과 저장 및 리포트 확인을 위해 로그인이 필요합니다
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-3 text-sm font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-medium text-slate-700">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-400 transition-all focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/25"
      />
    </div>
  );
}
