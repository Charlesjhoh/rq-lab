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
