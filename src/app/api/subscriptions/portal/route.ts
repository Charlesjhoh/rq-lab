export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { getStripe } from '@/lib/stripe';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: subscription } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('stripe_customer_id')
    .eq('teacher_id', auth.user.id)
    .maybeSingle();

  if (!subscription?.stripe_customer_id) {
    return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 400 });
  }

  const stripe = getStripe();
  const origin = req.nextUrl.origin;

  const session = await stripe.billingPortal.sessions.create({
    customer: subscription.stripe_customer_id,
    return_url: `${origin}/teacher/classes`,
  });

  return NextResponse.json({ url: session.url });
}
