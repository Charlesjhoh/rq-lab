import { supabaseAdmin } from './supabase-admin';
import { createPaymentSchedule } from './portone';
import { TEACHER_SEAT_ORDER_NAME, TEACHER_SEAT_PRICE_KRW } from './products';

// 다음 달 정기 청구 예약 — Stripe와 달리 자동 반복이 없어 매번 다음 1건을 직접 예약해야 한다.
export async function scheduleNextSeatCharge(options: {
  teacherId: string;
  billingKey: string;
  seatCount: number;
  timeToPay: Date;
}) {
  const paymentId = `seat-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
  const { schedule } = await createPaymentSchedule({
    paymentId,
    billingKey: options.billingKey,
    orderName: TEACHER_SEAT_ORDER_NAME,
    amountTotal: options.seatCount * TEACHER_SEAT_PRICE_KRW,
    timeToPay: options.timeToPay.toISOString(),
    customerId: options.teacherId,
  });

  await supabaseAdmin
    .from('teacher_subscriptions')
    .update({ next_schedule_id: schedule.id })
    .eq('teacher_id', options.teacherId);
}
