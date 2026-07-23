import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// RLS를 바이패스하여 안전하게 DB를 조회할 수 있는 서버 전용 Supabase 클라이언트 생성
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { code, originalAmount } = await request.json();

    // 1. 필수 파라미터 검증
    if (!code || originalAmount === undefined) {
      return NextResponse.json(
        { message: '쿠폰 코드와 원천 금액(originalAmount)이 필요합니다.' },
        { status: 400 }
      );
    }

    // 2. Supabase DB에서 쿠폰 조회 (대소문자 구분 없이 입력 대응을 위해 upper 처리 고려)
    const { data: coupon, error } = await supabaseAdmin
      .from('coupons')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .single();

    if (error || !coupon) {
      return NextResponse.json(
        { isValid: false, message: '유효하지 않거나 존재하지 않는 쿠폰 코드입니다.' },
        { status: 404 }
      );
    }

    // 3. 쿠폰 활성화 상태(is_active) 확인
    if (!coupon.is_active) {
      return NextResponse.json(
        { isValid: false, message: '현재 사용할 수 없는 쿠폰입니다.' },
        { status: 400 }
      );
    }

    // 4. 쿠폰 유효기간(valid_until) 확인
    if (coupon.valid_until && new Date(coupon.valid_until) < new Date()) {
      return NextResponse.json(
        { isValid: false, message: '유효기간이 만료된 쿠폰입니다.' },
        { status: 400 }
      );
    }

    // 5. 할인 금액(discountAmount) 및 최종 금액(finalAmount) 계산
    let discountAmount = 0;

    if (coupon.discount_type === 'PERCENT') {
      // 정률 할인 (예: 10% 할인 -> originalAmount * 0.1)
      discountAmount = (originalAmount * Number(coupon.discount_value)) / 100;
    } else if (coupon.discount_type === 'FIXED') {
      // 정액 할인 (예: $5 / 5,000원 할인)
      discountAmount = Number(coupon.discount_value);
    }

    // 할인 금액이 원금을 초과하지 않도록 보정 (최대 원금까지만 할인)
    if (discountAmount > originalAmount) {
      discountAmount = originalAmount;
    }

    const finalAmount = Math.max(0, originalAmount - discountAmount);

    // 6. 검증 성공 응답 반환
    return NextResponse.json({
      isValid: true,
      message: '쿠폰이 성공적으로 적용되었습니다.',
      coupon: {
        id: coupon.id,
        code: coupon.code,
        issuer: coupon.issuer, // 'GGUG' 또는 'INTERNAL' -> 정산용 주체
        discountType: coupon.discount_type,
        discountValue: coupon.discount_value,
      },
      calculation: {
        originalAmount,
        discountAmount,
        finalAmount,
      },
    });

  } catch (err: any) {
    console.error('Coupon validation error:', err);
    return NextResponse.json(
      { message: '서버 내부 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}