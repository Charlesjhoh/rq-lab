export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin, requireUser } from '@/lib/supabase-admin';
import { grantEntitlementForOrder } from '@/lib/payments';

export async function POST(req: Request) {
  try {
    // orderId는 checkout/success URL 쿼리스트링에 그대로 노출되는 값이라, 로그인한
    // 본인 소유의 주문인지 확인하지 않으면 그 링크를 아는 아무나 엔타이틀먼트(리포트
    // 잠금 해제/크레딧 지급)를 가로채 받아갈 수 있었다.
    const auth = await requireUser(req.headers.get('Authorization'));
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

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

    const { data: orderOwner } = await supabaseAdmin
      .from('orders')
      .select('user_id')
      .eq('id', orderId)
      .maybeSingle();

    if (!orderOwner || orderOwner.user_id !== auth.user.id) {
      return NextResponse.json({ error: '본인 소유의 주문만 확인할 수 있습니다.' }, { status: 403 });
    }

    const result = await grantEntitlementForOrder(orderId);

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Confirm API 처리 에러:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}