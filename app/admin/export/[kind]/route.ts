import { NextResponse, type NextRequest } from 'next/server';
import { csvResponse, requireAdmin } from '@/lib/admin';

/** CSV exports: orders, customers, cart activity (feed / active / abandoned / insights) */
export async function GET(request: NextRequest, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  const { supabase } = await requireAdmin();
  const sp = request.nextUrl.searchParams;
  const stamp = new Date().toISOString().slice(0, 10);

  if (kind === 'orders') {
    let q = supabase.from('admin_orders').select('order_number, created_at, status, payment_method, payment_status, customer_name, customer_email, shipping_phone, shipping_city, shipping_district, subtotal, delivery_fee, cod_fee, total, amount_received, balance_due, courier_name, tracking_number').order('created_at', { ascending: false }).limit(10000);
    if (sp.get('status')) q = q.eq('status', sp.get('status')!);
    if (sp.get('method')) q = q.eq('payment_method', sp.get('method')!);
    if (sp.get('payment')) q = q.eq('payment_status', sp.get('payment')!);
    if (sp.get('from')) q = q.gte('created_at', `${sp.get('from')}T00:00:00+05:30`);
    if (sp.get('to')) q = q.lte('created_at', `${sp.get('to')}T23:59:59+05:30`);
    const { data } = await q;
    return csvResponse(`orders-${stamp}.csv`, data ?? []);
  }
  if (kind === 'customers') {
    const { data } = await supabase.from('admin_customer_stats').select('full_name, email, phone, created_at, total_orders, completed_orders, cancelled_orders, returned_orders, total_spent, avg_order_value, first_order_at, last_order_at, failed_cod_count, marketing_opt_in').is('deleted_at', null).order('created_at', { ascending: false }).limit(10000);
    return csvResponse(`customers-${stamp}.csv`, data ?? []);
  }
  if (kind === 'cart-activity') {
    const tab = sp.get('tab') ?? 'feed';
    const type = sp.get('type');
    if (tab === 'insights') {
      const from = sp.get('from') ? `${sp.get('from')}T00:00:00+05:30` : null;
      const to = sp.get('to') ? new Date(new Date(`${sp.get('to')}T00:00:00+05:30`).getTime() + 86400_000).toISOString() : null;
      const { data } = await supabase.rpc('admin_cart_insights', { p_from: from, p_to: to, p_customer_type: type === 'guest' || type === 'registered' ? type : null });
      return csvResponse(`cart-insights-${stamp}.csv`, (data ?? []) as Record<string, unknown>[]);
    }
    const view = tab === 'active' ? 'admin_active_carts' : tab === 'abandoned' ? 'admin_abandoned_carts' : 'admin_cart_feed';
    let q = supabase.from(view).select('*').limit(20000);
    if (type === 'guest' && tab !== 'insights') q = q.eq('is_anonymous', true);
    if (type === 'registered' && tab !== 'insights') q = q.eq('is_anonymous', false);
    if (tab === 'feed') {
      if (sp.get('from')) q = q.gte('created_at', `${sp.get('from')}T00:00:00+05:30`);
      if (sp.get('to')) q = q.lte('created_at', `${sp.get('to')}T23:59:59+05:30`);
      if (sp.get('product')) q = q.eq('product_id', sp.get('product')!);
      q = q.order('id', { ascending: false });
    }
    const { data } = await q;
    return csvResponse(`cart-${tab}-${stamp}.csv`, (data ?? []) as Record<string, unknown>[]);
  }
  return NextResponse.json({ error: 'Unknown export' }, { status: 404 });
}
