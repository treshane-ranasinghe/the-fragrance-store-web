import Link from 'next/link';
import { ActivityFeed, type FeedRow } from '@/components/admin/ActivityFeed';
import { Card, Empty, PageHeader, StatCard } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin';
import { formatDate, formatDateTime, formatRs } from '@/lib/format';

export const metadata = { title: 'Dashboard' };

export default async function Dashboard() {
  const { supabase } = await requireAdmin();
  const now = new Date();
  const today = new Date(now.getTime() + 5.5 * 3600_000).toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const in7 = new Date(now.getTime() + 7 * 86400_000).toISOString();

  const [sales, notified, onHold, codPending, codToPack, codCash, overdue, lowStock, warnings, topAdded, feed, promos, schedBanners, schedSections, schedPromos, bundles, codAttention, codRemitOverdue] = await Promise.all([
    supabase.from('admin_sales_summary').select('*').gte('day', monthStart),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'on_hold').eq('payment_status', 'payment_notified'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'on_hold'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'processing'),
    supabase.from('orders').select('total').eq('payment_method', 'cod').eq('status', 'delivered').eq('payment_status', 'unpaid'),
    supabase.from('orders').select('id', { count: 'exact', head: true }).eq('is_overdue', true).eq('status', 'on_hold'),
    supabase.from('product_variants').select('id, size_ml, stock_qty, sku, products!inner(id, name, is_active, deleted_at)').eq('is_active', true).lte('stock_qty', 3).is('products.deleted_at', null).order('stock_qty').limit(10),
    supabase.from('admin_stock_warnings').select('*').limit(10),
    supabase.from('admin_product_cart_stats').select('*').order('adds', { ascending: false }).limit(5),
    supabase.from('admin_cart_feed').select('*').order('id', { ascending: false }).limit(10),
    supabase.from('live_promotions').select('id, name, ends_at').order('ends_at'),
    supabase.from('hero_banners').select('id, internal_name, starts_at').eq('is_active', true).gt('starts_at', now.toISOString()).lt('starts_at', in7),
    supabase.from('home_sections').select('id, title, type, starts_at').eq('is_active', true).gt('starts_at', now.toISOString()).lt('starts_at', in7),
    supabase.from('promotions').select('id, name, starts_at').eq('is_active', true).gt('starts_at', now.toISOString()).lt('starts_at', in7),
    supabase.from('store_bundles').select('id, name, available').lte('available', 0),
    supabase.from('admin_orders').select('id', { count: 'exact', head: true }).eq('cod_needs_attention', true),
    supabase.from('admin_orders').select('id', { count: 'exact', head: true }).eq('cod_remit_overdue', true),
  ]);
  const { data: topOrdered } = await supabase.from('admin_product_cart_stats').select('*').order('orders', { ascending: false }).limit(5);

  const days = sales.data ?? [];
  const todayRow = days.find((d) => d.day === today);
  const monthOrders = days.reduce((s, d) => s + d.active_orders, 0);
  const monthRevenue = days.reduce((s, d) => s + Number(d.revenue), 0);
  const cashWithCouriers = (codCash.data ?? []).reduce((s, o) => s + Number(o.total), 0);
  const scheduled = [
    ...(schedBanners.data ?? []).map((b) => ({ kind: 'Hero banner', name: b.internal_name, at: b.starts_at, href: '/admin/content/hero' })),
    ...(schedSections.data ?? []).map((s) => ({ kind: 'Homepage section', name: s.title || s.type, at: s.starts_at, href: '/admin/content/homepage' })),
    ...(schedPromos.data ?? []).map((p) => ({ kind: 'Promotion', name: p.name, at: p.starts_at, href: `/admin/promotions/${p.id}` })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" subtitle={formatDate(now)} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Orders today" value={todayRow?.active_orders ?? 0} />
        <StatCard label="Revenue today" value={formatRs(todayRow?.revenue ?? 0)} />
        <StatCard label="Orders this month" value={monthOrders} />
        <StatCard label="Revenue this month" value={formatRs(monthRevenue)} />
      </div>

      <Card title="Waiting for action">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
          <StatCard label="Payments to verify" value={notified.count ?? 0} href="/admin/payments/bank" tone={(notified.count ?? 0) > 0 ? 'warning' : undefined} />
          <StatCard label="On hold (bank)" value={onHold.count ?? 0} href="/admin/payments/bank" />
          <StatCard label="Overdue transfers" value={overdue.count ?? 0} href="/admin/payments/bank?filter=overdue" tone={(overdue.count ?? 0) > 0 ? 'error' : undefined} />
          <StatCard label="COD to confirm" value={codPending.count ?? 0} href="/admin/payments/cod" tone={(codAttention.count ?? 0) > 0 ? 'warning' : undefined} />
          <StatCard label="Orders to pack" value={codToPack.count ?? 0} href="/admin/orders?status=processing" />
          <StatCard label="COD cash with couriers" value={formatRs(cashWithCouriers)} href="/admin/payments/cod#cash" tone={(codRemitOverdue.count ?? 0) > 0 ? 'error' : undefined} />
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Stock warnings" actions={<span className="text-xs text-brand-muted">Unconfirmed orders that can&apos;t be confirmed</span>}>
          {warnings.data?.length ? (
            <ul className="space-y-2 text-sm">{warnings.data.map((w) => <li key={w.order_id}><Link href={`/admin/orders/${w.order_id}`} className="font-medium">{w.order_number}</Link> — <span className="text-state-error">{w.shortages}</span></li>)}</ul>
          ) : <Empty>No stock problems.</Empty>}
        </Card>
        <Card title="Low stock">
          {lowStock.data?.length ? (
            <ul className="space-y-1 text-sm">{lowStock.data.map((v) => {
              const p = v.products as unknown as { id: string; name: string };
              return <li key={v.id} className="flex justify-between"><Link href={`/admin/products/${p.id}`}>{p.name} {v.size_ml} ml</Link><span className={v.stock_qty === 0 ? 'text-state-error' : 'text-state-warning'}>{v.stock_qty} left</span></li>;
            })}</ul>
          ) : <Empty>All products are well stocked.</Empty>}
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card title="Top added to cart vs. ordered">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><p className="mb-2 font-medium text-brand-muted">Added to cart</p><ol className="list-decimal space-y-1 pl-5">{(topAdded.data ?? []).map((r) => <li key={r.item_id}>{r.item_name} <span className="text-brand-muted">({r.adds})</span></li>)}</ol></div>
            <div><p className="mb-2 font-medium text-brand-muted">Ordered</p><ol className="list-decimal space-y-1 pl-5">{(topOrdered ?? []).map((r) => <li key={r.item_id}>{r.item_name} <span className="text-brand-muted">({r.orders})</span></li>)}</ol></div>
          </div>
        </Card>
        <Card title="Promotions & content">
          <div className="space-y-4 text-sm">
            <div><p className="mb-1 font-medium text-brand-muted">Live promotions</p>
              {promos.data?.length ? <ul>{promos.data.map((p) => <li key={p.id}><Link href={`/admin/promotions/${p.id}`}>{p.name}</Link> — ends {formatDateTime(p.ends_at)}</li>)}</ul> : <p className="text-brand-muted">None</p>}</div>
            <div><p className="mb-1 font-medium text-brand-muted">Starting in the next 7 days</p>
              {scheduled.length ? <ul>{scheduled.map((s, i) => <li key={i}><Link href={s.href}>{s.kind}: {s.name}</Link> — {formatDateTime(s.at)}</li>)}</ul> : <p className="text-brand-muted">Nothing scheduled</p>}</div>
            <div><p className="mb-1 font-medium text-brand-muted">Bundles out of stock</p>
              {bundles.data?.length ? <ul>{bundles.data.map((b) => <li key={b.id}><Link href={`/admin/bundles/${b.id}`} className="text-state-error">{b.name}</Link></li>)}</ul> : <p className="text-brand-muted">None</p>}</div>
          </div>
        </Card>
      </div>

      <Card title="Live cart activity" actions={<Link href="/admin/cart-activity" className="text-sm">Open monitor →</Link>}>
        <ActivityFeed initial={(feed.data ?? []) as FeedRow[]} limit={10} />
      </Card>
    </div>
  );
}
