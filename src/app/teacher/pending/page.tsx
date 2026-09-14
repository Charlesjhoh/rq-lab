"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { Clock3, LogOut, XCircle } from "lucide-react";

export default function TeacherPendingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<"pending" | "rejected" | null>(null);

  const checkStatus = async () => {
    setLoading(true);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, teacher_status")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile || profile.role !== "teacher") {
      router.push("/");
      return;
    }

    if (profile.teacher_status === "approved") {
      router.replace("/teacher/classes");
      return;
    }

    setStatus(profile.teacher_status === "rejected" ? "rejected" : "pending");
    setLoading(false);
  };

  useEffect(() => {
    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace("/login");
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
      </div>
    );
  }

  const isRejected = status === "rejected";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md overflow-hidden rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5">
        <span
          className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl ${
            isRejected ? "bg-red-100" : "bg-amber-100"
          }`}
        >
          {isRejected ? (
            <XCircle className="h-7 w-7 text-red-600" aria-hidden={true} />
          ) : (
            <Clock3 className="h-7 w-7 text-amber-600" aria-hidden={true} />
          )}
        </span>

        <h1 className="mt-5 text-xl font-bold tracking-tight text-slate-900">
          {isRejected ? "승인이 거절되었습니다" : "선생님 계정 승인 대기 중"}
        </h1>

        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          {isRejected
            ? "가입 신청이 거절되었습니다. 문의사항이 있다면 운영팀에 연락해 주세요."
            : "관리자가 가입 신청을 확인하고 있습니다. 승인이 완료되면 클래스 관리 기능을 이용하실 수 있어요."}
        </p>

        <div className="mt-6 flex flex-col gap-2">
          {!isRejected && (
            <button
              onClick={checkStatus}
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
            >
              승인 상태 새로고침
            </button>
          )}
          <button
            onClick={handleLogout}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" aria-hidden={true} />
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
