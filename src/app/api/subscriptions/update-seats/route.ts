export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const seatCount = Number(body.seatCount);
  if (!Number.isInteger(seatCount) || seatCount < 1) {
    return NextResponse.json({ error: '좌석 수가 올바르지 않습니다.' }, { status: 400 });
  }

  const { data: subscription } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('stripe_subscription_id, status')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  if (!subscription?.stripe_subscription_id || !['active', 'trialing', 'past_due'].includes(subscription.status)) {
    return NextResponse.json({ error: '활성화된 구독이 없습니다. 먼저 좌석을 구매해 주세요.' }, { status: 400 });
  }

  const { data: classes } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('teacher_id', auth.user.id);

  const classIds = (classes || []).map((c) => c.id);
  const { count: currentStudentCount } = classIds.length > 0
    ? await supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }).in('class_id', classIds)
    : { count: 0 };

  if (seatCount < (currentStudentCount || 0)) {
    return NextResponse.json(
      { error: `현재 소속 학생 수(${currentStudentCount})보다 적게는 줄일 수 없습니다.` },
      { status: 400 }
    );
  }

  const stripe = getStripe();
  const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
  const itemId = stripeSubscription.items.data[0]?.id;

  if (!itemId) {
    return NextResponse.json({ error: '구독 항목을 찾을 수 없습니다.' }, { status: 500 });
  }

  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
    items: [{ id: itemId, quantity: seatCount }],
    proration_behavior: 'create_prorations',
  });

  return NextResponse.json({ updated: true });
}
