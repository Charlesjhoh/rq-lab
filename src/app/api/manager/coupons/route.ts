export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 혼동되는 0/O, 1/I 제외

function generateCode(length = 8) {
  let code = '';
  for (let i = 0; i < length; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data, error } = await supabaseAdmin
    .from('coupons')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ coupons: data || [] });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const discountType = body.discountType === 'amount' ? 'amount' : 'percent';
  const discountValue = Number(body.discountValue);
  const expiresAt = body.expiresAt || null;
  const isActive = body.isActive !== false;
  const customCode = (body.code || '').trim().toUpperCase();
  const rawMaxUses = body.maxUses;
  const maxUses =
    rawMaxUses === '' || rawMaxUses === null || rawMaxUses === undefined ? null : Number(rawMaxUses);

  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    return NextResponse.json({ error: '유효한 할인 값을 입력해 주세요.' }, { status: 400 });
  }

  if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
    return NextResponse.json({ error: '사용 횟수 제한은 1 이상의 정수이거나 비워둬야 합니다.' }, { status: 400 });
  }

  // 코드가 지정되지 않았으면 서버에서 랜덤 생성 (충돌 시 최대 5회 재시도)
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = customCode || generateCode();

    const { data, error } = await supabaseAdmin
      .from('coupons')
      .insert({
        code,
        discount_type: discountType,
        discount_value: discountValue,
        expires_at: expiresAt,
        is_active: isActive,
        max_uses: maxUses,
      })
      .select()
      .single();

    if (!error) {
      return NextResponse.json({ coupon: data });
    }

    // 중복 코드가 아닌 다른 에러거나, 커스텀 코드를 직접 지정한 경우는 재시도하지 않고 바로 반환
    if (customCode || error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: '쿠폰 코드 생성에 반복 실패했습니다. 다시 시도해 주세요.' }, { status: 500 });
}
