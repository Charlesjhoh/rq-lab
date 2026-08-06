"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase-client";
import { Ticket, ArrowLeft, RefreshCw } from "lucide-react";

type Coupon = {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
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

// "YYYY-MM-DD" 날짜만 있는 값을 그대로 new Date().toISOString()하면 UTC 자정으로 해석되어
// 한국 시간 기준으로는 당일 오전 9시에 만료되어 버림 — 한국 시간 자정(23:59:59 KST)으로 명시 변환
function kstEndOfDayIso(dateStr: string) {
  return new Date(`${dateStr}T23:59:59+09:00`).toISOString();
}

function formatDate(value: string | null) {
  if (!value) return "무제한";
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default function ManagerCouponsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState<Coupon[]>([]);

  const [code, setCode] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("10");
  const [expiresAt, setExpiresAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState("");

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
          .select("role")
          .eq("id", user.id)
          .single();

        if (!profile || profile.role !== "manager") {
          alert("접근 권한이 없습니다. 매니저 계정으로 로그인해 주세요.");
          router.push("/");
          return;
        }

        await loadCoupons();
      } catch (err) {
        console.error(err);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const loadCoupons = async () => {
    try {
      const res = await authedFetch("/api/manager/coupons");
      if (res.ok) {
        const data = await res.json();
        setCoupons(data.coupons || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setMessage("");

    try {
      const res = await authedFetch("/api/manager/coupons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          discountType,
          discountValue,
          expiresAt: expiresAt ? kstEndOfDayIso(expiresAt) : null,
          isActive,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage(`❌ ${data.error || "쿠폰 생성에 실패했습니다."}`);
        return;
      }

      setMessage(`✅ 쿠폰 "${data.coupon.code}" 생성 완료`);
      setCode("");
      loadCoupons();
    } catch (err) {
      console.error(err);
      setMessage("❌ 쿠폰 생성 중 오류가 발생했습니다.");
    } finally {
      setCreating(false);
    }
  };

  const toggleActive = async (coupon: Coupon) => {
    try {
      const res = await authedFetch(`/api/manager/coupons/${coupon.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !coupon.is_active }),
      });

      if (res.ok) {
        setCoupons((prev) =>
          prev.map((c) => (c.id === coupon.id ? { ...c, is_active: !c.is_active } : c))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto"></div>
          <p className="mt-4 text-sm text-slate-500 font-medium">매니저 권한을 확인하고 있습니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <div>
          <Link
            href="/manager"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden={true} />
            매니저 대시보드
          </Link>
          <div className="mt-2 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-600">
            <Ticket className="h-4 w-4" aria-hidden={true} />
            Coupon Management
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">쿠폰 관리</h1>
        </div>

        {/* 쿠폰 생성 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900">새 쿠폰 만들기</h3>

          <form onSubmit={handleCreate} className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <label className="col-span-2 text-xs text-slate-500 sm:col-span-1">
              쿠폰 코드
              <input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="비워두면 자동 생성"
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm uppercase"
              />
            </label>

            <label className="text-xs text-slate-500">
              할인 유형
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as "percent" | "amount")}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              >
                <option value="percent">퍼센트(%)</option>
                <option value="amount">정액(원)</option>
              </select>
            </label>

            <label className="text-xs text-slate-500">
              할인 값
              <input
                type="number"
                min={1}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              />
            </label>

            <label className="text-xs text-slate-500">
              사용 만료일
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 text-sm"
              />
            </label>

            <label className="col-span-2 flex items-center gap-2 text-xs text-slate-500 sm:col-span-4">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              바로 활성화
            </label>

            <div className="col-span-2 sm:col-span-4">
              <button
                type="submit"
                disabled={creating}
                className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 sm:w-auto sm:px-6"
              >
                {creating ? "생성 중..." : "쿠폰 생성"}
              </button>
              {message && <p className="mt-2 text-xs">{message}</p>}
            </div>
          </form>
        </section>

        {/* 쿠폰 목록 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-900">쿠폰 목록</h3>
            <button
              onClick={loadCoupons}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden={true} />
              새로고침
            </button>
          </div>

          <div className="mt-3 overflow-x-auto">
            {coupons.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">생성된 쿠폰이 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-2 pr-3 font-medium">코드</th>
                    <th className="py-2 pr-3 font-medium">할인</th>
                    <th className="py-2 pr-3 font-medium">만료일</th>
                    <th className="py-2 pr-3 font-medium">생성일</th>
                    <th className="py-2 font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {coupons.map((c) => (
                    <tr key={c.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 font-mono font-semibold text-slate-900">{c.code}</td>
                      <td className="py-2.5 pr-3 text-slate-700">
                        {c.discount_type === "amount"
                          ? `₩${Number(c.discount_value).toLocaleString()}`
                          : `${c.discount_value}%`}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">{formatDate(c.expires_at)}</td>
                      <td className="py-2.5 pr-3 text-xs text-slate-500">{formatDate(c.created_at)}</td>
                      <td className="py-2.5">
                        <button
                          onClick={() => toggleActive(c)}
                          className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                            c.is_active
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                          }`}
                        >
                          {c.is_active ? "활성" : "비활성"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
