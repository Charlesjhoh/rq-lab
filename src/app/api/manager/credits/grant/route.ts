export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

export async function POST(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { userId, credits, days, note } = await req.json();

  const creditCount = Number(credits);
  const dayCount = Number(days);

  if (!userId || !Number.isFinite(creditCount) || creditCount <= 0 || !Number.isFinite(dayCount) || dayCount <= 0) {
    return NextResponse.json({ error: '유효한 값을 입력해 주세요.' }, { status: 400 });
  }

  const grantedAt = new Date();
  const expiresAt = new Date(grantedAt.getTime() + dayCount * 24 * 60 * 60 * 1000);

  const { data, error } = await supabaseAdmin
    .from('credit_packages')
    .insert({
      user_id: userId,
      total_credits: creditCount,
      remaining_credits: creditCount,
      granted_at: grantedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      source: 'manual_grant',
      granted_by: auth.user.id,
      note: note || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, package: data });
}
