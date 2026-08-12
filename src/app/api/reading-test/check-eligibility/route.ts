export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/supabase-admin';
import { checkTestEligibility } from '@/lib/test-eligibility';

// 클라이언트가 녹음을 시작하기 전에 미리 확인하는 용도 (진짜 관문은 /api/pronun 쪽 서버 체크).
export async function GET(req: NextRequest) {
  const auth = await requireUser(req.headers.get('Authorization'));
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await checkTestEligibility(auth.user.id);
  return NextResponse.json(result);
}
