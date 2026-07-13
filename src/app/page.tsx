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
  ShieldCheck,
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
    <div className="-m-5 min-h-screen bg-slate-50 font-sans text-slate-900">
      {/* ==================== Hero (dark gradient) ==================== */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-indigo-950 to-slate-900">
        {/* soft glow accents */}
        <div
          className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-indigo-500/20 blur-3xl"
          aria-hidden={true}
        />
        <div
          className="pointer-events-none absolute -right-16 top-16 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl"
          aria-hidden={true}
        />

        <div className="mx-auto w-full max-w-[1200px] px-6 pb-20 pt-16 md:px-10 md:pb-28 md:pt-24">
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-indigo-200 ring-1 ring-inset ring-white/15 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden={true} />
            AI Diagnosis Engine v2.4
          </span>

          <h1 className="mt-6 max-w-3xl text-balance text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl md:text-6xl">
            AI가 분석하는
            <br />
            <span className="bg-gradient-to-r from-indigo-300 to-emerald-200 bg-clip-text text-transparent">
              영어 원서 읽기 진단
            </span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-slate-300 md:text-lg">
            아이의 영어 원서 읽기 수준을 AI가 정밀하게 분석하고, 결과를 바탕으로
            맞춤 도서와 학습 방향을 제안해드립니다.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" aria-hidden={true} />
              무료 베타 진행 중
            </span>
            <span className="inline-flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-indigo-300" aria-hidden={true} />
              안전한 결과 저장
            </span>
          </div>
        </div>
      </section>

      {/* ==================== Main content ==================== */}
      <main className="mx-auto -mt-12 w-full max-w-[1200px] px-6 pb-16 md:-mt-16 md:px-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          {/* ---------- Left: Feature cards ---------- */}
          <section className="order-2 lg:order-1 lg:pt-4">
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              무엇을 제공하나요?
            </h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              진단부터 성장 로드맵까지, 한 번에 확인할 수 있습니다.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
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

          {/* ---------- Right: Form card ---------- */}
          <section className="order-1 lg:order-2">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <BookOpen className="h-5 w-5" aria-hidden={true} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Reading App</h2>
                  <p className="text-sm text-slate-500">무료 리딩 진단 테스트</p>
                </div>
              </div>

              {/* Beta notice */}
              <div className="mt-6 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-5">
                <div className="flex items-center gap-2 text-indigo-700">
                  <Megaphone className="h-4 w-4" aria-hidden={true} />
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
                  <ArrowRight className="h-4 w-4" aria-hidden={true} />
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
                    <Rocket className="h-4 w-4" aria-hidden={true} />
                    정보 저장하고 테스트 시작하기
                  </button>
                </div>
              )}

              <p className="mt-5 flex items-center justify-center gap-1.5 text-center text-xs text-slate-400">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden={true} />
                결과 저장 및 리포트 확인을 위해 로그인이 필요합니다
              </p>
            </div>
          </section>
        </div>
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
    <div className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md">
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 transition-colors group-hover:bg-indigo-100">
        <Icon className="h-5 w-5" aria-hidden={true} />
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
