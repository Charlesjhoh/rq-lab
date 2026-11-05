export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { payWithBillingKey, revokePaymentSchedules, deleteBillingKey } from '@/lib/portone';
import { TEACHER_SEAT_MAX, TEACHER_SEAT_ORDER_NAME, TEACHER_SEAT_PRICE_KRW } from '@/lib/products';
import { addMonths, getSubscriptionState } from '@/lib/subscription-state';
import { scheduleNextSeatCharge } from '@/lib/subscription-billing';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const seatCount = Number(body.seatCount);
  const billingKey = String(body.billingKey || '');

  if (!Number.isInteger(seatCount) || seatCount < 1) {
    return NextResponse.json({ error: '좌석 수가 올바르지 않습니다.' }, { status: 400 });
  }
  if (seatCount > TEACHER_SEAT_MAX) {
    return NextResponse.json({ error: `좌석은 최대 ${TEACHER_SEAT_MAX}석까지 구매할 수 있습니다.` }, { status: 400 });
  }
  if (!billingKey) {
    return NextResponse.json({ error: '카드 등록 정보가 없습니다.' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('status, current_period_end, cancel_at_period_end, portone_billing_key, next_schedule_id')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  // billing_key가 없으면 status가 'active'로 남아 있어도(Stripe → PortOne 전환 이전 구독 등)
  // 실제로는 청구할 수단이 없는 상태이므로 신규 구독처럼 카드 등록을 다시 받는다.
  const state = getSubscriptionState(existing);
  if (existing?.portone_billing_key && state === 'active') {
    return NextResponse.json({ error: '이미 구독 중입니다. 좌석 변경은 좌석 변경 기능을 사용해 주세요.' }, { status: 400 });
  }
  if (state === 'canceling') {
    return NextResponse.json({ error: '해지한 구독의 이용 기간이 끝난 뒤 다시 구독할 수 있습니다.' }, { status: 400 });
  }

  // 정기 결제가 실패한 구독을 새 카드로 살리는 경우: 옛 예약이 남아 있으면 이중 청구되므로 먼저 지운다.
  if (existing?.next_schedule_id) {
    try {
      await revokePaymentSchedules([existing.next_schedule_id]);
    } catch (err: any) {
      console.error('❌ 기존 정기 청구 예약 취소 실패:', err.message);
      return NextResponse.json({ error: '기존 결제 예약을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
  }

  const amount = seatCount * TEACHER_SEAT_PRICE_KRW;
  const teacherId = auth.user.id;
  const paymentId = `seat-${crypto.randomUUID().replace(/-/g, '').slice(0, 24)}`;

  // 첫 달 요금을 즉시 청구 — 실패하면 아무것도 저장하지 않는다(트랜잭션적 실패 처리)
  try {
    await payWithBillingKey({
      paymentId,
      billingKey,
      orderName: TEACHER_SEAT_ORDER_NAME,
      amountTotal: amount,
      customerId: teacherId,
    });
  } catch (err: any) {
    console.error('❌ 좌석 구독 첫 결제 실패:', err.message);
    return NextResponse.json({ error: '결제에 실패했습니다. 카드 정보를 확인해 주세요.' }, { status: 400 });
  }

  const currentPeriodEnd = addMonths(new Date(), 1);

  const { error: upsertError } = await supabaseAdmin.from('teacher_subscriptions').upsert(
    {
      teacher_id: teacherId,
      portone_billing_key: billingKey,
      seat_count: seatCount,
      status: 'active',
      current_period_end: currentPeriodEnd.toISOString(),
      cancel_at_period_end: false,
      next_schedule_id: null,
      last_charged_payment_id: paymentId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'teacher_id' }
  );

  if (upsertError) {
    console.error('❌ 구독 정보 저장 실패:', upsertError.message);
    return NextResponse.json({ error: '구독 정보 저장에 실패했습니다.' }, { status: 500 });
  }

  // 옛 카드의 빌링키는 더 쓰지 않는다. 이미 새 결제가 끝났으므로 삭제 실패는 로그만 남긴다.
  if (existing?.portone_billing_key && existing.portone_billing_key !== billingKey) {
    try {
      await deleteBillingKey(existing.portone_billing_key);
    } catch (err: any) {
      console.error('❌ 옛 빌링키 삭제 실패:', err.message);
    }
  }

  try {
    await scheduleNextSeatCharge({ teacherId, billingKey, seatCount, timeToPay: currentPeriodEnd });
  } catch (err: any) {
    // 첫 결제는 이미 성공했으므로 구독 자체는 유효하다(되돌리면 받은 돈을 취소해야 해서 더 위험함).
    // 예약이 없으면 결제일 이후 getSubscriptionState가 past_due로 판정해 카드 재등록을 안내한다.
    console.error('❌ 다음 정기 청구 예약 실패:', err.message);
  }

  return NextResponse.json({ success: true });
}
