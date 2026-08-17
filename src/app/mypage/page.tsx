import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { PRODUCT_LABELS } from "@/lib/products";
import { isTeacherSubscriptionInactive } from "@/lib/test-eligibility";
import JoinClassForm from "./JoinClassForm";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  paid: "결제 완료",
  completed: "결제 완료",
  pending: "결제 대기",
  refunded: "환불됨",
  failed: "처리 실패",
};

function formatDate(value: string) {
  const d = new Date(value);
  if (isNaN(d.getTime())) return "-";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default async function MyPage() {
  const cookieStore = cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {}
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: orders }, { data: packages }, { data: profile }] = await Promise.all([
    supabaseAdmin
      .from("orders")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabaseAdmin
      .from("credit_packages")
      .select("*")
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString())
      .order("expires_at", { ascending: true }),
    supabaseAdmin
      .from("profiles")
      .select("role, class_id")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const totalRemaining = (packages || []).reduce((sum, p) => sum + p.remaining_credits, 0);
  const nearestExpiry = packages && packages.length > 0 ? packages[0].expires_at : null;

  // 선생님 구독이 끊긴 걸 학생이 테스트를 시도하다 실패해서야 알게 되는 대신, 로그인 직후
  // mypage에서 먼저 알 수 있게 사전 고지한다 (별도 알림/이메일 인프라가 없어 이 방식으로 대체).
  const teacherSubscriptionInactive =
    profile?.role === "student" && profile.class_id
      ? await isTeacherSubscriptionInactive(profile.class_id)
      : false;

  return (
    <div className="max-w-2xl mx-auto my-12 px-4 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">마이페이지</h1>

      {teacherSubscriptionInactive && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          선생님의 구독이 활성화되어 있지 않아 테스트 응시가 제한됩니다. 선생님께 문의해 주세요.
        </div>
      )}

      {profile?.role === "student" && (
        <JoinClassForm alreadyJoined={Boolean(profile.class_id)} />
      )}

      {/* 패키지 현황 */}
      <section className="bg-white shadow-md rounded-xl p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3">패키지 현황</h2>
        {totalRemaining > 0 ? (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-2xl font-bold text-indigo-600">{totalRemaining}회 남음</p>
              {nearestExpiry && (
                <p className="text-xs text-gray-500 mt-1">{formatDate(nearestExpiry)}까지 유효</p>
              )}
            </div>
            <Link
              href="/checkout?type=package"
              className="text-sm font-semibold text-indigo-600 hover:underline"
            >
              추가 구매
            </Link>
          </div>
        ) : (
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">보유 중인 패키지가 없습니다.</p>
            <Link
              href="/checkout?type=package"
              className="text-sm font-semibold text-white bg-indigo-600 px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              패키지 구매하기
            </Link>
          </div>
        )}
      </section>

      {/* 결제 내역 */}
      <section className="bg-white shadow-md rounded-xl p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-3">결제 내역</h2>
        {orders && orders.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-4 font-medium">날짜</th>
                  <th className="py-2 pr-4 font-medium">상품</th>
                  <th className="py-2 pr-4 font-medium">금액</th>
                  <th className="py-2 font-medium">상태</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 text-gray-600">{formatDate(order.created_at)}</td>
                    <td className="py-2.5 pr-4 text-gray-800">
                      {PRODUCT_LABELS[order.product_type] || order.product_type}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-800">₩{Number(order.final_amount || 0).toLocaleString()}</td>
                    <td className="py-2.5">
                      <span
                        className={
                          order.status === "paid" || order.status === "completed"
                            ? "text-green-600 font-medium"
                            : order.status === "refunded" || order.status === "failed"
                            ? "text-red-500 font-medium"
                            : "text-gray-400"
                        }
                      >
                        {STATUS_LABELS[order.status] || order.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">결제 내역이 없습니다.</p>
        )}
      </section>
    </div>
  );
}
