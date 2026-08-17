export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { payWithBillingKey, createPaymentSchedule, revokePaymentSchedules } from '@/lib/portone';
import { TEACHER_SEAT_PRICE_KRW } from '@/lib/products';

const SEAT_ORDER_NAME = '리드이비 선생님 좌석 구독';
const PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const seatCount = Number(body.seatCount);
  if (!Number.isInteger(seatCount) || seatCount < 1) {
    return NextResponse.json({ error: '좌석 수가 올바르지 않습니다.' }, { status: 400 });
  }

  const { data: subscription } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('portone_billing_key, seat_count, status, current_period_end, next_schedule_id')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  if (!subscription?.portone_billing_key || !['active', 'trialing', 'past_due'].includes(subscription.status)) {
    return NextResponse.json({ error: '활성화된 구독이 없습니다. 먼저 좌석을 구매해 주세요.' }, { status: 400 });
  }

  const { data: classes } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('teacher_id', auth.user.id);

  const classIds = (classes || []).map((c) => c.id);
  const { count: currentStudentCount } = classIds.length > 0
    ? await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).in('class_id', classIds)
    : { count: 0 };

  if (seatCount < (currentStudentCount || 0)) {
    return NextResponse.json(
      { error: `현재 소속 학생 수(${currentStudentCount})보다 적게는 줄일 수 없습니다.` },
      { status: 400 }
    );
  }

  const teacherId = auth.user.id;
  const billingKey = subscription.portone_billing_key;
  const seatDiff = seatCount - subscription.seat_count;

  if (seatDiff === 0) {
    return NextResponse.json({ updated: true });
  }

  // 좌석을 늘리는 경우: 이번 결제 주기의 남은 기간만큼 차액을 일할계산해서 즉시 청구한다
  // (Stripe가 하던 것과 동일한 정책). 청구가 성공해야만 좌석 수를 반영한다.
  if (seatDiff > 0) {
    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : new Date();
    const periodStart = new Date(periodEnd.getTime() - PERIOD_MS);
    const now = new Date();
    const remainingMs = Math.max(0, periodEnd.getTime() - now.getTime());
    const remainingRatio = Math.min(1, remainingMs / (periodEnd.getTime() - periodStart.getTime()));
    const prorateAmount = Math.round(seatDiff * TEACHER_SEAT_PRICE_KRW * remainingRatio);

    if (prorateAmount > 0) {
      const paymentId = `seat-${teacherId}-${crypto.randomUUID().slice(0, 8)}`;
      try {
        await payWithBillingKey({
          paymentId,
          billingKey,
          orderName: `${SEAT_ORDER_NAME} (좌석 증설 차액)`,
          amountTotal: prorateAmount,
          customerId: teacherId,
        });
      } catch (err: any) {
        console.error('❌ 좌석 증설 차액 청구 실패:', err.message);
        return NextResponse.json({ error: '차액 결제에 실패했습니다. 카드 정보를 확인해 주세요.' }, { status: 400 });
      }
    }
  }

  // 좌석을 줄이는 경우: 즉시 환불 없이 다음 결제일부터 적은 금액이 반영된다(이번 주기 남은
  // 기간은 이미 낸 돈 그대로 사용).
  const { error: updateError } = await supabaseAdmin
    .from('teacher_subscriptions')
    .update({ seat_count: seatCount, updated_at: new Date().toISOString() })
    .eq('teacher_id', teacherId);

  if (updateError) {
    console.error('❌ 좌석 수 갱신 실패:', updateError.message);
    return NextResponse.json({ error: '좌석 수 갱신에 실패했습니다.' }, { status: 500 });
  }

  // 다음 정기 청구 예약을 새 좌석 수 기준 금액으로 다시 만든다
  try {
    if (subscription.next_schedule_id) {
      await revokePaymentSchedules([subscription.next_schedule_id]);
    }

    const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : new Date(Date.now() + PERIOD_MS);
    const nextPaymentId = `seat-${teacherId}-${crypto.randomUUID().slice(0, 8)}`;
    const scheduleResult = await createPaymentSchedule({
      paymentId: nextPaymentId,
      billingKey,
      orderName: SEAT_ORDER_NAME,
      amountTotal: seatCount * TEACHER_SEAT_PRICE_KRW,
      timeToPay: periodEnd.toISOString(),
      customerId: teacherId,
    });

    await supabaseAdmin
      .from('teacher_subscriptions')
      .update({ next_schedule_id: scheduleResult.schedule.id })
      .eq('teacher_id', teacherId);
  } catch (err: any) {
    console.error('❌ 좌석 변경 후 다음 정기 청구 재예약 실패:', err.message);
  }

  return NextResponse.json({ updated: true });
}
