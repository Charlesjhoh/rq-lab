"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";

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
    <main className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Gradient background */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
      >
        <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950" />
        <div className="absolute -top-40 -left-32 h-[28rem] w-[28rem] rounded-full bg-indigo-600/20 blur-3xl" />
        <div className="absolute bottom-[-10rem] right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-sky-500/20 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)",
            backgroundSize: "56px 56px",
          }}
        />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center justify-center gap-12 px-6 py-16 lg:flex-row lg:items-stretch lg:gap-16 lg:py-24">
        {/* ==================== Left: Hero + Feature cards ==================== */}
        <section className="flex w-full max-w-xl flex-col justify-center lg:w-1/2">
          <span className="inline-flex w-fit items-center gap-2 rounded-full border border-indigo-400/30 bg-indigo-500/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-indigo-300">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-400" />
            AI Diagnosis Engine v2.4
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight text-white text-balance sm:text-5xl">
            AI가 분석하는
            <br />
            영어 원서 읽기 진단
          </h1>

          <p className="mt-5 max-w-md text-lg leading-relaxed text-slate-300 text-pretty">
            아이의 영어 원서 읽기 수준을 AI가 정밀하게 분석하고, 결과를 바탕으로
            맞춤 도서와 학습 방향을 제안해드립니다.
          </p>

          {/* Feature cards */}
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FeatureCard
              title="정밀 레벨 진단"
              description="AI가 읽기 수준을 세밀하게 측정합니다."
            />
            <FeatureCard
              title="맞춤 도서 추천"
              description="진단 결과 기반 최적의 원서를 제안합니다."
            />
            <FeatureCard
              title="학습 방향 제안"
              description="다음 단계 성장 로드맵을 안내합니다."
            />
            <FeatureCard
              title="무료 베타 제공"
              description="지금은 리딩 진단을 무료로 이용할 수 있어요."
            />
          </div>
        </section>

        {/* ==================== Right: Glass card ==================== */}
        <section className="flex w-full max-w-md flex-col justify-center lg:w-1/2">
          <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-500/20 text-2xl">
                📘
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Reading App</h2>
                <p className="text-sm text-slate-400">무료 리딩 진단 테스트</p>
              </div>
            </div>

            {/* Beta notice */}
            <div className="mt-8 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center gap-2">
                <span className="text-base">📢</span>
                <b className="text-sm font-semibold text-white">
                  베타 테스트 안내
                </b>
              </div>
              <div className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
                <p>현재 무료로 리딩 진단 테스트를 제공하고 있습니다.</p>
                <p>테스트 결과를 기반으로 맞춤 도서와 학습 방향을 제안합니다.</p>
              </div>
              <p className="mt-4 border-t border-white/10 pt-4 text-xs text-slate-400">
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
                className="mt-8 w-full rounded-2xl bg-indigo-600 py-4 text-base font-semibold text-white shadow-lg shadow-indigo-900/40 transition-all duration-200 hover:bg-indigo-500 hover:shadow-indigo-700/40 focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:ring-offset-2 focus:ring-offset-slate-900"
              >
                👉 무료 테스트 시작하기
              </button>
            )}

            {/* Form */}
            {showForm && (
              <div className="mt-8 flex flex-col gap-5">
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
                  className="mt-2 w-full rounded-2xl bg-emerald-500 py-4 text-base font-semibold text-white shadow-lg shadow-emerald-900/40 transition-all duration-200 hover:bg-emerald-400 hover:shadow-emerald-700/40 focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2 focus:ring-offset-slate-900"
                >
                  🚀 정보 저장하고 테스트 시작하기
                </button>
              </div>
            )}

            <p className="mt-6 text-center text-xs text-slate-400">
              ※ 결과 저장 및 리포트 확인을 위해 로그인이 필요합니다
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

function FeatureCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition-colors hover:border-white/20 hover:bg-white/[0.07]">
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1.5 text-sm leading-6 text-slate-400">{description}</p>
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
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-slate-200">{label}</label>
      <input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3.5 text-base text-white placeholder:text-slate-500 transition-all focus:border-indigo-400/60 focus:bg-white/[0.06] focus:outline-none focus:ring-2 focus:ring-indigo-400/25"
      />
    </div>
  );
}
