export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { supabaseAdmin, requireUser } from '@/lib/supabase-admin';
import { PRODUCT_PRICES } from '@/lib/products';

export async function POST(req: Request) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) {
      return NextResponse.json(
        { error: 'Stripe API Key가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }

    const stripe = new Stripe(secretKey, {
      apiVersion: '2023-10-16' as any,
    });

    // 결제 주문 생성은 반드시 로그인한 본인 명의로만 — userId를 body에서 받아 그대로
    // 믿으면 남의 계정으로 주문을 만들거나(크레딧 오배정), 남의 resultId를 지정해 결제
    // 흐름을 태워 남의 리포트를 잠금 해제할 수 있었다.
    const auth = await requireUser(req.headers.get('Authorization'));
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }
    const userId = auth.user.id;

    const body = await req.json();
    const { couponCode, orderId: existingOrderId, resultId: rawResultId } = body;
    const productType = body.productType === 'package_2x_month' ? 'package_2x_month' : 'single_report';
    const resultId = productType === 'single_report' ? rawResultId || null : null;
    const currency = 'krw';
    // 💡 가격은 서버가 상품 종류로 확정한다 — 클라이언트가 보낸 금액은 신뢰하지 않음
    const amount = PRODUCT_PRICES[productType];

    // resultId가 실제로 이 사용자 소유인지 확인 — 아니면 남의 리포트를 대신 결제해서
    // 풀어버릴 수 있음
    if (resultId) {
      const { data: targetResult } = await supabaseAdmin
        .from('reading_results')
        .select('user_id')
        .eq('id', resultId)
        .maybeSingle();

      if (!targetResult || targetResult.user_id !== userId) {
        return NextResponse.json({ error: '본인 소유의 리포트만 결제할 수 있습니다.' }, { status: 403 });
      }
    }

    // 쿠폰 및 할인 계산 (센트 단위)
    let finalAmount = amount;
    let discountAmount = 0;
    let couponId = null;

    if (couponCode && couponCode.trim() !== '') {
      const { data: coupon, error: couponError } = await supabaseAdmin
        .from('coupons')
        .select('*')
        .ilike('code', couponCode.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (coupon) {
        const now = new Date();
        const expiresAt = coupon.expires_at ? new Date(coupon.expires_at) : null;

        if (!expiresAt || expiresAt > now) {
          couponId = coupon.id;
          const value = Number(coupon.discount_value) || 0;
          const type = String(coupon.discount_type).toLowerCase();

          if (type === 'percent' || type === 'percentage') {
            discountAmount = Math.round(amount * (value / 100));
          } else if (type === 'amount' || type === 'fixed') {
            discountAmount = value;
          }

          finalAmount = Math.max(0, amount - discountAmount);
        }
      }
    }

    let orderId = existingOrderId || null;
    const isFreePass = finalAmount <= 0;

    // 💡 KRW는 Stripe zero-decimal 통화라 원 단위 그대로 저장 (100 나누기 없음)
    const orderData: any = {
      original_amount: amount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      coupon_id: couponId,
      product_type: productType,
      result_id: resultId,
      status: isFreePass ? 'completed' : 'pending',
      user_id: userId,
    };

    // 💥 [핵심] 기존 orderId가 존재하면 UPDATE, 없으면 INSERT
    if (orderId) {
      // user_id를 WHERE에도 걸어서 남의 주문 id를 넘겨도 그 주문을 가로채 고쳐쓸 수
      // 없게 한다 — 매칭이 안 되면(남의 주문이거나 이미 지워짐) 새 주문을 만든다.
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('orders')
        .update(orderData)
        .eq('id', orderId)
        .eq('user_id', userId)
        .select('id')
        .maybeSingle();

      if (updateError) {
        console.error('주문 DB 업데이트 실패:', updateError);
      }
      if (!updated) {
        orderId = null;
      }
    }

    if (!orderId) {
      const { data: order, error: orderError } = await supabaseAdmin
        .from('orders')
        .insert(orderData)
        .select()
        .single();

      if (!orderError && order) {
        orderId = order.id;
      } else {
        console.error('주문 DB 생성 실패:', orderError);
      }
    }

    // 100% 할인 (0원) 처리
    if (isFreePass) {
      return NextResponse.json({
        isFreePass: true,
        freePass: true,
        message: '100% 할인 쿠폰이 적용되어 무료로 처리되었습니다.',
        originalAmount: amount,
        finalAmount: 0,
        discountAmount: amount,
        orderId: orderId,
      });
    }

    // Stripe PaymentIntent 생성
    const paymentIntent = await stripe.paymentIntents.create({
      amount: finalAmount,
      currency: currency.toLowerCase(),
      automatic_payment_methods: { enabled: true },
      metadata: {
        userId: userId || 'anonymous',
        orderId: orderId || 'none',
        couponId: couponId || 'NONE',
        productId: productType,
        resultId: resultId || 'none',
      },
    });

    if (orderId) {
      await supabaseAdmin
        .from('orders')
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq('id', orderId);
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      originalAmount: amount,
      finalAmount: finalAmount,
      discountAmount: discountAmount,
      orderId: orderId,
    });
  } catch (error: any) {
    console.error('PaymentIntent 생성 에러:', error.message);
    return NextResponse.json(
      { error: error.message || '결제 요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}