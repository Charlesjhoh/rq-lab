import { supabaseAdmin } from './supabase-admin';
import { PACKAGE_TOTAL_CREDITS, PACKAGE_DURATION_DAYS } from './products';

export { PACKAGE_TOTAL_CREDITS, PACKAGE_DURATION_DAYS };

/**
 * Idempotently grants whatever the given paid order entitles the user to.
 * Flips orders.status pending -> paid atomically first; only the caller that
 * wins that flip (webhook vs. client confirm, whichever arrives first) grants
 * the entitlement, so calling this twice for the same order is safe.
 */
export async function grantEntitlementForOrder(orderId: string) {
  const { data: flipped, error: flipError } = await supabaseAdmin
    .from('orders')
    .update({ status: 'paid', updated_at: new Date().toISOString() })
    .eq('id', orderId)
    .neq('status', 'paid')
    .select()
    .maybeSingle();

  if (flipError) {
    console.error('❌ 주문 상태 paid 전환 실패:', flipError.message);
    throw flipError;
  }

  if (!flipped) {
    // 이미 다른 경로(웹훅/클라이언트 confirm)에서 처리됨
    return { granted: false as const };
  }

  const order = flipped;

  // 쿠폰이 걸린 주문이면 여기(엔타이틀먼트가 실제로 지급되는 유일한 관문)서 사용 횟수를 정산한다.
  // redeem_coupon()은 max_uses 상한을 원자적으로 체크-후-증가하므로 동시 요청에도 안전하다.
  if (order.coupon_id) {
    const { data: redeemed, error: redeemError } = await supabaseAdmin.rpc('redeem_coupon', {
      p_coupon_id: order.coupon_id,
    });

    if (redeemError) {
      console.error('❌ 쿠폰 사용 카운트 갱신 실패:', redeemError.message);
    } else if (!redeemed) {
      if (order.final_amount === 0) {
        // 무료(freePass) 주문 — 실제로 결제된 돈이 없으므로 한도 초과 시 지급을 거부한다
        await supabaseAdmin
          .from('orders')
          .update({ status: 'failed', updated_at: new Date().toISOString() })
          .eq('id', orderId);
        return { granted: false as const, reason: 'coupon_limit_exceeded' as const };
      }
      // 유료 주문은 결제가 이미 성공한 뒤이므로 지급은 그대로 진행하고 이상 상태만 기록
      console.error('⚠️ 쿠폰 사용 한도 초과 상태에서 유료 주문이 처리됨(결제 완료라 지급은 진행):', orderId);
    }
  }

  if (order.product_type === 'package_2x_month') {
    const grantedAt = new Date();
    const expiresAt = new Date(grantedAt.getTime() + PACKAGE_DURATION_DAYS * 24 * 60 * 60 * 1000);

    const { error } = await supabaseAdmin.from('credit_packages').insert({
      user_id: order.user_id,
      order_id: order.id,
      total_credits: PACKAGE_TOTAL_CREDITS,
      remaining_credits: PACKAGE_TOTAL_CREDITS,
      granted_at: grantedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
    });

    if (error) {
      console.error('❌ 패키지 크레딧 지급 실패:', error.message);
      throw error;
    }
  } else {
    if (!order.result_id) {
      console.error('❌ 단건 결제인데 result_id가 없음:', order.id);
      return { granted: true as const, order };
    }

    const { error } = await supabaseAdmin
      .from('reading_results')
      .update({
        is_unlocked: true,
        unlock_source: 'single_purchase',
        unlocked_at: new Date().toISOString(),
        unlock_order_id: order.id,
      })
      .eq('id', order.result_id);

    if (error) {
      console.error('❌ 리포트 잠금 해제 실패:', error.message);
      throw error;
    }
  }

  return { granted: true as const, order };
}
