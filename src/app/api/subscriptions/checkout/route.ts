export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const priceId = process.env.STRIPE_TEACHER_SEAT_PRICE_ID;
  if (!priceId) {
    return NextResponse.json({ error: '좌석 상품이 설정되지 않았습니다.' }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const seatCount = Number(body.seatCount);
  if (!Number.isInteger(seatCount) || seatCount < 1) {
    return NextResponse.json({ error: '좌석 수가 올바르지 않습니다.' }, { status: 400 });
  }

  const { data: existing } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('stripe_customer_id, status')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  if (existing && ['active', 'trialing', 'past_due'].includes(existing.status)) {
    return NextResponse.json({ error: '이미 구독 중입니다. 좌석 변경은 좌석 변경 기능을 사용해 주세요.' }, { status: 400 });
  }

  const stripe = getStripe();
  let customerId = existing?.stripe_customer_id || null;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: auth.user.email || undefined,
      metadata: { teacherId: auth.user.id },
    });
    customerId = customer.id;

    await supabaseAdmin
      .from('teacher_subscriptions')
      .upsert({ teacher_id: auth.user.id, stripe_customer_id: customerId }, { onConflict: 'teacher_id' });
  }

  const origin = req.nextUrl.origin;

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceId, quantity: seatCount }],
    success_url: `${origin}/teacher/classes?checkout=success`,
    cancel_url: `${origin}/teacher/classes?checkout=cancel`,
    metadata: { teacherId: auth.user.id },
    subscription_data: { metadata: { teacherId: auth.user.id } },
  });

  return NextResponse.json({ url: session.url });
}
