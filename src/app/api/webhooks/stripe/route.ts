import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { grantEntitlementForOrder } from '@/lib/payments';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secretKey || !webhookSecret) {
    console.error('❌ Stripe 환경변수가 설정되지 않았습니다.');
    return NextResponse.json(
      { error: '서버 환경변수 설정 누락' },
      { status: 500 }
    );
  }

  const stripe = new Stripe(secretKey, {
    apiVersion: '2023-10-16' as any,
  });

  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json(
      { error: 'Stripe Signature가 누락되었습니다.' },
      { status: 400 }
    );
  }

  let event: Stripe.Event;

  try {
    // Webhook 요청 바디를 raw text로 추출하여 서명 검증
    const rawBody = await req.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: any) {
    console.error(`❌ Webhook 서명 검증 실패: ${err.message}`);
    return NextResponse.json(
      { error: `Webhook Error: ${err.message}` },
      { status: 400 }
    );
  }

  // 1. 결제 성공 이벤트 처리 (payment_intent.succeeded)
  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const metadata = paymentIntent.metadata || {};

    const userId = metadata.userId;
    const orderId = metadata.orderId;
    const couponCode = metadata.coupon_code || null;
    const amount = paymentIntent.amount;

    console.log(`💳 [Stripe Webhook] 결제 성공 수신: ${paymentIntent.id}`);

    try {
      // 1-1. 엔타이틀먼트 부여 (orders.status -> paid + 패키지 크레딧/리포트 잠금 해제)
      if (orderId && orderId !== 'none') {
        await grantEntitlementForOrder(orderId);
      } else {
        console.error('❌ Webhook: metadata에 orderId가 없음', paymentIntent.id);
      }

      // 1-2. payment_logs 내역 기록 (정산 및 아카이빙용)
      await supabaseAdmin.from('payment_logs').insert({
        payment_intent_id: paymentIntent.id,
        user_id: userId,
        amount: amount,
        currency: paymentIntent.currency,
        status: 'succeeded',
        coupon_code: couponCode,
        issuer: metadata.issuer || 'stripe',
        created_at: new Date().toISOString(),
      });

    } catch (dbErr) {
      console.error('❌ Webhook 트랜잭션 처리 중 오류 발생:', dbErr);
      return NextResponse.json({ error: 'DB 처리 오류' }, { status: 500 });
    }
  }

  // 2. 선생님 좌석 구독: 최초 결제 완료
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    if (session.mode === 'subscription' && session.subscription) {
      const teacherId = session.metadata?.teacherId;

      try {
        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        await upsertTeacherSubscription(subscription, teacherId);
      } catch (dbErr) {
        console.error('❌ 구독 checkout.session.completed 처리 중 오류:', dbErr);
        return NextResponse.json({ error: 'DB 처리 오류' }, { status: 500 });
      }
    }
  }

  // 3. 선생님 좌석 구독: 좌석 수/상태 변경 (매 결제 주기 갱신, 좌석 수량 변경 포함)
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      await upsertTeacherSubscription(subscription, subscription.metadata?.teacherId);
    } catch (dbErr) {
      console.error('❌ 구독 customer.subscription.updated 처리 중 오류:', dbErr);
      return NextResponse.json({ error: 'DB 처리 오류' }, { status: 500 });
    }
  }

  // 4. 선생님 좌석 구독: 해지 완료 — 기존 학생의 class_id는 건드리지 않음 (강제 탈퇴는 스코프 밖)
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object as Stripe.Subscription;

    try {
      const { error } = await supabaseAdmin
        .from('teacher_subscriptions')
        .update({ status: 'canceled', seat_count: 0, updated_at: new Date().toISOString() })
        .eq('stripe_subscription_id', subscription.id);

      if (error) throw error;
    } catch (dbErr) {
      console.error('❌ 구독 customer.subscription.deleted 처리 중 오류:', dbErr);
      return NextResponse.json({ error: 'DB 처리 오류' }, { status: 500 });
    }
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

async function upsertTeacherSubscription(subscription: Stripe.Subscription, teacherIdHint?: string) {
  let teacherId = teacherIdHint;

  if (!teacherId) {
    const { data: existing } = await supabaseAdmin
      .from('teacher_subscriptions')
      .select('teacher_id')
      .eq('stripe_subscription_id', subscription.id)
      .maybeSingle();
    teacherId = existing?.teacher_id;
  }

  if (!teacherId) {
    console.error('❌ 구독 웹훅: teacherId를 찾을 수 없음', subscription.id);
    return;
  }

  const item = subscription.items.data[0];

  // 💡 Stripe API 2025-03-31 이후 current_period_end가 Subscription에서
  // SubscriptionItem으로 이동함. 계정/webhook의 API 버전에 따라 이벤트 payload
  // 모양이 다를 수 있어 두 위치 모두 확인해서 안전하게 읽는다.
  const periodEndUnix = (subscription as any).current_period_end ?? (item as any)?.current_period_end;

  const { error } = await supabaseAdmin.from('teacher_subscriptions').upsert(
    {
      teacher_id: teacherId,
      stripe_customer_id: subscription.customer as string,
      stripe_subscription_id: subscription.id,
      stripe_price_id: item?.price.id,
      seat_count: item?.quantity || 0,
      status: subscription.status,
      current_period_end: periodEndUnix ? new Date(periodEndUnix * 1000).toISOString() : null,
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'teacher_id' }
  );

  if (error) throw error;
}