"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import {
  Users,
  BarChart3,
  Plus,
  Copy,
  CreditCard,
  Settings,
  School,
  Pencil,
  Check,
  X,
} from "lucide-react";

type ClassRow = {
  id: string;
  name: string;
  join_code: string;
  created_at: string;
};

type Subscription = {
  seat_count: number;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
} | null;

type Student = {
  id: string;
  class_id: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  active: "구독 중",
  trialing: "체험 중",
  past_due: "결제 지연",
  canceled: "해지됨",
  incomplete: "결제 대기",
  none: "구독 없음",
};

async function authedFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("로그인이 필요합니다.");

  return fetch(path, {
    ...options,
    headers: {
      ...(options.headers || {}),
      Authorization: `Bearer ${session.access_token}`,
    },
  });
}

function TeacherClassesPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [students, setStudents] = useState<Student[]>([]);

  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);

  const [seatInput, setSeatInput] = useState("5");
  const [seatBusy, setSeatBusy] = useState(false);

  const [currentTeacher, setCurrentTeacher] = useState<{ id: string; displayName: string | null; email: string | null } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    const checkoutStatus = searchParams.get("checkout");
    if (checkoutStatus === "success") {
      alert("결제가 완료되었습니다. 반영까지 잠시 걸릴 수 있어요.");
      router.replace("/teacher/classes");
    } else if (checkoutStatus === "cancel") {
      alert("결제가 취소되었습니다.");
      router.replace("/teacher/classes");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
          alert("로그인이 필요합니다.");
          router.push("/login");
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("role, display_name, email")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile || profile.role !== "teacher") {
          alert("접근 권한이 없습니다. 선생님 계정으로 로그인해 주세요.");
          router.push("/");
          return;
        }

        setCurrentTeacher({
          id: user.id,
          displayName: profile.display_name,
          email: profile.email || user.email || null,
        });
        setNameInput(profile.display_name || "");

        await loadData();
      } catch (err) {
        console.error(err);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const loadData = async () => {
    const [classesRes, studentsRes] = await Promise.all([
      authedFetch("/api/teacher/classes"),
      authedFetch("/api/teacher/students"),
    ]);

    if (classesRes.ok) {
      const data = await classesRes.json();
      setClasses(data.classes || []);
      setSubscription(data.subscription || null);
      if (data.subscription?.seat_count) {
        setSeatInput(String(data.subscription.seat_count));
      }
    }

    if (studentsRes.ok) {
      const data = await studentsRes.json();
      setStudents(data.students || []);
    }
  };

  const usedSeats = students.length;
  const seatCount = subscription?.seat_count || 0;
  const hasActiveSubscription = subscription && ["active", "trialing", "past_due"].includes(subscription.status);

  const studentCountByClass = (classId: string) => students.filter((s) => s.class_id === classId).length;

  const handleCreateClass = async () => {
    if (!newClassName.trim()) return;
    setCreating(true);
    try {
      const res = await authedFetch("/api/teacher/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newClassName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "클래스 생성에 실패했습니다.");
        return;
      }

      setNewClassName("");
      await loadData();
    } catch (err) {
      console.error(err);
      alert("클래스 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const handlePurchaseSeats = async () => {
    const seats = Number(seatInput);
    if (!Number.isInteger(seats) || seats < 1) {
      alert("좌석 수를 올바르게 입력해 주세요.");
      return;
    }

    setSeatBusy(true);
    try {
      const res = await authedFetch("/api/subscriptions/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatCount: seats }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "결제 요청에 실패했습니다.");
        return;
      }

      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("결제 요청 중 오류가 발생했습니다.");
    } finally {
      setSeatBusy(false);
    }
  };

  const handleUpdateSeats = async () => {
    const seats = Number(seatInput);
    if (!Number.isInteger(seats) || seats < 1) {
      alert("좌석 수를 올바르게 입력해 주세요.");
      return;
    }

    setSeatBusy(true);
    try {
      const res = await authedFetch("/api/subscriptions/update-seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seatCount: seats }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "좌석 변경에 실패했습니다.");
        return;
      }

      alert("좌석이 변경되었습니다.");
      await loadData();
    } catch (err) {
      console.error(err);
      alert("좌석 변경 중 오류가 발생했습니다.");
    } finally {
      setSeatBusy(false);
    }
  };

  const handleOpenPortal = async () => {
    try {
      const res = await authedFetch("/api/subscriptions/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "결제 관리 페이지를 열 수 없습니다.");
        return;
      }
      window.location.href = data.url;
    } catch (err) {
      console.error(err);
      alert("결제 관리 페이지를 여는 중 오류가 발생했습니다.");
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      alert(`참여코드 "${code}"가 복사되었습니다.`);
    } catch {
      alert(`참여코드: ${code}`);
    }
  };

  const handleSaveName = async () => {
    if (!currentTeacher || !nameInput.trim()) return;
    setSavingName(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: nameInput.trim() })
        .eq("id", currentTeacher.id);

      if (error) {
        alert("이름 저장에 실패했습니다.");
        return;
      }

      setCurrentTeacher({ ...currentTeacher, displayName: nameInput.trim() });
      setEditingName(false);
    } catch (err) {
      console.error(err);
      alert("이름 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingName(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-slate-500 font-medium">클래스 정보를 불러오고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-600">
            <BarChart3 className="h-4 w-4" aria-hidden={true} />
            Teacher Dashboard
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">클래스 관리</h1>
          {currentTeacher && !editingName && (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
              선생님{" "}
              <span className="font-medium text-slate-700">
                {currentTeacher.displayName || currentTeacher.email || "이름 없음"}
              </span>
              {" "}로 로그인됨
              {currentTeacher.displayName && currentTeacher.email && (
                <span className="text-slate-400"> · {currentTeacher.email}</span>
              )}
              <button
                onClick={() => {
                  setNameInput(currentTeacher.displayName || "");
                  setEditingName(true);
                }}
                className="ml-1 inline-flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-600"
              >
                <Pencil className="h-3 w-3" aria-hidden={true} />
                이름 변경
              </button>
            </p>
          )}
          {currentTeacher && editingName && (
            <div className="mt-2 flex items-center gap-2">
              <input
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && nameInput.trim() && !savingName) handleSaveName();
                  if (e.key === "Escape") setEditingName(false);
                }}
                autoFocus
                className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                onClick={handleSaveName}
                disabled={savingName || !nameInput.trim()}
                className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                <Check className="h-3.5 w-3.5" aria-hidden={true} />
                저장
              </button>
              <button
                onClick={() => setEditingName(false)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
              >
                <X className="h-3.5 w-3.5" aria-hidden={true} />
                취소
              </button>
            </div>
          )}
        </div>

        {/* 좌석 사용 현황 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CreditCard className="h-4 w-4 text-indigo-500" aria-hidden={true} />
            좌석 사용 현황
          </h3>

          {!hasActiveSubscription ? (
            <div className="mt-3 space-y-3">
              <p className="text-sm text-slate-500">아직 구매한 좌석이 없습니다. 좌석 수를 정해서 구독을 시작하세요.</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={seatInput}
                  onChange={(e) => setSeatInput(e.target.value)}
                  className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  onClick={handlePurchaseSeats}
                  disabled={seatBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {seatBusy ? "이동 중..." : "좌석 구매하기"}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-100 px-3 py-1 font-medium text-indigo-700">
                  사용중 {usedSeats} / {seatCount}석
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600">
                  {STATUS_LABELS[subscription!.status] || subscription!.status}
                </span>
                {subscription?.cancel_at_period_end && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 font-medium text-amber-700">
                    기간 종료 시 해지 예정
                  </span>
                )}
              </div>

              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-indigo-500"
                  style={{ width: `${seatCount > 0 ? Math.min(100, (usedSeats / seatCount) * 100) : 0}%` }}
                />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min={usedSeats || 1}
                  value={seatInput}
                  onChange={(e) => setSeatInput(e.target.value)}
                  className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  onClick={handleUpdateSeats}
                  disabled={seatBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  좌석 변경
                </button>
                <button
                  onClick={handleOpenPortal}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Settings className="h-4 w-4" aria-hidden={true} />
                  결제 관리
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 클래스 목록 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <School className="h-4 w-4 text-indigo-500" aria-hidden={true} />
            클래스 목록
          </h3>

          <div className="mt-3 flex gap-2">
            <input
              placeholder="새 클래스 이름 (예: 월수반)"
              value={newClassName}
              onChange={(e) => setNewClassName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateClass();
              }}
              className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
            />
            <button
              onClick={handleCreateClass}
              disabled={creating || !newClassName.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden={true} />
              추가
            </button>
          </div>

          {classes.length === 0 ? (
            <p className="mt-6 py-6 text-center text-sm text-slate-400">아직 만든 클래스가 없습니다.</p>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {classes.map((c) => (
                <div key={c.id} className="rounded-xl border border-slate-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                      <Users className="h-3 w-3" aria-hidden={true} />
                      {studentCountByClass(c.id)}명
                    </span>
                  </div>
                  <button
                    onClick={() => handleCopyCode(c.join_code)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2.5 py-1.5 font-mono text-sm text-slate-700 hover:bg-slate-100"
                  >
                    {c.join_code}
                    <Copy className="h-3.5 w-3.5 text-slate-400" aria-hidden={true} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function TeacherClassesPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-slate-50" />}>
      <TeacherClassesPageInner />
    </Suspense>
  );
}
