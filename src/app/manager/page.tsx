"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase-client";
import { PRODUCT_LABELS } from "@/lib/products";
import Link from "next/link";
import {
  BarChart3,
  Search,
  Wallet,
  Gift,
  TrendingUp,
  CalendarClock,
  Ticket,
} from "lucide-react";

type Stats = {
  totalRevenue: number;
  monthRevenue: number;
  singleCount: number;
  packageCount: number;
  activePackageHolders: number;
};

type OrderRow = {
  id: string;
  created_at: string;
  student_name: string | null;
  email: string | null;
  product_type: string;
  final_amount: number;
  status: string;
};

type SearchedUser = {
  id: string;
  student_name: string | null;
  email: string | null;
  remainingCredits: number;
};

const STATUS_LABELS: Record<string, string> = {
  paid: "결제 완료",
  completed: "결제 완료",
  pending: "결제 대기",
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

export default function ManagerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [stats, setStats] = useState<Stats | null>(null);

  const [orderSearch, setOrderSearch] = useState("");
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const [userQuery, setUserQuery] = useState("");
  const [searchedUsers, setSearchedUsers] = useState<SearchedUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<SearchedUser | null>(null);
  const [grantCredits, setGrantCredits] = useState("2");
  const [grantDays, setGrantDays] = useState("30");
  const [grantNote, setGrantNote] = useState("");
  const [grantMessage, setGrantMessage] = useState("");
  const [granting, setGranting] = useState(false);

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

        await Promise.all([loadStats(), loadOrders("")]);
      } catch (err) {
        console.error(err);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    init();
  }, [router]);

  const loadStats = async () => {
    try {
      const res = await authedFetch("/api/manager/stats");
      if (res.ok) setStats(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const loadOrders = async (q: string) => {
    setOrdersLoading(true);
    try {
      const res = await authedFetch(`/api/manager/orders?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleOrderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders(orderSearch);
  };

  const handleUserSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userQuery.trim()) return;

    try {
      const res = await authedFetch(`/api/manager/users/search?q=${encodeURIComponent(userQuery.trim())}`);
      if (res.ok) {
        const data = await res.json();
        setSearchedUsers(data.users || []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleGrant = async () => {
    if (!selectedUser) return;
    setGranting(true);
    setGrantMessage("");

    try {
      const res = await authedFetch("/api/manager/credits/grant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: selectedUser.id,
          credits: grantCredits,
          days: grantDays,
          note: grantNote,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setGrantMessage(`❌ ${data.error || "지급에 실패했습니다."}`);
        return;
      }

      setGrantMessage(`✅ ${selectedUser.student_name || selectedUser.email}님에게 ${grantCredits}회 지급 완료`);
      setSelectedUser({ ...selectedUser, remainingCredits: selectedUser.remainingCredits + Number(grantCredits) });
      loadStats();
    } catch (err) {
      console.error(err);
      setGrantMessage("❌ 지급 중 오류가 발생했습니다.");
    } finally {
      setGranting(false);
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
      <div className="mx-auto w-full max-w-6xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-indigo-600">
              <BarChart3 className="h-4 w-4" aria-hidden={true} />
              Manager Dashboard
            </div>
            <h1 className="mt-2 text-2xl font-bold tracking-tight text-slate-900">결제 관리</h1>
          </div>

          <Link
            href="/manager/coupons"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50"
          >
            <Ticket className="h-4 w-4" aria-hidden={true} />
            쿠폰 관리
          </Link>
        </div>

        {/* 통계 요약 */}
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1 text-xs text-slate-400">
                <TrendingUp className="h-3.5 w-3.5" aria-hidden={true} />
                총 매출
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">₩{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="flex items-center gap-1 text-xs text-slate-400">
                <CalendarClock className="h-3.5 w-3.5" aria-hidden={true} />
                이번 달 매출
              </p>
              <p className="mt-1 text-lg font-bold text-slate-900">₩{stats.monthRevenue.toLocaleString()}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-400">단건 결제</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{stats.singleCount}건</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-400">패키지 판매</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{stats.packageCount}건</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs text-slate-400">활성 패키지 보유자</p>
              <p className="mt-1 text-lg font-bold text-slate-900">{stats.activePackageHolders}명</p>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-6 lg:flex-row">
          {/* 결제 내역 검색 */}
          <section className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Wallet className="h-4 w-4 text-indigo-500" aria-hidden={true} />
              결제 내역 검색
            </h3>

            <form onSubmit={handleOrderSearch} className="mt-3 flex gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden={true} />
                <input
                  placeholder="이름 또는 이메일로 검색"
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                />
              </div>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                검색
              </button>
            </form>

            <div className="mt-4 max-h-[60vh] overflow-y-auto">
              {ordersLoading ? (
                <p className="py-6 text-center text-sm text-slate-400">불러오는 중...</p>
              ) : orders.length === 0 ? (
                <p className="py-6 text-center text-sm text-slate-400">결제 내역이 없습니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-slate-500">
                      <th className="py-2 pr-3 font-medium">날짜</th>
                      <th className="py-2 pr-3 font-medium">학생</th>
                      <th className="py-2 pr-3 font-medium">상품</th>
                      <th className="py-2 pr-3 font-medium">금액</th>
                      <th className="py-2 font-medium">상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((o) => (
                      <tr key={o.id} className="border-b last:border-0">
                        <td className="py-2.5 pr-3 text-xs text-slate-500">
                          {new Date(o.created_at).toLocaleDateString("ko-KR")}
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="font-medium text-slate-900">{o.student_name || "-"}</div>
                          <div className="text-xs text-slate-400">{o.email || "-"}</div>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-700">
                          {PRODUCT_LABELS[o.product_type] || o.product_type}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-900">₩{Number(o.final_amount || 0).toLocaleString()}</td>
                        <td className="py-2.5">
                          <span
                            className={
                              o.status === "paid" || o.status === "completed"
                                ? "font-medium text-emerald-600"
                                : "text-slate-400"
                            }
                          >
                            {STATUS_LABELS[o.status] || o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* 무료 크레딧 지급 */}
          <aside className="w-full shrink-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:w-96">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <Gift className="h-4 w-4 text-indigo-500" aria-hidden={true} />
              무료 크레딧 지급
            </h3>

            <form onSubmit={handleUserSearch} className="mt-3 flex gap-2">
              <input
                placeholder="이름 또는 이메일 검색"
                value={userQuery}
                onChange={(e) => setUserQuery(e.target.value)}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                검색
              </button>
            </form>

            {searchedUsers.length > 0 && !selectedUser && (
              <div className="mt-3 max-h-48 overflow-y-auto rounded-xl border border-slate-100">
                {searchedUsers.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => {
                      setSelectedUser(u);
                      setSearchedUsers([]);
                      setGrantMessage("");
                    }}
                    className="flex w-full flex-col items-start border-b border-slate-100 px-3 py-2 text-left last:border-0 hover:bg-slate-50"
                  >
                    <span className="text-sm font-medium text-slate-900">{u.student_name || "이름없음"}</span>
                    <span className="text-xs text-slate-400">{u.email} · 잔여 {u.remainingCredits}회</span>
                  </button>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="mt-4 space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{selectedUser.student_name || "이름없음"}</p>
                    <p className="text-xs text-slate-500">{selectedUser.email} · 현재 잔여 {selectedUser.remainingCredits}회</p>
                  </div>
                  <button
                    onClick={() => { setSelectedUser(null); setGrantMessage(""); }}
                    className="text-xs text-slate-400 hover:text-slate-600"
                  >
                    변경
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <label className="text-xs text-slate-500">
                    지급 횟수
                    <input
                      type="number"
                      min={1}
                      value={grantCredits}
                      onChange={(e) => setGrantCredits(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    유효기간(일)
                    <input
                      type="number"
                      min={1}
                      value={grantDays}
                      onChange={(e) => setGrantDays(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                    />
                  </label>
                </div>

                <label className="block text-xs text-slate-500">
                  메모 (선택)
                  <input
                    value={grantNote}
                    onChange={(e) => setGrantNote(e.target.value)}
                    placeholder="예: 체험단 지급"
                    className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                  />
                </label>

                <button
                  onClick={handleGrant}
                  disabled={granting}
                  className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                >
                  {granting ? "지급 중..." : "무료 크레딧 지급하기"}
                </button>

                {grantMessage && <p className="text-xs">{grantMessage}</p>}
              </div>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
