export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { cancelPayment, getPayment } from '@/lib/portone';
import { getRefundQuote, revokeEntitlementForOrder } from '@/lib/refunds';

function errorMessage(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

// 환불 미리보기 — 약관 기준 환불액(패키지는 결제금액 − 사용 크레딧 × 1회 정가)을 계산해 보여준다
export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) {
    return NextResponse.json({ error: 'orderId가 필요합니다.' }, { status: 400 });
  }

  const result = await getRefundQuote(orderId);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ quote: result.quote });
}

// 환불 실행 — 포트원 결제를 (부분)취소한 뒤 이용권을 회수하고 주문에 환불 내역을 기록한다
export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { orderId, amount, reason } = await req.json();
  const refundAmount = Number(amount);
  const refundReason = typeof reason === 'string' ? reason.trim() : '';

  if (!orderId || !Number.isInteger(refundAmount) || refundAmount <= 0) {
    return NextResponse.json({ error: '환불 금액을 1원 이상 정수로 입력해 주세요.' }, { status: 400 });
  }
  if (!refundReason) {
    return NextResponse.json({ error: '환불 사유를 입력해 주세요.' }, { status: 400 });
  }

  const result = await getRefundQuote(orderId);
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  const { order, quote } = result;

  if (refundAmount > quote.paidAmount) {
    return NextResponse.json({ error: '환불 금액이 결제금액보다 클 수 없습니다.' }, { status: 400 });
  }

  // 포트원 기준으로도 아직 한 번도 취소되지 않은 결제인지 확인 — 콘솔에서 직접 취소한 건 등을 걸러낸다
  const payment = await getPayment(order.portone_payment_id);
  if (payment.status !== 'PAID') {
    return NextResponse.json({ error: `포트원 결제 상태가 PAID가 아닙니다(${String(payment.status)}).` }, { status: 409 });
  }
  const cancellable = payment.amount.total - payment.amount.cancelled;
  if (cancellable !== quote.paidAmount) {
    return NextResponse.json(
      { error: `포트원 취소 가능 잔액(₩${cancellable.toLocaleString()})이 결제금액과 달라 진행할 수 없습니다.` },
      { status: 409 }
    );
  }

  try {
    await cancelPayment({
      paymentId: order.portone_payment_id,
      amount: refundAmount,
      reason: refundReason,
      currentCancellableAmount: cancellable,
    });
  } catch (err) {
    console.error('❌ 포트원 환불 실패:', err);
    return NextResponse.json({ error: `포트원 환불 실패: ${errorMessage(err)}` }, { status: 502 });
  }

  const fullRefund = refundAmount === quote.paidAmount;

  try {
    await revokeEntitlementForOrder(order, fullRefund);

    const { error: updateError } = await supabaseAdmin
      .from('orders')
      .update({
        status: fullRefund ? 'refunded' : order.status,
        refunded_amount: refundAmount,
        refunded_at: new Date().toISOString(),
        refund_reason: refundReason,
        refunded_by: auth.user.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) throw new Error(updateError.message);
  } catch (err) {
    // 돈은 이미 환불됐으므로 DB 반영 실패는 반드시 사람이 확인해야 한다
    console.error(`🚨 포트원 환불은 완료됐으나 DB 반영 실패 — order ${order.id} amount ${refundAmount}:`, err);
    return NextResponse.json(
      { error: `포트원 환불(₩${refundAmount.toLocaleString()})은 완료됐지만 DB 반영에 실패했습니다. 개발자에게 알려 주세요. (${errorMessage(err)})` },
      { status: 500 }
    );
  }

  console.log(
    `💸 매니저 환불 — refundedBy=${auth.user.id} order=${order.id} amount=${refundAmount}/${quote.paidAmount} full=${fullRefund}`
  );

  return NextResponse.json({ success: true, refundedAmount: refundAmount, fullRefund });
}
