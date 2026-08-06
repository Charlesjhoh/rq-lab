export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const q = req.nextUrl.searchParams.get('q')?.trim() || '';

  let userIds: string[] | null = null;

  if (q) {
    const { data: matchedProfiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .or(`email.ilike.%${q}%,student_name.ilike.%${q}%`);

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    userIds = (matchedProfiles || []).map((p) => p.id);
    if (userIds.length === 0) {
      return NextResponse.json({ orders: [] });
    }
  }

  let query = supabaseAdmin
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200);

  if (userIds) {
    query = query.in('user_id', userIds);
  }

  const { data: orders, error: ordersError } = await query;
  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const distinctUserIds = Array.from(new Set((orders || []).map((o) => o.user_id).filter(Boolean)));
  const profilesById: Record<string, { student_name: string; email: string }> = {};

  if (distinctUserIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, student_name, email')
      .in('id', distinctUserIds);

    for (const p of profiles || []) {
      profilesById[p.id] = { student_name: p.student_name, email: p.email };
    }
  }

  const enriched = (orders || []).map((o) => ({
    ...o,
    student_name: profilesById[o.user_id]?.student_name || null,
    email: profilesById[o.user_id]?.email || null,
  }));

  return NextResponse.json({ orders: enriched });
}
