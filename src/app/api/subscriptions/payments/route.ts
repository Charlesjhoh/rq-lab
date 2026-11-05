export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { getBillingKeyPayments } from '@/lib/portone';

// 좌석 결제는 orders 테이블에 남지 않아 포트원에서 내역을 조회한다. 재등록 전 카드의 내역은 나오지 않는다.
export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: subscription } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('portone_billing_key')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  if (!subscription?.portone_billing_key) {
    return NextResponse.json({ payments: [] });
  }

  try {
    const items = await getBillingKeyPayments(subscription.portone_billing_key);
    const payments = items.flatMap((p) =>
      p.status === 'PAID' || p.status === 'PARTIAL_CANCELLED' || p.status === 'CANCELLED'
        ? [{ id: p.id, paidAt: p.paidAt ?? p.requestedAt, orderName: p.orderName, amount: p.amount.total, status: p.status }]
        : []
    );
    return NextResponse.json({ payments });
  } catch (err: any) {
    console.error('❌ 좌석 결제 내역 조회 실패:', err.message);
    return NextResponse.json({ error: '결제 내역을 불러오지 못했습니다.' }, { status: 500 });
  }
}
