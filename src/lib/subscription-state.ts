import { TEACHER_SEAT_PRICE_KRW } from './products';

// 화면(클라이언트)과 서버가 같이 쓰므로 서버 전용 모듈을 import하지 않는다.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
// 예약 결제 성공 웹훅이 늦게 올 수 있어, 결제일이 지나도 이 기간까지는 이용을 막지 않는다.
const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

// active: 정상 구독 / canceling: 해지했지만 결제한 기간이 남음 / past_due: 정기 결제가 안 됨
// (카드를 다시 등록해야 함) / inactive: 구독 없음
export type SubscriptionState = 'active' | 'canceling' | 'past_due' | 'inactive';

type SubscriptionFields = {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
  portone_billing_key: string | null;
};

export function getSubscriptionState(sub: SubscriptionFields | null | undefined, now = new Date()): SubscriptionState {
  if (!sub) return 'inactive';
  if (sub.status === 'past_due') return 'past_due';
  if (!['active', 'trialing'].includes(sub.status)) return 'inactive';

  // 빌링키가 없는 구독(Stripe → PortOne 전환 이전)은 주기가 갱신되지 않으므로 상태값만 본다.
  if (!sub.portone_billing_key || !sub.current_period_end) return 'active';

  const periodEnd = new Date(sub.current_period_end).getTime();
  if (sub.cancel_at_period_end) {
    return periodEnd > now.getTime() ? 'canceling' : 'inactive';
  }
  // 청구 예약이 실패하면 웹훅이 오지 않아 status가 active로 남는다 — 기간 경과로 판정한다.
  return now.getTime() > periodEnd + RENEWAL_GRACE_MS ? 'past_due' : 'active';
}

export function hasSubscriptionAccess(state: SubscriptionState) {
  return state === 'active' || state === 'canceling';
}

// 매월 같은 날(KST) 결제일을 계산한다. 다음 달에 그 날이 없으면 말일로 맞춘다.
export function addMonths(date: Date, months: number) {
  const kst = new Date(date.getTime() + KST_OFFSET_MS);
  const day = kst.getUTCDate();
  kst.setUTCDate(1);
  kst.setUTCMonth(kst.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth() + 1, 0)).getUTCDate();
  kst.setUTCDate(Math.min(day, lastDay));
  return new Date(kst.getTime() - KST_OFFSET_MS);
}

// 좌석을 늘릴 때 이번 결제 주기의 남은 기간만큼 일할계산한 차액.
export function prorateSeatAmount(seatDiff: number, periodEnd: Date, now = new Date()) {
  const periodStart = addMonths(periodEnd, -1);
  const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
  const remainingRatio = Math.min(1, remainingMs / (periodEnd.getTime() - periodStart.getTime()));
  return Math.round(seatDiff * TEACHER_SEAT_PRICE_KRW * remainingRatio);
}
