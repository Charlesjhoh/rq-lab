export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin, requireUser } from '@/lib/supabase-admin';
import { grantEntitlementForOrder } from '@/lib/payments';
import { getPayment } from '@/lib/portone';

export async function POST(req: Request) {
  try {
    // orderId는 checkout/success URL 쿼리스트링에 그대로 노출되는 값이라, 로그인한
    // 본인 소유의 주문인지 확인하지 않으면 그 링크를 아는 아무나 엔타이틀먼트(리포트
    // 잠금 해제/크레딧 지급)를 가로채 받아갈 수 있었다.
    const auth = await requireUser(req.headers.get('Authorization'));
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { paymentId, orderId: bodyOrderId, isFreePass } = await req.json();

    if (!paymentId && !bodyOrderId && !isFreePass) {
      return NextResponse.json({ error: '유효한 결제 정보가 없습니다.' }, { status: 400 });
    }

    let orderId = bodyOrderId || null;

    if (!orderId && paymentId) {
      const { data: order, error } = await supabaseAdmin
        .from('orders')
        .select('id')
        .eq('portone_payment_id', paymentId)
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

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('user_id, final_amount')
      .eq('id', orderId)
      .maybeSingle();

    if (!order || order.user_id !== auth.user.id) {
      return NextResponse.json({ error: '본인 소유의 주문만 확인할 수 있습니다.' }, { status: 403 });
    }

    // freePass(0원 쿠폰)가 아니면 클라이언트가 보낸 성공 응답을 그대로 믿지 않고, 포트원에
    // 실제 결제 상태를 조회해서 금액까지 일치하는지 서버가 직접 검증한다.
    if (!isFreePass && paymentId) {
      const payment = await getPayment(paymentId);

      if (payment.status !== 'PAID') {
        return NextResponse.json({ error: '결제가 완료되지 않았습니다.' }, { status: 400 });
      }
      if (payment.amount.total !== order.final_amount) {
        console.error('❌ 결제 금액 불일치:', paymentId, payment.amount.total, order.final_amount);
        return NextResponse.json({ error: '결제 금액이 일치하지 않습니다.' }, { status: 400 });
      }

      await supabaseAdmin.from('orders').update({ portone_payment_id: paymentId }).eq('id', orderId);
    }

    const result = await grantEntitlementForOrder(orderId);

    if (!result.granted && 'reason' in result && result.reason === 'coupon_limit_exceeded') {
      return NextResponse.json(
        { error: '쿠폰 사용 한도가 초과되어 처리할 수 없습니다.' },
        { status: 409 }
      );
    }

    return NextResponse.json({ success: true, ...result });
  } catch (err: any) {
    console.error('Confirm API 처리 에러:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
