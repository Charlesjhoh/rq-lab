import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";

// 🔥 [필수 1] Next.js 빌드 시 정적 수집 대상에서 제외 (동적 API 강제)
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.STRIPE_SECRET_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { error: "Stripe API Key가 설정되지 않았습니다." },
        { status: 500 }
      );
    }

    // 🔥 [필수 2] Stripe 객체를 요청 처리(POST) 함수 안에서 초기화
    const stripe = new Stripe(apiKey, {
      apiVersion: "2023-10-16" as any, // 사용 중인 Stripe API 버전
    });

    const body = await req.json();
    const { amount, currency = "usd" } = body;

    // PaymentIntent 생성
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      automatic_payment_methods: { enabled: true },
    });

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error: any) {
    console.error("Payment Intent Error:", error);
    return NextResponse.json(
      { error: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}