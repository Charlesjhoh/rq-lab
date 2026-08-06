export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin, requireRole } from '@/lib/supabase-admin';

export async function GET(req: NextRequest) {
  const auth = await requireRole(req.headers.get('Authorization'), ['manager']);
  if ('error' in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { data: paidOrders, error: ordersError } = await supabaseAdmin
    .from('orders')
    .select('product_type, final_amount, created_at')
    .in('status', ['paid', 'completed']);

  if (ordersError) {
    return NextResponse.json({ error: ordersError.message }, { status: 500 });
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  let totalRevenue = 0;
  let monthRevenue = 0;
  let singleCount = 0;
  let packageCount = 0;

  for (const o of paidOrders || []) {
    const amount = Number(o.final_amount) || 0;
    totalRevenue += amount;
    if (new Date(o.created_at) >= monthStart) monthRevenue += amount;
    if (o.product_type === 'package_2x_month') packageCount += 1;
    else singleCount += 1;
  }

  const { data: activePackages, error: packagesError } = await supabaseAdmin
    .from('credit_packages')
    .select('user_id')
    .gt('remaining_credits', 0)
    .gt('expires_at', now.toISOString());

  if (packagesError) {
    return NextResponse.json({ error: packagesError.message }, { status: 500 });
  }

  const activePackageHolders = new Set((activePackages || []).map((p) => p.user_id)).size;

  return NextResponse.json({
    totalRevenue,
    monthRevenue,
    singleCount,
    packageCount,
    activePackageHolders,
  });
}
