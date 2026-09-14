export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const status = req.nextUrl.searchParams.get('status') || 'pending';

  const { data: teachers, error } = await supabaseAdmin
    .from('profiles')
    .select('id, display_name, email, teacher_status')
    .eq('role', 'teacher')
    .eq('teacher_status', status)
    .order('email', { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ teachers: teachers || [] });
}
