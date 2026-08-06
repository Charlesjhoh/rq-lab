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

  return NextResponse.json({ received: true }, { status: 200 });
}