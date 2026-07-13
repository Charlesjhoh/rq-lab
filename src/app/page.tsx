"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import {
  Sparkles,
  Gauge,
  Target,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  Rocket,
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
    <div className="-m-5 min-h-screen overflow-y-auto bg-gradient-to-br from-white via-slate-50 to-indigo-50 font-sans text-slate-900">
      <div className="mx-auto flex min-h-screen w-full max-w-xl flex-col items-center justify-center px-4 py-10">
        {/* ─── Part 1: Service intro card ─── */}
        <section className="w-full rounded-3xl border border-white/60 bg-white/70 p-8 text-center shadow-xl shadow-slate-900/5 backdrop-blur-md">
          <span className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
            <Sparkles className="h-3.5 w-3.5" aria-hidden={true} />
            Free Beta v2.4
          </span>

          <h1 className="mb-4 text-balance text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
            AI Reading Assessment
          </h1>
          <p className="mx-auto mb-8 max-w-md text-pretty text-base leading-relaxed text-slate-500">
            AI가 아이의 영어 읽기를 3분 안에 정밀 분석합니다. 잠재력을 발견해
            보세요.
          </p>

          {/* Minimal dashboard metric cards */}
          <div className="grid grid-cols-1 gap-3 text-left sm:grid-cols-2">
            <MetricCard
              icon={Gauge}
              label="Reading Speed"
              value="WPM 측정"
            />
            <MetricCard icon={Target} label="Accuracy" value="발음 정확도" />
            <MetricCard
              icon={BookOpen}
              label="Estimated AR"
              value="리딩 레벨 산정"
            />
            <MetricCard
              icon={Sparkles}
              label="Comprehension"
              value="이해도 진단"
            />
          </div>
        </section>

        {/* ─── Divider ─── */}
        <div className="my-8 w-full border-t-2 border-dashed border-slate-200/60" />

        {/* ─── Part 2: Entry trigger / input card ─── */}
        {!showForm ? (
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
            className="group flex h-[72px] w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 text-xl font-bold text-white shadow-lg transition-all hover:-translate-y-0.5 hover:bg-indigo-700 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/60 focus:ring-offset-2"
          >
            <span>무료 테스트 시작하기</span>
            <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" aria-hidden={true} />
          </button>
        ) : (
          <div className="flex w-full flex-col gap-4 rounded-3xl border border-slate-200/60 bg-white p-6 shadow-xl shadow-slate-900/5 duration-500 animate-in fade-in slide-in-from-bottom-4">
            <div className="border-b border-slate-100 pb-2 text-center">
              <h2 className="text-lg font-bold text-slate-800">
                Student Information
              </h2>
            </div>

            <Field
              label="Parent Name"
              placeholder="학부모 성함을 입력하세요"
              value={parentName}
              onChange={setParentName}
            />
            <Field
              label="Student Name"
              placeholder="학생 이름을 입력하세요"
              value={studentName}
              onChange={setStudentName}
            />
            <Field
              label="Birth Date"
              type="date"
              value={birth}
              onChange={setBirth}
            />
          </div>
        )}

        {/* ─── Part 3: Final submit section ─── */}
        {showForm && (
          <>
            <div className="my-8 w-full border-t-2 border-dashed border-slate-200/60" />
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
              className="flex h-[72px] w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 text-xl font-bold text-white shadow-xl transition-all hover:-translate-y-0.5 hover:bg-emerald-400 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-emerald-300/60 focus:ring-offset-2"
            >
              <Rocket className="h-5 w-5" aria-hidden={true} />
              <span>정보 저장하고 테스트 시작하기</span>
            </button>
          </>
        )}

        {/* Footer security notice */}
        <div className="mt-8 flex items-center gap-1.5 text-xs text-slate-400">
          <ShieldCheck className="h-4 w-4 text-slate-400" aria-hidden={true} />
          <span>결과 저장 및 리포트 확인을 위해 로그인이 필요합니다.</span>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
      <div className="rounded-xl bg-white p-2 text-indigo-600 shadow-sm">
        <Icon className="h-4 w-4" aria-hidden={true} />
      </div>
      <div>
        <p className="text-xs font-medium text-slate-400">{label}</p>
        <p className="text-sm font-semibold text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function Field({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <div className="flex flex-col gap-2 px-2 py-1 sm:flex-row sm:items-center sm:gap-4">
      <label className="text-sm font-semibold text-slate-500 sm:w-28 sm:text-right">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 shadow-sm transition-all placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 ${
          type === "date" ? "text-center" : "text-center sm:text-left"
        }`}
      />
    </div>
  );
}
