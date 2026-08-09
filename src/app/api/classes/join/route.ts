export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['student']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json().catch(() => ({}));
  const joinCode = String(body.joinCode || '').trim().toUpperCase();
  if (!joinCode) {
    return NextResponse.json({ error: '참여코드가 필요합니다.' }, { status: 400 });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('class_id')
    .eq('id', auth.user.id)
    .maybeSingle();

  if (profile?.class_id) {
    return NextResponse.json({ error: '이미 선생님(클래스)에 소속되어 있습니다.' }, { status: 400 });
  }

  const { data: targetClass, error: classError } = await supabaseAdmin
    .from('classes')
    .select('id, teacher_id, name')
    .eq('join_code', joinCode)
    .maybeSingle();

  if (classError || !targetClass) {
    return NextResponse.json({ error: '유효하지 않은 참여코드입니다.' }, { status: 404 });
  }

  const { data: subscription } = await supabaseAdmin
    .from('teacher_subscriptions')
    .select('seat_count, status')
    .eq('teacher_id', targetClass.teacher_id)
    .maybeSingle();

  if (!subscription || !['active', 'trialing'].includes(subscription.status)) {
    return NextResponse.json({ error: '선생님의 좌석이 활성화되어 있지 않습니다.' }, { status: 403 });
  }

  const { data: teacherClasses } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('teacher_id', targetClass.teacher_id);

  const classIds = (teacherClasses || []).map((c) => c.id);

  const { count } = await supabaseAdmin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .in('class_id', classIds);

  if ((count || 0) >= subscription.seat_count) {
    return NextResponse.json({ error: '선생님의 좌석이 모두 사용 중입니다.' }, { status: 403 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('profiles')
    .update({ class_id: targetClass.id })
    .eq('id', auth.user.id);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ joined: true, className: targetClass.name });
}
