"use client";

import { Suspense, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { BookOpen, User, Users, Calendar, KeyRound, ArrowRight } from "lucide-react";

function OnboardingPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const asParam = searchParams.get("as");

  const [parentName, setParentName] = useState("");
  const [studentName, setStudentName] = useState("");
  const [birth, setBirth] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [teacherDisplayName, setTeacherDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingRole, setExistingRole] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [termsAgreedAt, setTermsAgreedAt] = useState<string | null>(null);

  // 1. 기존 데이터 불러오기 로직 추가
  useEffect(() => {
    const fetchProfile = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;

      if (!user) {
        alert("로그인이 필요합니다.");
        router.push("/login");
        return;
      }

      // 기존 profiles 데이터 조회
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("parent_name, student_name, birth, role, display_name, terms_agreed_at")
        .eq("id", user.id)
        .maybeSingle();

      if (error) {
        console.error("프로필 불러오기 실패:", error);
      } else if (profile) {
        // 이미 선생님으로 가입 완료된 계정이면 이름을 다시 물을 필요 없이 바로 클래스 관리로 보낸다.
        // (표시 이름 변경은 /teacher/classes에서 처리)
        if (profile.role === "teacher") {
          router.replace("/teacher/classes");
          return;
        }

        // 기존 정보가 있다면 input 상태에 바인딩
        if (profile.parent_name) setParentName(profile.parent_name);
        if (profile.student_name) setStudentName(profile.student_name);
        if (profile.birth) setBirth(profile.birth);
        if (profile.role) setExistingRole(profile.role);
        // 이미 한 번 동의한 이력이 있으면 다시 체크하도록 강제하지 않음
        if (profile.terms_agreed_at) {
          setAgreed(true);
          setTermsAgreedAt(profile.terms_agreed_at);
        }
      }

      setLoading(false);
    };

    fetchProfile();
  }, [router]);

  const isTeacherFlow = !existingRole && asParam === "teacher";

  const isStudentFormValid =
    parentName.trim() !== "" &&
    studentName.trim() !== "" &&
    birth.trim() !== "" &&
    agreed;

  const isTeacherFormValid = teacherDisplayName.trim() !== "" && agreed;

  const joinClassIfNeeded = async (accessToken: string) => {
    if (!joinCode.trim()) return;

    try {
      const res = await fetch("/api/classes/join", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ joinCode: joinCode.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "참여코드로 선생님 연결에 실패했습니다. 나중에 마이페이지에서 다시 시도해 주세요.");
      }
    } catch (err) {
      console.error("클래스 참여 실패:", err);
      alert("참여코드로 선생님 연결에 실패했습니다. 나중에 마이페이지에서 다시 시도해 주세요.");
    }
    // 참여 실패해도 테스트 진행은 막지 않는다 (선생님 소속은 선택사항)
  };

  const handleSaveStudent = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    const user = session?.user;

    if (!user) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        parent_name: parentName,
        student_name: studentName,
        role: existingRole || "student",
        birth,
        email: user.email,
        terms_agreed_at: termsAgreedAt || new Date().toISOString(),
      },
      {
        onConflict: "id",
      }
    );

    if (error) {
      console.error(error);
      alert("정보 저장 중 오류가 발생했습니다.");
      setSaving(false);
      return;
    }

    if (session) {
      await joinClassIfNeeded(session.access_token);
    }

    // 테스트 페이지로 이동
    router.push(`/reading-test?profile_id=${user.id}`);
  };

  const handleSaveTeacher = async () => {
    const { data } = await supabase.auth.getSession();
    const user = data.session?.user;

    if (!user) {
      alert("로그인이 필요합니다.");
      router.push("/login");
      return;
    }

    setSaving(true);

    const { error } = await supabase.from("profiles").upsert(
      {
        id: user.id,
        role: "teacher",
        display_name: teacherDisplayName,
        email: user.email,
        terms_agreed_at: termsAgreedAt || new Date().toISOString(),
      },
      {
        onConflict: "id",
      }
    );

    if (error) {
      console.error(error);
      alert("정보 저장 중 오류가 발생했습니다.");
      setSaving(false);
      return;
    }

    router.push("/teacher/classes");
  };

  const termsCheckbox = (
    <label className="flex items-start gap-2.5 text-xs leading-relaxed text-slate-500">
      <input
        type="checkbox"
        checked={agreed}
        onChange={(e) => setAgreed(e.target.checked)}
        className="mt-0.5 h-4 w-4 flex-shrink-0 rounded border-slate-300 text-indigo-600 focus:ring-indigo-400"
      />
      <span>
        <Link href="/terms" target="_blank" className="font-medium text-slate-700 underline hover:text-slate-900">
          이용약관
        </Link>{" "}
        및{" "}
        <Link href="/privacy" target="_blank" className="font-medium text-slate-700 underline hover:text-slate-900">
          개인정보처리방침
        </Link>
        에 동의합니다. (필수)
      </span>
    </label>
  );

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-slate-500 font-medium">정보를 불러오는 중입니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-900/5">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900">
            <BookOpen className="h-6 w-6 text-white" aria-hidden={true} />
          </span>
          <h1 className="mt-4 text-xl font-bold tracking-tight text-slate-900">
            {isTeacherFlow ? "선생님 정보 입력" : "학생 정보 입력"}
          </h1>
          <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
            {isTeacherFlow
              ? "클래스 관리를 시작하기 전에 표시 이름을 입력해 주세요."
              : "리딩 테스트를 시작하기 전에 기본 정보를 입력해 주세요."}
          </p>
        </div>

        {isTeacherFlow ? (
          <div className="space-y-5">
            <div>
              <label htmlFor="teacherDisplayName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                선생님 표시 이름
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
                <input
                  id="teacherDisplayName"
                  placeholder="예: 김민수 선생님"
                  value={teacherDisplayName}
                  onChange={(e) => setTeacherDisplayName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isTeacherFormValid && !saving) handleSaveTeacher();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            {termsCheckbox}

            {!isTeacherFormValid && (
              <p className="text-xs text-red-500">
                {teacherDisplayName.trim() === ""
                  ? "표시 이름을 입력해야 계속할 수 있습니다."
                  : "이용약관 및 개인정보처리방침에 동의해야 계속할 수 있습니다."}
              </p>
            )}

            <button
              disabled={!isTeacherFormValid || saving}
              onClick={handleSaveTeacher}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장하고 클래스 관리로 이동"}
              {!saving && <ArrowRight className="h-4 w-4" aria-hidden={true} />}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            <div>
              <label htmlFor="parentName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                학부모 이름
              </label>
              <div className="relative">
                <Users className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
                <input
                  id="parentName"
                  placeholder="학부모 이름"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="studentName" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                학생 이름
              </label>
              <div className="relative">
                <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
                <input
                  id="studentName"
                  placeholder="학생 이름"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="birth" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                생년월일
              </label>
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
                <input
                  id="birth"
                  type="date"
                  value={birth}
                  onChange={(e) => setBirth(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
            </div>

            <div>
              <label htmlFor="joinCode" className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">
                선생님 참여코드 (선택)
              </label>
              <div className="relative">
                <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
                <input
                  id="joinCode"
                  placeholder="참여코드가 있다면 입력하세요"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isStudentFormValid && !saving) handleSaveStudent();
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm tracking-[0.15em] text-slate-900 outline-none transition-colors placeholder:tracking-normal placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
                />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                다니는 학원/선생님이 있다면 선생님께 참여코드를 요청해서 입력하세요. 없어도 테스트는 그대로 진행할 수 있어요.
              </p>
            </div>

            {termsCheckbox}

            {!isStudentFormValid && (
              <p className="text-xs text-red-500">
                {!agreed
                  ? "이용약관 및 개인정보처리방침에 동의해야 계속할 수 있습니다."
                  : "모든 정보를 입력해야 테스트를 진행할 수 있습니다."}
              </p>
            )}

            <button
              disabled={!isStudentFormValid || saving}
              onClick={handleSaveStudent}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "저장 중..." : "저장하고 테스트 시작"}
              {!saving && <ArrowRight className="h-4 w-4" aria-hidden={true} />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50" />}>
      <OnboardingPageInner />
    </Suspense>
  );
}
