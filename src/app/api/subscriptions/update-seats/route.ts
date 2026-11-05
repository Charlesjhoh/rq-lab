export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { payWithBillingKey, revokePaymentSchedules } from '@/lib/portone';
import { TEACHER_SEAT_MAX, TEACHER_SEAT_ORDER_NAME } from '@/lib/products';
import { addMonths, getSubscriptionState, prorateSeatAmount } from '@/lib/subscription-state';
import { scheduleNextSeatCharge } from '@/lib/subscription-billing';

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
  if (seatCount > TEACHER_SEAT_MAX) {
    return NextResponse.json({ error: `좌석은 최대 ${TEACHER_SEAT_MAX}석까지 구매할 수 있습니다.` }, { status: 400 });
  }

  const { data: subscription } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('portone_billing_key, seat_count, status, current_period_end, cancel_at_period_end, next_schedule_id')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  const state = getSubscriptionState(subscription);
  if (!subscription?.portone_billing_key || state === 'inactive') {
    return NextResponse.json({ error: '활성화된 구독이 없습니다. 먼저 좌석을 구매해 주세요.' }, { status: 400 });
  }
  if (state === 'canceling') {
    return NextResponse.json({ error: '해지한 구독은 좌석을 변경할 수 없습니다.' }, { status: 400 });
  }
  if (state === 'past_due') {
    return NextResponse.json({ error: '정기 결제가 실패한 상태입니다. 카드를 다시 등록해 주세요.' }, { status: 400 });
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

  const periodEnd = subscription.current_period_end ? new Date(subscription.current_period_end) : addMonths(new Date(), 1);

  // 예약을 먼저 지운다. 취소 없이 좌석만 바뀌면 다음 결제가 옛 금액으로 나가므로, 실패하면 아무것도
  // 바꾸지 않고 끝낸다.
  if (subscription.next_schedule_id) {
    try {
      await revokePaymentSchedules([subscription.next_schedule_id]);
    } catch (err: any) {
      console.error('❌ 좌석 변경 전 정기 청구 예약 취소 실패:', err.message);
      return NextResponse.json({ error: '결제 예약을 변경하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
    await supabaseAdmin.from('teacher_subscriptions').update({ next_schedule_id: null }).eq('teacher_id', teacherId);
  }

  // 차액 결제가 실패하면 이전 좌석 수로 예약을 되살린다.
  const restoreSchedule = async () => {
    try {
      await scheduleNextSeatCharge({ teacherId, billingKey, seatCount: subscription.seat_count, timeToPay: periodEnd });
    } catch (err: any) {
      console.error('❌ 정기 청구 예약 복구 실패:', err.message);
    }
  };

  // 좌석을 늘리는 경우: 이번 결제 주기의 남은 기간만큼 차액을 일할계산해서 즉시 청구한다
  // (Stripe가 하던 것과 동일한 정책). 청구가 성공해야만 좌석 수를 반영한다.
  if (seatDiff > 0) {
    const prorateAmount = prorateSeatAmount(seatDiff, periodEnd);

    if (prorateAmount > 0) {
      const paymentId = `seat-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;
      try {
        await payWithBillingKey({
          paymentId,
          billingKey,
          orderName: `${TEACHER_SEAT_ORDER_NAME} (좌석 증설 차액)`,
          amountTotal: prorateAmount,
          customerId: teacherId,
        });
      } catch (err: any) {
        console.error('❌ 좌석 증설 차액 청구 실패:', err.message);
        await restoreSchedule();
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
    await restoreSchedule();
    return NextResponse.json({ error: '좌석 수 갱신에 실패했습니다.' }, { status: 500 });
  }

  try {
    await scheduleNextSeatCharge({ teacherId, billingKey, seatCount, timeToPay: periodEnd });
  } catch (err: any) {
    // 예약이 없으면 결제일 이후 getSubscriptionState가 past_due로 판정해 카드 재등록을 안내한다.
    console.error('❌ 좌석 변경 후 다음 정기 청구 재예약 실패:', err.message);
  }

  return NextResponse.json({ updated: true });
}
