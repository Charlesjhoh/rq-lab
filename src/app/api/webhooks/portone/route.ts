export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { grantEntitlementForOrder } from '@/lib/payments';
import { getPayment, createPaymentSchedule, verifyPortOneWebhook } from '@/lib/portone';
import { TEACHER_SEAT_PRICE_KRW } from '@/lib/products';

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const headers = Object.fromEntries(req.headers.entries());

  let webhook;
  try {
    webhook = await verifyPortOneWebhook(rawBody, headers);
  } catch (err: any) {
    console.error('❌ 포트원 웹훅 검증 실패:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    // 1. 결제(단건/정기청구) 승인 — 결제(예약 결제 포함)가 승인되었을 때
    if (webhook.type === 'Transaction.Paid') {
      await handleTransactionPaid(webhook.data.paymentId);
    }

    // 2. 결제(정기청구) 실패
    if (webhook.type === 'Transaction.Failed') {
      await handleTransactionFailed(webhook.data.paymentId);
    }

    // 3. 결제 전액 취소 (수동 환불 시 DB 롤백) — 정기구독 청구는 취소 롤백 대상이 아니므로
    // 단건결제 orders에서만 매칭되면 처리한다
    if (webhook.type === 'Transaction.Cancelled') {
      await handleTransactionCancelled(webhook.data.paymentId);
    }

    // 4. 결제 부분 취소는 재량 환불일 수 있어 자동 롤백하지 않고 로그만 남긴다
    if (webhook.type === 'Transaction.PartialCancelled') {
      console.log(`ℹ️ 부분 취소 감지(자동 회수 안 함) — paymentId ${webhook.data.paymentId}`);
    }
  } catch (err) {
    console.error('❌ 포트원 웹훅 처리 중 오류:', err);
    return NextResponse.json({ error: 'DB 처리 오류' }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function handleTransactionPaid(paymentId: string) {
  const payment = await getPayment(paymentId);
  if (payment.status !== 'PAID') return;

  if (payment.billingKey) {
    await handleSubscriptionChargeSucceeded(paymentId, payment.billingKey);
    return;
  }

  // 빌링키가 없으면 개인 결제(리포트/패키지) 단건결제 — orders.portone_payment_id로 매칭해서
  // grantEntitlementForOrder를 호출한다. 클라이언트 confirm과 경쟁해도 기존 pending/completed→paid
  // 원자적 플립으로 안전(멱등, src/lib/payments.ts 그대로 재사용).
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id')
    .eq('portone_payment_id', paymentId)
    .maybeSingle();

  if (order) {
    await grantEntitlementForOrder(order.id);
  } else {
    console.error('❌ 웹훅: paymentId에 매칭되는 주문을 찾을 수 없음', paymentId);
  }
}

// 선생님 좌석 구독의 정기 청구가 성공했을 때: 다음 결제 주기로 갱신하고 다음 청구를 예약한다.
// 첫 결제는 subscriptions/checkout에서 이미 동기적으로 처리되지만 이 웹훅도 같은 paymentId로
// 들어올 수 있어, last_charged_payment_id로 같은 결제를 두 번 처리하지 않도록 막는다.
async function handleSubscriptionChargeSucceeded(paymentId: string, billingKey: string) {
  const { data: sub } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('teacher_id, seat_count, current_period_end, last_charged_payment_id')
    .eq('portone_billing_key', billingKey)
    .maybeSingle();

  if (!sub) return;
  if (sub.last_charged_payment_id === paymentId) return; // 이미 처리됨(멱등)

  const basis = sub.current_period_end ? new Date(sub.current_period_end) : new Date();
  const nextPeriodEnd = new Date(basis.getTime() + 30 * 24 * 60 * 60 * 1000);

  const { data: flipped } = await supabaseAdmin
    .from('teacher_subscriptions')
    .update({
      status: 'active',
      current_period_end: nextPeriodEnd.toISOString(),
      last_charged_payment_id: paymentId,
      updated_at: new Date().toISOString(),
    })
    .eq('portone_billing_key', billingKey)
    .or(`last_charged_payment_id.is.null,last_charged_payment_id.neq.${paymentId}`)
    .select()
    .maybeSingle();

  if (!flipped) return; // 동시에 다른 경로에서 이미 처리됨

  // 다음 정기 청구 예약 — Stripe와 달리 자동 반복이 없어 매번 다음 1건을 직접 예약해야 한다.
  const nextPaymentId = `seat-${sub.teacher_id}-${crypto.randomUUID().slice(0, 8)}`;
  const scheduleResult = await createPaymentSchedule({
    paymentId: nextPaymentId,
    billingKey,
    orderName: '리드이비 선생님 좌석 구독',
    amountTotal: sub.seat_count * TEACHER_SEAT_PRICE_KRW,
    timeToPay: nextPeriodEnd.toISOString(),
    customerId: sub.teacher_id,
  });

  await supabaseAdmin
    .from('teacher_subscriptions')
    .update({ next_schedule_id: scheduleResult.schedule.id })
    .eq('portone_billing_key', billingKey);
}

async function handleTransactionFailed(paymentId: string) {
  const payment = await getPayment(paymentId);
  const billingKey = 'billingKey' in payment ? payment.billingKey : undefined;
  if (!billingKey) return; // 단건결제 실패는 orders가 계속 pending으로 남을 뿐, 별도 처리 불필요

  await supabaseAdmin
    .from('teacher_subscriptions')
    .update({ status: 'past_due', updated_at: new Date().toISOString() })
    .eq('portone_billing_key', billingKey);
}

async function handleTransactionCancelled(paymentId: string) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('portone_payment_id', paymentId)
    .maybeSingle();

  if (!order || order.status !== 'paid') return;

  if (order.product_type === 'single_report' && order.result_id) {
    await supabaseAdmin
      .from('reading_results')
      .update({ is_unlocked: false })
      .eq('id', order.result_id)
      .eq('unlock_order_id', order.id);
  } else if (order.product_type === 'package_2x_month') {
    await supabaseAdmin
      .from('credit_packages')
      .update({ remaining_credits: 0 })
      .eq('order_id', order.id);
  }

  await supabaseAdmin
    .from('orders')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('id', order.id);

  console.log(`💸 환불 반영 완료 — order ${order.id}`);
}
