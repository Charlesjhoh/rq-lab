export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { revokePaymentSchedules, deleteBillingKey } from '@/lib/portone';
import { getSubscriptionState } from '@/lib/subscription-state';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: subscription } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('status, current_period_end, cancel_at_period_end, portone_billing_key, next_schedule_id')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  if (!subscription?.portone_billing_key) {
    return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 400 });
  }

  const state = getSubscriptionState(subscription);
  if (state === 'canceling') {
    return NextResponse.json({ success: true });
  }

  // 예약이 남으면 해지 후에도 청구되므로, 취소에 실패하면 해지를 완료하지 않고 다시 시도하게 한다.
  if (subscription.next_schedule_id) {
    try {
      await revokePaymentSchedules([subscription.next_schedule_id]);
    } catch (err: any) {
      console.error('❌ 예약된 정기 청구 취소 실패:', err.message);
      return NextResponse.json({ error: '결제 예약을 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
    }
  }

  // 카드 변경은 이번 스코프에서는 "해지 후 재등록"으로 단순화한다(전용 카드교체 플로우는 스코프 밖).
  try {
    await deleteBillingKey(subscription.portone_billing_key);
  } catch (err: any) {
    console.error('❌ 빌링키 삭제 실패:', err.message);
  }

  // 결제한 기간은 끝까지 쓰게 한다. 기간이 끝나면 getSubscriptionState가 inactive로 판정한다.
  const { error } = await supabaseAdmin
    .from('teacher_subscriptions')
    .update({
      ...(state === 'active' ? { cancel_at_period_end: true } : { status: 'canceled' }),
      next_schedule_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('teacher_id', auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
