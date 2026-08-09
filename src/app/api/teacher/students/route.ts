export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

const STUDENT_COLUMNS = 'id, student_id, student_name, parent_name, birth, email, role, class_id';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher', 'manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  if (auth.role === 'manager') {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select(STUDENT_COLUMNS)
      .eq('role', 'student');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ students: data || [] });
  }

  // teacher: 본인 클래스에 소속된 학생만
  const { data: classes, error: classesError } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('teacher_id', auth.user.id);

  if (classesError) {
    return NextResponse.json({ error: classesError.message }, { status: 500 });
  }

  const classIds = (classes || []).map((c) => c.id);
  if (classIds.length === 0) {
    return NextResponse.json({ students: [] });
  }

  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select(STUDENT_COLUMNS)
    .eq('role', 'student')
    .in('class_id', classIds);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ students: data || [] });
}
