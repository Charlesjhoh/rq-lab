import { supabaseAdmin } from './supabase-admin';
import { PRODUCT_PRICES } from './products';

// 이용약관 제7조 — 단건 결제 상품의 청약철회 가능 기간
export const REFUND_WINDOW_DAYS = 7;

export type RefundQuote = {
  orderId: string;
  productType: string;
  paidAmount: number;
  paidAt: string;
  daysSincePaid: number;
  withinWindow: boolean;
  usedCredits: number | null;
  totalCredits: number | null;
  suggestedAmount: number;
  formula: string;
  notes: string[];
};

/**
 * 주문의 환불 대상 여부를 확인하고 약관 기준 환불액을 계산한다. 환불할 수 없는 주문이면
 * { error }를 돌려준다. refunded_amount 컬럼(0013 마이그레이션)이 없으면 여기서 실패하므로
 * 포트원 취소까지 가지 않는다.
 */
export async function getRefundQuote(orderId: string) {
  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('id, user_id, status, product_type, final_amount, created_at, portone_payment_id, result_id, refunded_amount')
    .eq('id', orderId)
    .maybeSingle();

  if (error) {
    return { error: `주문 조회 실패: ${error.message} (0013_order_refunds.sql 마이그레이션을 실행했는지 확인하세요)` };
  }
  if (!order) return { error: '주문을 찾을 수 없습니다.' };
  if (order.status !== 'paid' && order.status !== 'completed') {
    return { error: '결제 완료 상태의 주문만 환불할 수 있습니다.' };
  }
  if (Number(order.refunded_amount) > 0) return { error: '이미 환불 처리된 주문입니다.' };
  if (!order.portone_payment_id) return { error: '포트원 결제 건이 아니어서 이 화면에서 환불할 수 없습니다.' };

  const paidAmount = Number(order.final_amount) || 0;
  if (paidAmount <= 0) return { error: '결제금액이 0원인 주문은 환불할 금액이 없습니다.' };

  const daysSincePaid = Math.floor((Date.now() - new Date(order.created_at).getTime()) / (24 * 60 * 60 * 1000));
  const withinWindow = daysSincePaid < REFUND_WINDOW_DAYS;
  const notes: string[] = [];
  if (!withinWindow) {
    notes.push(`결제 후 ${daysSincePaid}일이 지나 약관상 청약철회 기간(${REFUND_WINDOW_DAYS}일)을 넘었습니다. 회사 귀책 등 예외 사유가 있을 때만 진행하세요.`);
  }

  let usedCredits: number | null = null;
  let totalCredits: number | null = null;
  let suggestedAmount = paidAmount;
  let formula = `결제금액 ₩${paidAmount.toLocaleString()} 전액`;

  if (order.product_type === 'package_2x_month') {
    const { data: pkg } = await supabaseAdmin
      .from('credit_packages')
      .select('total_credits, remaining_credits')
      .eq('order_id', order.id)
      .maybeSingle();

    if (!pkg) return { error: '이 주문에 연결된 크레딧 패키지를 찾을 수 없습니다.' };

    totalCredits = pkg.total_credits;
    usedCredits = pkg.total_credits - pkg.remaining_credits;
    const unitPrice = PRODUCT_PRICES.single_report;
    suggestedAmount = Math.max(0, paidAmount - usedCredits * unitPrice);
    formula = `₩${paidAmount.toLocaleString()} − 사용 ${usedCredits}회 × ₩${unitPrice.toLocaleString()} = ₩${suggestedAmount.toLocaleString()}`;
    if (suggestedAmount === 0) notes.push('사용한 크레딧 차감액이 결제금액 이상이라 약관상 환불액이 없습니다.');
  } else if (order.product_type === 'single_report') {
    notes.push('리포트를 이미 열람했다면 약관상 청약철회가 제한됩니다. 열람 여부를 확인한 뒤 진행하세요.');
  }

  const quote: RefundQuote = {
    orderId: order.id,
    productType: order.product_type,
    paidAmount,
    paidAt: order.created_at,
    daysSincePaid,
    withinWindow,
    usedCredits,
    totalCredits,
    suggestedAmount,
    formula,
    notes,
  };

  return { quote, order };
}

/**
 * 환불된 주문의 이용권을 회수한다. 패키지는 남은 크레딧을 0으로(미사용분을 환불했으므로),
 * 단건 리포트는 전액환불일 때만 다시 잠근다(부분환불은 재량 보상이라 열람권 유지).
 * 웹훅(포트원 콘솔에서 직접 전액취소한 경우)과 매니저 환불 API가 함께 쓰며, 여러 번 불러도 안전하다.
 */
export async function revokeEntitlementForOrder(
  order: { id: string; product_type: string; result_id: string | null },
  fullRefund: boolean
) {
  if (order.product_type === 'package_2x_month') {
    await supabaseAdmin
      .from('credit_packages')
      .update({ remaining_credits: 0 })
      .eq('order_id', order.id);
  } else if (order.product_type === 'single_report' && order.result_id && fullRefund) {
    await supabaseAdmin
      .from('reading_results')
      .update({ is_unlocked: false })
      .eq('id', order.result_id)
      .eq('unlock_order_id', order.id);
  }
}
