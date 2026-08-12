import { supabaseAdmin } from "./supabase-admin";

// 1인당 하루 응시 가능 테스트 수. Azure Speech/OpenAI 호출이 건당 실비용이 드는데
// 응시 자체에는 크레딧/구독 체크가 전혀 없어서, 계정만 만들면 무제한으로 유료 API를
// 두드릴 수 있었다 — 그 비용 남용을 막기 위한 최소한의 장치.
export const DAILY_TEST_LIMIT = 3;

const ACTIVE_SUBSCRIPTION_STATUSES = ["active", "trialing"];

function getKstMidnightUtc(): Date {
  const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const kstNow = new Date(Date.now() + KST_OFFSET_MS);
  const y = kstNow.getUTCFullYear();
  const m = kstNow.getUTCMonth();
  const d = kstNow.getUTCDate();
  return new Date(Date.UTC(y, m, d) - KST_OFFSET_MS);
}

export type TestEligibility = { allowed: true } | { allowed: false; reason: string };

// 리딩테스트 응시 가능 여부를 판정한다. 두 가지를 본다:
// 1) 소속 선생님이 있다면, 그 선생님의 좌석 구독이 active/trialing 상태인지
//    (구독이 해지돼도 이미 가입된 학생의 class_id는 그대로 남아 계속 무료로 쓸 수 있었음)
// 2) 계정당 하루 응시 횟수가 DAILY_TEST_LIMIT을 넘지 않았는지
export async function checkTestEligibility(userId: string): Promise<TestEligibility> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("class_id")
    .eq("id", userId)
    .maybeSingle();

  if (profile?.class_id) {
    const { data: klass } = await supabaseAdmin
      .from("classes")
      .select("teacher_id")
      .eq("id", profile.class_id)
      .maybeSingle();

    if (klass?.teacher_id) {
      const { data: sub } = await supabaseAdmin
        .from("teacher_subscriptions")
        .select("status")
        .eq("teacher_id", klass.teacher_id)
        .maybeSingle();

      if (!sub || !ACTIVE_SUBSCRIPTION_STATUSES.includes(sub.status)) {
        return {
          allowed: false,
          reason: "선생님의 구독이 활성화되어 있지 않아 테스트를 진행할 수 없습니다. 선생님께 문의해 주세요.",
        };
      }
    }
  }

  const { count } = await supabaseAdmin
    .from("reading_results")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", getKstMidnightUtc().toISOString());

  if ((count || 0) >= DAILY_TEST_LIMIT) {
    return {
      allowed: false,
      reason: `오늘의 테스트 횟수(${DAILY_TEST_LIMIT}회)를 모두 사용했습니다. 내일 다시 시도해 주세요.`,
    };
  }

  return { allowed: true };
}
