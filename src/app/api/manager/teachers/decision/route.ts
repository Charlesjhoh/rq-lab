export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId, decision } = await req.json();

  if (!userId || !['approved', 'rejected'].includes(decision)) {
    return NextResponse.json({ error: '유효한 값을 입력해 주세요.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .update({ teacher_status: decision })
    .eq('id', userId)
    .eq('role', 'teacher')
    .select('id, display_name, email, teacher_status')
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: '대상 선생님 계정을 찾을 수 없습니다.' }, { status: 404 });
  }

  console.log(`👩‍🏫 선생님 승인 처리 — managerId=${auth.user.id} targetUser=${userId} decision=${decision}`);

  return NextResponse.json({ success: true, teacher: data });
}
