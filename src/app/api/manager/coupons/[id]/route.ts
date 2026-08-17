export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const body = await req.json();
  const updates: Record<string, any> = {};

  if (typeof body.isActive === 'boolean') updates.is_active = body.isActive;
  if ('expiresAt' in body) updates.expires_at = body.expiresAt || null;
  if (body.discountType) updates.discount_type = body.discountType === 'amount' ? 'amount' : 'percent';
  if (body.discountValue !== undefined) {
    const value = Number(body.discountValue);
    if (!Number.isFinite(value) || value <= 0) {
      return NextResponse.json({ error: '유효한 할인 값을 입력해 주세요.' }, { status: 400 });
    }
    updates.discount_value = value;
  }
  if ('maxUses' in body) {
    const raw = body.maxUses;
    const maxUses = raw === '' || raw === null || raw === undefined ? null : Number(raw);
    if (maxUses !== null && (!Number.isInteger(maxUses) || maxUses <= 0)) {
      return NextResponse.json(
        { error: '사용 횟수 제한은 1 이상의 정수이거나 비워둬야 합니다.' },
        { status: 400 }
      );
    }
    updates.max_uses = maxUses;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('coupons')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ coupon: data });
}
