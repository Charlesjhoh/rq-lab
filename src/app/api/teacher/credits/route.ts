export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId가 필요합니다.' }, { status: 400 });
    }

    const auth = await requireRole(req.headers.get('Authorization'), ['teacher', 'manager']);
    if ('error' in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    if (auth.role === 'teacher') {
      const { data: classes } = await supabaseAdmin
        .from('classes')
        .select('id')
        .eq('teacher_id', auth.user.id);

      const classIds = (classes || []).map((c) => c.id);
      const { data: student } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('id', userId)
        .in('class_id', classIds.length > 0 ? classIds : ['00000000-0000-0000-0000-000000000000'])
        .maybeSingle();

      if (!student) {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const { data: packages, error } = await supabaseAdmin
      .from('credit_packages')
      .select('remaining_credits, expires_at')
      .eq('user_id', userId)
      .gt('remaining_credits', 0)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const remaining = (packages || []).reduce((sum, p) => sum + p.remaining_credits, 0);
    const nearestExpiry = packages && packages.length > 0 ? packages[0].expires_at : null;

    return NextResponse.json({ remaining, nearestExpiry });
  } catch (err: any) {
    console.error('teacher credits 조회 에러:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
