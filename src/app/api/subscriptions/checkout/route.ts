export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { payWithBillingKey, createPaymentSchedule } from '@/lib/portone';
import { TEACHER_SEAT_PRICE_KRW } from '@/lib/products';

const SEAT_ORDER_NAME = '리드이비 선생님 좌석 구독';

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
  if (!billingKey) {
    return NextResponse.json({ error: '카드 등록 정보가 없습니다.' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('status, portone_billing_key')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  // billing_key가 없으면 status가 'active'로 남아 있어도(Stripe → PortOne 전환 이전 구독 등)
  // 실제로는 청구할 수단이 없는 상태이므로 신규 구독처럼 카드 등록을 다시 받는다.
  if (existing?.portone_billing_key && ['active', 'trialing', 'past_due'].includes(existing.status)) {
    return NextResponse.json({ error: '이미 구독 중입니다. 좌석 변경은 좌석 변경 기능을 사용해 주세요.' }, { status: 400 });
  }

  const amount = seatCount * TEACHER_SEAT_PRICE_KRW;
  const teacherId = auth.user.id;
  const paymentId = `seat-${teacherId}-${crypto.randomUUID().slice(0, 8)}`;

  // 첫 달 요금을 즉시 청구 — 실패하면 아무것도 저장하지 않는다(트랜잭션적 실패 처리)
  try {
    await payWithBillingKey({
      paymentId,
      billingKey,
      orderName: SEAT_ORDER_NAME,
      amountTotal: amount,
      customerId: teacherId,
    });
  } catch (err: any) {
    console.error('❌ 좌석 구독 첫 결제 실패:', err.message);
    return NextResponse.json({ error: '결제에 실패했습니다. 카드 정보를 확인해 주세요.' }, { status: 400 });
  }

  const currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const { error: upsertError } = await supabaseAdmin.from('teacher_subscriptions').upsert(
    {
      teacher_id: teacherId,
      portone_billing_key: billingKey,
      seat_count: seatCount,
      status: 'active',
      current_period_end: currentPeriodEnd.toISOString(),
      last_charged_payment_id: paymentId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'teacher_id' }
  );

  if (upsertError) {
    console.error('❌ 구독 정보 저장 실패:', upsertError.message);
    return NextResponse.json({ error: '구독 정보 저장에 실패했습니다.' }, { status: 500 });
  }

  // 다음 달 정기 청구 예약 — Stripe와 달리 자동 반복이 없어 매번 다음 1건을 직접 예약해야 한다.
  try {
    const nextPaymentId = `seat-${teacherId}-${crypto.randomUUID().slice(0, 8)}`;
    const scheduleResult = await createPaymentSchedule({
      paymentId: nextPaymentId,
      billingKey,
      orderName: SEAT_ORDER_NAME,
      amountTotal: amount,
      timeToPay: currentPeriodEnd.toISOString(),
      customerId: teacherId,
    });

    await supabaseAdmin
      .from('teacher_subscriptions')
      .update({ next_schedule_id: scheduleResult.schedule.id })
      .eq('teacher_id', teacherId);
  } catch (err: any) {
    // 첫 결제는 이미 성공했으므로 구독 자체는 유효하다 — 다음 청구 예약 실패는 로그만 남기고
    // 후속 웹훅/운영 확인으로 대응(트랜잭션적으로 되돌리면 이미 받은 돈을 취소해야 해서 더 위험함).
    console.error('❌ 다음 정기 청구 예약 실패:', err.message);
  }

  return NextResponse.json({ success: true });
}
