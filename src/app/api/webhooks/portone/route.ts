export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { grantEntitlementForOrder } from '@/lib/payments';
import { getPayment, verifyPortOneWebhook } from '@/lib/portone';
import { addMonths } from '@/lib/subscription-state';
import { scheduleNextSeatCharge } from '@/lib/subscription-billing';
import { revokeEntitlementForOrder } from '@/lib/refunds';

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

    // 4. 결제 부분 취소는 매니저 환불 API(/api/manager/orders/refund)가 직접 DB에 반영하므로
    // 여기서는 로그만 남긴다(포트원 콘솔에서 직접 한 부분취소는 자동 회수하지 않음)
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
    // 첫 결제와 좌석 증설 차액은 API가 동기적으로 처리한다. 예약 결제만 주기를 넘긴다.
    if (payment.scheduleId) {
      await handleSubscriptionChargeSucceeded(paymentId, payment.billingKey);
    }
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
// 웹훅은 재전송될 수 있어 last_charged_payment_id로 같은 결제를 두 번 처리하지 않도록 막고,
// 앞선 시도가 예약 단계에서 실패했다면(next_schedule_id가 비어 있음) 예약만 다시 시도한다.
async function handleSubscriptionChargeSucceeded(paymentId: string, billingKey: string) {
  const { data: sub } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('teacher_id, seat_count, status, cancel_at_period_end, current_period_end, last_charged_payment_id, next_schedule_id')
    .eq('portone_billing_key', billingKey)
    .maybeSingle();

  if (!sub) return;

  // 해지는 예약 취소가 성공해야 완료되므로 정상이라면 여기 오지 않는다. 구독을 되살리지 말고
  // 운영자가 확인해 환불할 수 있게 로그를 남긴다.
  if (sub.status === 'canceled' || sub.cancel_at_period_end) {
    console.error('❌ 해지된 구독에 정기 청구 발생 — 환불 확인 필요', paymentId);
    return;
  }

  let periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : new Date();

  if (sub.last_charged_payment_id === paymentId) {
    if (sub.next_schedule_id) return; // 이미 처리됨(멱등)
  } else {
    periodEnd = addMonths(periodEnd, 1);

    const { data: flipped } = await supabaseAdmin
      .from('teacher_subscriptions')
      .update({
        status: 'active',
        current_period_end: periodEnd.toISOString(),
        last_charged_payment_id: paymentId,
        next_schedule_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('portone_billing_key', billingKey)
      .or(`last_charged_payment_id.is.null,last_charged_payment_id.neq.${paymentId}`)
      .select()
      .maybeSingle();

    if (!flipped) return; // 동시에 다른 경로에서 이미 처리됨
  }

  // 실패하면 예외가 500 응답이 되어 포트원이 웹훅을 다시 보내고, 위 재시도 분기로 들어온다.
  await scheduleNextSeatCharge({
    teacherId: sub.teacher_id,
    billingKey,
    seatCount: sub.seat_count,
    timeToPay: periodEnd,
  });
}

async function handleTransactionFailed(paymentId: string) {
  const payment = await getPayment(paymentId);
  const billingKey = 'billingKey' in payment ? payment.billingKey : undefined;
  const scheduleId = 'scheduleId' in payment ? payment.scheduleId : undefined;
  // 단건결제 실패는 orders가 계속 pending으로 남을 뿐이고, 첫 결제·차액 결제 실패는 API가 바로
  // 응답하므로 이미 낸 구독을 건드리면 안 된다. 예약 결제 실패만 미납으로 처리한다.
  if (!billingKey || !scheduleId) return;

  await supabaseAdmin
    .from('teacher_subscriptions')
    .update({ status: 'past_due', next_schedule_id: null, updated_at: new Date().toISOString() })
    .eq('portone_billing_key', billingKey)
    .in('status', ['active', 'trialing']);
}

async function handleTransactionCancelled(paymentId: string) {
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('*')
    .eq('portone_payment_id', paymentId)
    .maybeSingle();

  if (!order || order.status !== 'paid') return;

  await revokeEntitlementForOrder(order, true);

  await supabaseAdmin
    .from('orders')
    .update({ status: 'refunded', updated_at: new Date().toISOString() })
    .eq('id', order.id);

  console.log(`💸 환불 반영 완료 — order ${order.id}`);
}
