export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() || '';
  if (!q) {
    return NextResponse.json({ users: [] });
  }

  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id, student_name, email')
    .or(`email.ilike.%${q}%,student_name.ilike.%${q}%`)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ids = (profiles || []).map((p) => p.id);
  const remainingByUser: Record<string, number> = {};

  if (ids.length > 0) {
    const { data: packages } = await supabaseAdmin
      .from('credit_packages')
      .select('user_id, remaining_credits')
      .in('user_id', ids)
      .gt('remaining_credits', 0)
      .gt('expires_at', new Date().toISOString());

    for (const p of packages || []) {
      remainingByUser[p.user_id] = (remainingByUser[p.user_id] || 0) + p.remaining_credits;
    }
  }

  const users = (profiles || []).map((p) => ({
    ...p,
    remainingCredits: remainingByUser[p.id] || 0,
  }));

  return NextResponse.json({ users });
}
