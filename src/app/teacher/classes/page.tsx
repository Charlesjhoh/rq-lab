"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import * as PortOne from "@portone/browser-sdk/v2";
import { supabase } from "@/lib/supabase-client";
import { TEACHER_SEAT_MAX, TEACHER_SEAT_PRICE_KRW } from "@/lib/products";
import { prorateSeatAmount, type SubscriptionState } from "@/lib/subscription-state";
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
  state: SubscriptionState;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  hasBillingKey: boolean;
} | null;

type SeatPayment = {
  id: string;
  paidAt: string;
  orderName: string;
  amount: number;
  status: string;
};

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

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  PAID: "결제 완료",
  PARTIAL_CANCELLED: "부분 취소",
  CANCELLED: "취소",
};

const formatDate = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("ko-KR") : "-");

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

  const [loading, setLoading] = useState(true);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [subscription, setSubscription] = useState<Subscription>(null);
  const [students, setStudents] = useState<Student[]>([]);

  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);

  const [seatInput, setSeatInput] = useState("5");
  const [seatBusy, setSeatBusy] = useState(false);
  const [payerName, setPayerName] = useState("");
  const [payerPhone, setPayerPhone] = useState("");
  const [seatConsent, setSeatConsent] = useState(false);
  const [seatPayments, setSeatPayments] = useState<SeatPayment[]>([]);

  const [currentTeacher, setCurrentTeacher] = useState<{ id: string; displayName: string | null; email: string | null } | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  useEffect(() => {
    // 모바일은 카드 등록창이 페이지를 옮겨서 끝나면 billingKey 또는 code를 붙여 돌아온다.
    // 새로고침으로 다시 처리되지 않도록 주소에서 바로 지운다.
    const returnParams = new URLSearchParams(window.location.search);
    const returnedSeats = Number(returnParams.get("seats"));
    const isCardReturn = returnParams.has("seats") || returnParams.has("resume");
    if (isCardReturn) {
      window.history.replaceState(null, "", window.location.pathname);
    }

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
          .select("role, display_name, email, teacher_status")
          .eq("id", user.id)
          .maybeSingle();

        if (!profile || profile.role !== "teacher") {
          alert("접근 권한이 없습니다. 선생님 계정으로 로그인해 주세요.");
          router.push("/");
          return;
        }

        if (profile.teacher_status !== "approved") {
          router.push("/teacher/pending");
          return;
        }

        setCurrentTeacher({
          id: user.id,
          displayName: profile.display_name,
          email: profile.email || user.email || null,
        });
        setNameInput(profile.display_name || "");

        await loadData();

        if (isCardReturn) {
          const billingKey = returnParams.get("billingKey");
          if (returnParams.get("code") || !billingKey) {
            alert(returnParams.get("message") || "카드 등록이 취소되었거나 실패했습니다.");
          } else {
            setSeatBusy(true);
            try {
              if (returnParams.has("resume")) {
                await completeResume(billingKey);
              } else {
                await completeSeatPurchase(returnedSeats, billingKey);
              }
            } finally {
              setSeatBusy(false);
            }
          }
        }
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
      if (data.subscription?.hasBillingKey) {
        const paymentsRes = await authedFetch("/api/subscriptions/payments");
        if (paymentsRes.ok) {
          const paymentsData = await paymentsRes.json();
          setSeatPayments(paymentsData.payments || []);
        }
      }
    }

    if (studentsRes.ok) {
      const data = await studentsRes.json();
      setStudents(data.students || []);
    }
  };

  const usedSeats = students.length;
  const seatCount = subscription?.seat_count || 0;
  const subscriptionState = subscription?.state ?? "inactive";
  const isCanceling = subscriptionState === "canceling";
  const isPastDue = subscriptionState === "past_due" && !!subscription?.hasBillingKey;
  const hasActiveSubscription =
    !!subscription?.hasBillingKey && (subscriptionState === "active" || isCanceling);

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

  const completeSeatPurchase = async (seats: number, billingKey: string) => {
    const res = await authedFetch("/api/subscriptions/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seatCount: seats, billingKey }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "결제 요청에 실패했습니다.");
      return;
    }

    alert("구독이 시작되었습니다.");
    await loadData();
  };

  const completeResume = async (billingKey: string) => {
    const res = await authedFetch("/api/subscriptions/resume", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingKey }),
    });

    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "구독 재개에 실패했습니다.");
      return;
    }

    alert("구독이 재개되었습니다.");
    await loadData();
  };

  // 카드를 한 번 등록해서 빌링키를 발급받는다 — 이후 정기 청구는 이 빌링키로 서버가 직접
  // 청구한다(Stripe Checkout 같은 호스팅 결제 페이지가 없어 직접 결제창을 띄우는 방식).
  const issueSeatBillingKey = (returnQuery: string) =>
    PortOne.requestIssueBillingKey({
      storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
      // 토스페이먼츠 빌링 채널을 따로 받지 않았다면 일반결제 채널로 발급한다.
      channelKey:
        process.env.NEXT_PUBLIC_PORTONE_TOSS_BILLING_CHANNEL_KEY || process.env.NEXT_PUBLIC_PORTONE_TOSS_CHANNEL_KEY!,
      billingKeyMethod: "CARD",
      issueId: `bk-${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`,
      issueName: "Read English Better 선생님 좌석 구독",
      redirectUrl: `${window.location.origin}/teacher/classes?${returnQuery}`,
      customer: {
        customerId: currentTeacher!.id,
        // 결제창에 구매자 정보를 미리 채워 넣는다.
        fullName: payerName.trim() || undefined,
        phoneNumber: payerPhone.replace(/\D/g, "") || undefined,
        email: currentTeacher!.email || undefined,
      },
    });

  const handleResumeSubscription = async () => {
    if (!currentTeacher) return;
    const message = `해지를 취소할까요? 카드를 다시 등록하면 지금은 결제되지 않고, ${formatDate(subscription?.current_period_end)}부터 매월 ₩${(seatCount * TEACHER_SEAT_PRICE_KRW).toLocaleString()}이 자동 결제됩니다.`;
    if (!confirm(message)) return;

    setSeatBusy(true);
    try {
      const issueResponse = await issueSeatBillingKey("resume=1");
      if (!issueResponse || issueResponse.code) {
        alert(issueResponse?.message || "카드 등록이 취소되었거나 실패했습니다.");
        return;
      }
      await completeResume(issueResponse.billingKey);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error && err.message ? `구독 재개 중 오류가 발생했습니다: ${err.message}` : "구독 재개 중 오류가 발생했습니다.");
    } finally {
      setSeatBusy(false);
    }
  };

  const handlePurchaseSeats = async () => {
    const seats = Number(seatInput);
    if (!Number.isInteger(seats) || seats < 1) {
      alert("좌석 수를 올바르게 입력해 주세요.");
      return;
    }
    if (seats > TEACHER_SEAT_MAX) {
      alert(`좌석은 최대 ${TEACHER_SEAT_MAX}석까지 구매할 수 있습니다.`);
      return;
    }
    if (!currentTeacher) return;
    if (!payerName.trim() || payerPhone.replace(/\D/g, "").length < 10) {
      alert("결제자 이름과 휴대폰 번호를 입력해 주세요.");
      return;
    }
    if (!seatConsent) {
      alert("정기결제 내용을 확인하고 동의해 주세요.");
      return;
    }

    setSeatBusy(true);
    try {
      const issueResponse = await issueSeatBillingKey(`seats=${seats}`);

      if (!issueResponse || issueResponse.code) {
        alert(issueResponse?.message || "카드 등록이 취소되었거나 실패했습니다.");
        return;
      }

      await completeSeatPurchase(seats, issueResponse.billingKey);
    } catch (err) {
      console.error(err);
      // 포트원 SDK는 PG 오류를 예외로 던지므로 메시지를 그대로 보여줘야 원인을 알 수 있다.
      alert(err instanceof Error && err.message ? `결제 요청 중 오류가 발생했습니다: ${err.message}` : "결제 요청 중 오류가 발생했습니다.");
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
    if (seats > TEACHER_SEAT_MAX) {
      alert(`좌석은 최대 ${TEACHER_SEAT_MAX}석까지 구매할 수 있습니다.`);
      return;
    }

    const seatDiff = seats - seatCount;
    if (seatDiff === 0) return;

    const nextAmount = (seats * TEACHER_SEAT_PRICE_KRW).toLocaleString();
    const nextDate = formatDate(subscription?.current_period_end);
    const prorateAmount =
      seatDiff > 0 && subscription?.current_period_end
        ? prorateSeatAmount(seatDiff, new Date(subscription.current_period_end))
        : 0;
    const message =
      seatDiff > 0
        ? `좌석을 ${seats}석으로 늘립니다.\n남은 기간 차액 ₩${prorateAmount.toLocaleString()}이 지금 바로 결제되고, ${nextDate}부터 매월 ₩${nextAmount}이 결제됩니다.`
        : `좌석을 ${seats}석으로 줄입니다.\n환불은 없으며, ${nextDate}부터 매월 ₩${nextAmount}이 결제됩니다.`;
    if (!confirm(message)) return;

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

  const handleCancelSubscription = async () => {
    const message = isPastDue
      ? "정기 구독을 해지할까요? 카드 등록도 함께 해제됩니다."
      : `정기 구독을 해지할까요? ${formatDate(subscription?.current_period_end)}까지 이용할 수 있고 이후에는 결제되지 않습니다. 카드 등록은 바로 해제됩니다.`;
    if (!confirm(message)) {
      return;
    }
    try {
      const res = await authedFetch("/api/subscriptions/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "구독 해지에 실패했습니다.");
        return;
      }
      alert(isPastDue ? "구독이 해지되었습니다." : "구독 해지가 예약되었습니다.");
      await loadData();
    } catch (err) {
      console.error(err);
      alert("구독 해지 중 오류가 발생했습니다.");
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
              {isPastDue ? (
                <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  <p className="font-semibold">정기 결제가 되지 않아 학생들이 테스트를 볼 수 없습니다.</p>
                  <p className="mt-1">아래에서 카드를 다시 등록하면 결제 후 바로 이용할 수 있습니다.</p>
                  <button onClick={handleCancelSubscription} className="mt-2 text-xs underline hover:text-red-900">
                    구독 해지
                  </button>
                </div>
              ) : (
                <p className="text-sm text-slate-500">아직 구매한 좌석이 없습니다. 좌석 수를 정해서 구독을 시작하세요.</p>
              )}
              <p className="text-sm text-slate-500">
                좌석 1개당 월 ₩{TEACHER_SEAT_PRICE_KRW.toLocaleString()} (최대 {TEACHER_SEAT_MAX}석) · 오늘 첫 결제 후 매월 같은 날 자동 결제되며, 언제든 해지할 수 있습니다.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  placeholder="결제자 이름"
                  value={payerName}
                  onChange={(e) => setPayerName(e.target.value)}
                  className="w-36 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <input
                  type="tel"
                  placeholder="휴대폰 번호 (010-0000-0000)"
                  value={payerPhone}
                  onChange={(e) => setPayerPhone(e.target.value)}
                  className="w-56 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <label className="flex items-start gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={seatConsent}
                  onChange={(e) => setSeatConsent(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300"
                />
                <span>
                  [필수] 등록한 카드로 매월 자동 결제되는 것과{" "}
                  <Link href="/terms" className="underline hover:text-slate-900">이용약관</Link>,{" "}
                  <Link href="/refund" className="underline hover:text-slate-900">환불정책</Link>에 동의합니다.
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  max={TEACHER_SEAT_MAX}
                  value={seatInput}
                  onChange={(e) => setSeatInput(e.target.value)}
                  className="w-28 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
                <button
                  onClick={handlePurchaseSeats}
                  disabled={seatBusy}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {seatBusy ? "이동 중..." : isPastDue ? "카드 다시 등록하기" : "좌석 구매하기"}
                </button>
                {Number(seatInput) > 0 && (
                  <span className="text-sm text-slate-600">
                    월 ₩{(Number(seatInput) * TEACHER_SEAT_PRICE_KRW).toLocaleString()}
                  </span>
                )}
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

              {isCanceling ? (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">
                    {formatDate(subscription?.current_period_end)}까지 이용할 수 있으며 이후에는 결제되지 않습니다.
                  </p>
                  <button
                    onClick={handleResumeSubscription}
                    disabled={seatBusy}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {seatBusy ? "이동 중..." : "해지 취소하기"}
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-slate-600">
                    다음 결제일 {formatDate(subscription?.current_period_end)} · ₩{(seatCount * TEACHER_SEAT_PRICE_KRW).toLocaleString()}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="number"
                      min={usedSeats || 1}
                      max={TEACHER_SEAT_MAX}
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
                      onClick={handleCancelSubscription}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      <Settings className="h-4 w-4" aria-hidden={true} />
                      구독 해지
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {seatPayments.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <h4 className="text-xs font-semibold text-slate-500">결제 내역</h4>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {seatPayments.map((p) => (
                  <li key={p.id} className="flex flex-wrap justify-between gap-2">
                    <span>{formatDate(p.paidAt)} · {p.orderName}</span>
                    <span>₩{p.amount.toLocaleString()} · {PAYMENT_STATUS_LABELS[p.status] || p.status}</span>
                  </li>
                ))}
              </ul>
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
  return <TeacherClassesPageInner />;
}
