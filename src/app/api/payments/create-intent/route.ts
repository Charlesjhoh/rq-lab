import { NextResponse } from 'next/server';
import Stripe from 'stripe';

// Stripe SDK 초기화 (서버 전용 비밀키 사용)
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2023-10-16' as any, // 최신 API 버전 지정
});

export async function POST(request: Request) {
  try {
    const { amount, currency = 'usd', couponCode, userId, classId } = await request.json();

    // 1. 필수 입력값 검증 (결제 금액이 0 이하인 경우 방지)
    if (!amount || amount <= 0) {
      return NextResponse.json(
        { message: '올바른 결제 금액(amount)이 필요합니다.' },
        { status: 400 }
      );
    }

    // 2. Stripe PaymentIntent 생성
    // Stripe는 금액을 소수점이 없는 단위(예: $10.00 -> 1000 cents)로 처리해야 합니다.
    const unitAmount = Math.round(amount * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: unitAmount,
      currency: currency.toLowerCase(),
      // 자동 결제 수단 활성화 (카드, Apple Pay, Google Pay 등)
      automatic_payment_methods: {
        enabled: true,
      },
      // 정산 및 추적을 위한 메타데이터 저장
      metadata: {
        userId: userId || 'guest',
        classId: classId || 'unknown',
        couponCode: couponCode || 'NONE',
        issuer: couponCode ? 'GGUG' : 'DIRECT', // 정산 주체 기록
      },
    });

    // 3. 성공 응답 반환 (클라이언트 결제 완료용 clientSecret)
    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      currency: currency,
    });

  } catch (err: any) {
    console.error('Stripe PaymentIntent 생성 에러:', err);
    return NextResponse.json(
      { message: err.message || 'Stripe 결제 요청 생성 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}