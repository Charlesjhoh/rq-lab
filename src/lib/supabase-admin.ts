import { createClient } from '@supabase/supabase-js';

export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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
