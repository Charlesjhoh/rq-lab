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
      .select('seat_count, status, current_period_end, cancel_at_period_end')
      .eq('teacher_id', auth.user.id)
      .maybeSingle(),
  ]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ classes: classes || [], subscription: subscription || null });
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
