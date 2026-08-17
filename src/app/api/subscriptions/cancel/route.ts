export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { revokePaymentSchedules, deleteBillingKey } from '@/lib/portone';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: subscription } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('portone_billing_key, next_schedule_id')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  if (!subscription?.portone_billing_key) {
    return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 400 });
  }

  // 카드 변경은 이번 스코프에서는 "해지 후 재등록"으로 단순화한다(전용 카드교체 플로우는 스코프 밖).
  if (subscription.next_schedule_id) {
    try {
      await revokePaymentSchedules([subscription.next_schedule_id]);
    } catch (err: any) {
      console.error('❌ 예약된 정기 청구 취소 실패:', err.message);
    }
  }

  try {
    await deleteBillingKey(subscription.portone_billing_key);
  } catch (err: any) {
    console.error('❌ 빌링키 삭제 실패:', err.message);
  }

  const { error } = await supabaseAdmin
    .from('teacher_subscriptions')
    .update({
      status: 'canceled',
      next_schedule_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq('teacher_id', auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
