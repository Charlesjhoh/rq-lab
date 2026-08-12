import { createClient } from '@supabase/supabase-js';

// Next.js의 App Router는 라우트 핸들러 안에서 호출되는 fetch()를 자동으로 패치해
// 응답을 캐싱한다(Data Cache). supabase-js도 내부적으로 fetch를 쓰기 때문에, 캐시를
// 명시적으로 꺼두지 않으면 예를 들어 하루 응시 횟수 체크 쿼리(같은 날엔 URL이 동일)가
// 그날의 첫 응답으로 그대로 캐시돼버려서 — 이후 몇 번을 더 응시하든 계속 같은 결과가
// 재사용되는 문제가 있었다(checkTestEligibility가 절대 최신 카운트를 못 봄).
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  {
    global: {
      fetch: (url, init) => fetch(url, { ...init, cache: 'no-store' }),
    },
  }
);

export async function requireUser(authHeader: string | null) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: '인증이 필요합니다.', status: 401 as const };
  }

  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return { error: '인증이 필요합니다.', status: 401 as const };
  }

  return { user };
}

export async function requireRole(authHeader: string | null, allowedRoles: string[]) {
  if (!authHeader?.startsWith('Bearer ')) {
    return { error: '인증이 필요합니다.', status: 401 as const };
  }

  const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''));
  if (!user) {
    return { error: '인증이 필요합니다.', status: 401 as const };
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (!profile || !allowedRoles.includes(profile.role)) {
    return { error: '접근 권한이 없습니다.', status: 403 as const };
  }

  return { user, role: profile.role as string };
}
