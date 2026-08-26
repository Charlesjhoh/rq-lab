import { supabaseAdmin } from "./supabase-admin";

// 1인당 하루 응시 가능 테스트 수. Azure Speech/OpenAI 호출이 건당 실비용이 드는데
// 응시 자체에는 크레딧/구독 체크가 전혀 없어서, 계정만 만들면 무제한으로 유료 API를
// 두드릴 수 있었다 — 그 비용 남용을 막기 위한 최소한의 장치.
export const DAILY_TEST_LIMIT = 5;

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

// StepTestClient.tsx의 승급 권유 판정(confidentlyIndependent)과 동일한 기준을 재사용한다.
const LEVEL_UP_COMPREHENSION_THRESHOLD = 60;

// 오늘 가장 최근 응시 결과가 "상위 레벨 도전"을 권유하는 결과였는지 확인한다. 앱이 먼저
// 다음 레벨 테스트를 권해놓고, 정작 일일 횟수 제한 때문에 그 권유를 따라갈 수 없게 막는 건
// 불합리하므로 — 이 경우엔 한도를 넘겨서라도 응시를 허용한다.
async function lastResultRecommendedLevelUp(userId: string, sinceIso: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("reading_results")
    .select("reading_level, comprehension")
    .eq("user_id", userId)
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    !!data &&
    data.reading_level === "independent" &&
    (data.comprehension ?? 0) >= LEVEL_UP_COMPREHENSION_THRESHOLD
  );
}

// class_id로 소속 선생님의 좌석 구독이 active/trialing인지 확인한다. checkTestEligibility(응시 시점
// 반응적 체크)와 mypage(로그인 시 사전 고지 배너) 양쪽에서 재사용 — 학생이 테스트를 시도하기 전에
// 이미 구독이 끊긴 걸 알 수 있어야 CS 문의로 이어지기 전에 상황을 파악할 수 있다.
export async function isTeacherSubscriptionInactive(classId: string): Promise<boolean> {
  const { data: klass } = await supabaseAdmin
    .from("classes")
    .select("teacher_id")
    .eq("id", classId)
    .maybeSingle();

  if (!klass?.teacher_id) return false;

  const { data: sub } = await supabaseAdmin
    .from("teacher_subscriptions")
    .select("status")
    .eq("teacher_id", klass.teacher_id)
    .maybeSingle();

  return !sub || !ACTIVE_SUBSCRIPTION_STATUSES.includes(sub.status);
}

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
    if (await isTeacherSubscriptionInactive(profile.class_id)) {
      return {
        allowed: false,
        reason: "선생님의 구독이 활성화되어 있지 않아 테스트를 진행할 수 없습니다. 선생님께 문의해 주세요.",
      };
    }
  }

  const kstMidnight = getKstMidnightUtc().toISOString();
  const { count } = await supabaseAdmin
    .from("reading_results")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", kstMidnight);

  if ((count || 0) >= DAILY_TEST_LIMIT) {
    if (await lastResultRecommendedLevelUp(userId, kstMidnight)) {
      return { allowed: true };
    }
    return {
      allowed: false,
      reason: `오늘의 테스트 횟수(${DAILY_TEST_LIMIT}회)를 모두 사용했습니다. 내일 다시 시도해 주세요.`,
    };
  }

  return { allowed: true };
}
