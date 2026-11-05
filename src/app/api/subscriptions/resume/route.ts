export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { getSubscriptionState } from '@/lib/subscription-state';
import { scheduleNextSeatCharge } from '@/lib/subscription-billing';

// 해지 예약을 취소한다. 해지 때 빌링키를 지웠으므로 카드를 다시 등록받지만, 이번 기간은 이미
// 결제했으니 지금 청구하지 않고 원래 결제일에 다음 청구만 예약한다.
export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const billingKey = String(body.billingKey || '');
  if (!billingKey) {
    return NextResponse.json({ error: '카드 등록 정보가 없습니다.' }, { status: 400 });
  }

  const { data: subscription } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('status, seat_count, current_period_end, cancel_at_period_end, portone_billing_key')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  if (getSubscriptionState(subscription) !== 'canceling' || !subscription?.current_period_end) {
    return NextResponse.json({ error: '재개할 수 있는 구독이 없습니다.' }, { status: 400 });
  }

  // 예약에 실패하면 결제 없이 구독만 살아나므로, 예약이 된 뒤에 해지 예약을 푼다.
  try {
    await scheduleNextSeatCharge({
      teacherId: auth.user.id,
      billingKey,
      seatCount: subscription.seat_count,
      timeToPay: new Date(subscription.current_period_end),
    });
  } catch (err: any) {
    console.error('❌ 구독 재개 예약 실패:', err.message);
    return NextResponse.json({ error: '구독을 재개하지 못했습니다. 잠시 후 다시 시도해 주세요.' }, { status: 500 });
  }

  const { error } = await supabaseAdmin
    .from('teacher_subscriptions')
    .update({
      portone_billing_key: billingKey,
      cancel_at_period_end: false,
      updated_at: new Date().toISOString(),
    })
    .eq('teacher_id', auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
