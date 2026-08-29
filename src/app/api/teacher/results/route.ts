export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

async function getTeacherStudentIds(teacherId: string): Promise<string[]> {
  const { data: classes } = await supabaseAdmin
    .from('classes')
    .select('id')
    .eq('teacher_id', teacherId);

  const classIds = (classes || []).map((c) => c.id);
  if (classIds.length === 0) return [];

  const { data: students } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .in('class_id', classIds);

  return (students || []).map((s) => s.id);
}

export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['teacher', 'manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = req.nextUrl.searchParams.get('userId');

  if (userId) {
    if (auth.role === 'teacher') {
      const studentIds = await getTeacherStudentIds(auth.user.id);
      if (!studentIds.includes(userId)) {
        return NextResponse.json({ error: '접근 권한이 없습니다.' }, { status: 403 });
      }
    }

    const { data, error } = await supabaseAdmin
      .from('reading_results')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: data || [] });
  }

  if (auth.role === 'manager') {
    const { data, error } = await supabaseAdmin
      .from('reading_results')
      .select('id, user_id, wpm, accuracy, pronunciation_accuracy, comprehension, final_ar, reading_level, created_at, is_unlocked, unlock_source')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ results: data || [] });
  }

  // teacher: 본인 클래스 학생들의 결과만
  const studentIds = await getTeacherStudentIds(auth.user.id);
  if (studentIds.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const { data, error } = await supabaseAdmin
    .from('reading_results')
    .select('id, user_id, wpm, accuracy, pronunciation_accuracy, comprehension, final_ar, reading_level, created_at, is_unlocked, unlock_source')
    .in('user_id', studentIds)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ results: data || [] });
}
