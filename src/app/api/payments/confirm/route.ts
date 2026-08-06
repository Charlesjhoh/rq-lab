export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { grantEntitlementForOrder } from '@/lib/payments';

export async function POST(req: Request) {
  try {
    const { paymentIntentId, orderId: bodyOrderId, isFreePass } = await req.json();

    if (!paymentIntentId && !bodyOrderId && !isFreePass) {
      return NextResponse.json({ error: '유효한 결제 정보가 없습니다.' }, { status: 400 });
    }

    let orderId = bodyOrderId || null;

    if (!orderId && paymentIntentId) {
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntentId)
        .maybeSingle();

      if (error) {
        console.error('❌ 주문 조회 실패:', error.message);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      orderId = order?.id || null;
    }

    if (!orderId) {
      return NextResponse.json({ error: '주문을 찾을 수 없습니다.' }, { status: 404 });
    }

    const result = await grantEntitlementForOrder(orderId);

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Confirm API 처리 에러:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}