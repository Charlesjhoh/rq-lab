export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export async function POST(req: Request) {
  try {
    const { resultId } = await req.json();
    if (!resultId) {
      return NextResponse.json({ error: 'resultId가 필요합니다.' }, { status: 400 });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
    }

    const { data: result, error: resultError } = await supabaseAdmin
      .from('reading_results')
      .select('id, user_id, is_unlocked')
      .eq('id', resultId)
      .maybeSingle();

    if (resultError || !result || result.user_id !== user.id) {
      return NextResponse.json({ error: '결과를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (result.is_unlocked) {
      return NextResponse.json({ consumed: false, alreadyUnlocked: true });
    }

    const { data: pkg } = await supabaseAdmin
      .from('credit_packages')
      .select('id, remaining_credits')
      .eq('user_id', user.id)
      .gt('remaining_credits', 0)
      .gt('expires_at', new Date().toISOString())
      .order('expires_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!pkg) {
      return NextResponse.json({ consumed: false });
    }

    // remaining_credits를 방금 읽은 값 기준으로 -1 해서 쓰되, WHERE에도 그 값을 그대로
    // 조건으로 건다(비교-후-교체) — 동시에 두 번 호출되면(네트워크 재시도, 탭 중복 등)
    // 뒤에 도착한 쪽은 이미 바뀐 값과 안 맞아 0행을 갱신하고 실패로 떨어진다. 이전에는
    // `gt 0`만 확인해서, 두 요청 다 통과해버려 크레딧은 1개만 줄고 리포트는 2개 풀리는
    // 경우가 있었다.
    const { data: decremented, error: decrementError } = await supabaseAdmin
      .from('credit_packages')
      .update({ remaining_credits: pkg.remaining_credits - 1 })
      .eq('id', pkg.id)
      .eq('remaining_credits', pkg.remaining_credits)
      .select()
      .maybeSingle();

    if (decrementError || !decremented) {
      return NextResponse.json({ consumed: false });
    }

    const { data: unlocked, error: unlockError } = await supabaseAdmin
      .from('reading_results')
      .update({
        is_unlocked: true,
        unlock_source: 'package_credit',
        unlocked_at: new Date().toISOString(),
      })
      .eq('id', resultId)
      .eq('is_unlocked', false)
      .select()
      .maybeSingle();

    if (unlockError || !unlocked) {
      // 그 사이 다른 경로로 이미 잠금 해제됨 — 방금 차감한 크레딧 환불
      await supabaseAdmin
        .from('credit_packages')
        .update({ remaining_credits: decremented.remaining_credits + 1 })
        .eq('id', pkg.id);

      return NextResponse.json({ consumed: false, alreadyUnlocked: true });
    }

    return NextResponse.json({ consumed: true, remaining: decremented.remaining_credits });
  } catch (err: any) {
    console.error('크레딧 소진 에러:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
