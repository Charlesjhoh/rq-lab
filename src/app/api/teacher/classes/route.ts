export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // 0/O, 1/I 제외

function generateJoinCode() {
  return Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const [{ data: classes, error }, { data: subscription }] = await Promise.all([
    supabaseAdmin
      .from('classes')
      .select('id, name, join_code, created_at')
      .eq('teacher_id', auth.user.id)
      .order('created_at', { ascending: true }),
    supabaseAdmin
      .from('teacher_subscriptions')
      .select('seat_count, status, current_period_end, cancel_at_period_end, portone_billing_key')
      .eq('teacher_id', auth.user.id)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // portone_billing_key 자체는 클라이언트로 내려보내지 않고 존재 여부만 전달한다.
  // (Stripe → PortOne 전환 이전 구독은 status는 'active'지만 이 컬럼이 비어 있어, 상태값만으로
  // 판단하면 좌석 변경/해지 모두 실패하는 막다른 상태가 된다.)
  const subscriptionOut = subscription
    ? {
        seat_count: subscription.seat_count,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
        cancel_at_period_end: subscription.cancel_at_period_end,
        hasBillingKey: !!subscription.portone_billing_key,
      }
    : null;

  return NextResponse.json({ classes: classes || [], subscription: subscriptionOut });
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim();
  if (!name) {
    return NextResponse.json({ error: '클래스 이름이 필요합니다.' }, { status: 400 });
  }

  for (let attempt = 0; attempt < 5; attempt++) {
    const joinCode = generateJoinCode();
    const { data, error } = await supabaseAdmin
      .from('classes')
      .insert({ teacher_id: auth.user.id, name, join_code: joinCode })
      .select()
      .maybeSingle();

    if (!error && data) {
      return NextResponse.json({ class: data });
    }

    // unique 충돌(중복 join_code)이면 재시도, 그 외 에러는 즉시 반환
    if (error && error.code !== '23505') {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: '참여코드 생성에 실패했습니다. 다시 시도해 주세요.' }, { status: 500 });
}
