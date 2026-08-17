export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';
import { MANAGER_GRANT_MAX_CREDITS, MANAGER_GRANT_MAX_DAYS } from '@/lib/products';

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

  if (creditCount > MANAGER_GRANT_MAX_CREDITS || dayCount > MANAGER_GRANT_MAX_DAYS) {
    return NextResponse.json(
      {
        error: `1회 지급 상한(크레딧 ${MANAGER_GRANT_MAX_CREDITS}개, 기간 ${MANAGER_GRANT_MAX_DAYS}일)을 초과했습니다. 더 필요하면 여러 번 나눠 지급해 주세요.`,
      },
      { status: 400 }
    );
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

  // 별도 알림 시스템은 없지만, 로그 기반 모니터링/감사 추적을 위해 구조화된 로그를 남긴다.
  console.log(
    `📦 매니저 수동 크레딧 지급 — grantedBy=${auth.user.id} targetUser=${userId} credits=${creditCount} days=${dayCount} packageId=${data.id}`
  );

  return NextResponse.json({ success: true, package: data });
}
