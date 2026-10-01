import Link from 'next/link';
import { ActivityFeed, type FeedRow } from '@/components/admin/ActivityFeed';
import { Empty, PageHeader } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin';
import { formatDateTime, formatRs, timeAgo } from '@/lib/format';

export const metadata = { title: 'Cart activity' };

const TABS = [['feed', 'Live feed'], ['active', 'Active carts'], ['abandoned', 'Abandoned carts'], ['insights', 'Product insights']] as const;

export default async function CartActivityPage({ searchParams }: { searchParams: Promise<{ tab?: string; type?: string; from?: string; to?: string; product?: string }> }) {
  const sp = await searchParams;
  const tab = (TABS.some(([t]) => t === sp.tab) ? sp.tab : 'feed') as (typeof TABS)[number][0];
  const type = sp.type === 'guest' || sp.type === 'registered' ? sp.type : undefined;
  const { supabase } = await requireAdmin();
  const { data: products } = await supabase.from('products').select('id, name').is('deleted_at', null).order('name');
  const qs = (t: string) => '?' + new URLSearchParams(Object.entries({ ...sp, tab: t }).filter(([, v]) => v) as [string, string][]).toString();
  const exportQs = new URLSearchParams(Object.entries({ ...sp, tab }).filter(([, v]) => v) as [string, string][]).toString();
  const from = sp.from ? `${sp.from}T00:00:00+05:30` : null;
  const to = sp.to ? new Date(new Date(`${sp.to}T00:00:00+05:30`).getTime() + 86400_000).toISOString() : null;

  let content: React.ReactNode = null;
  if (tab === 'feed') {
    let q = supabase.from('admin_cart_feed').select('*').order('id', { ascending: false }).limit(200);
    if (type) q = q.eq('is_anonymous', type === 'guest');
    if (from) q = q.gte('created_at', from);
    if (to) q = q.lt('created_at', to);
    if (sp.product) q = q.eq('product_id', sp.product);
    const { data } = await q;
    content = <div className="card p-4"><ActivityFeed initial={(data ?? []) as FeedRow[]} limit={200} filter={{ customerType: type, productId: sp.product }} /></div>;
  } else if (tab === 'active' || tab === 'abandoned') {
    let q = supabase.from(tab === 'active' ? 'admin_active_carts' : 'admin_abandoned_carts').select('*').order('last_activity', { ascending: false });
    if (type) q = q.eq('is_anonymous', type === 'guest');
    const { data } = await q;
    const { data: s } = await supabase.from('store_settings').select('abandoned_cart_hours').single();
    content = !data?.length ? <Empty>{tab === 'active' ? 'No active carts right now.' : 'No abandoned carts.'}</Empty> : (
      <div className="card overflow-x-auto">
        {tab === 'abandoned' ? <p className="p-4 text-sm text-brand-muted">Carts with items not ordered and no activity for more than {s?.abandoned_cart_hours ?? 24} hours. Contact details are shown for registered customers so you can follow up.</p> : null}
        <table className="table-admin">
          <thead><tr><th>Customer</th>{tab === 'abandoned' ? <th>Contact</th> : null}<th>Items</th><th className="text-right">Qty</th><th className="text-right">Value</th><th>Last activity</th></tr></thead>
          <tbody>{data.map((c) => (
            <tr key={c.user_id}>
              <td>{c.is_anonymous ? <span className="text-brand-muted">{c.customer_name}</span> : <Link href={`/admin/customers/${c.user_id}`}>{c.customer_name}</Link>}</td>
              {tab === 'abandoned' ? <td className="text-xs">{c.is_anonymous ? '—' : <>{c.email}<br />{c.phone ? <a href={`https://wa.me/94${String(c.phone).replace(/^\+?94|^0/, '')}`} target="_blank" rel="noopener noreferrer">{c.phone}</a> : null}</>}</td> : null}
              <td className="max-w-md text-xs">{c.items}</td>
              <td className="text-right">{c.item_count}</td>
              <td className="text-right">{formatRs(c.cart_value)}</td>
              <td className="whitespace-nowrap" title={formatDateTime(c.last_activity)}>{timeAgo(c.last_activity)}</td>
            </tr>))}</tbody>
        </table>
      </div>
    );
  } else {
    const { data } = await supabase.rpc('admin_cart_insights', { p_from: from, p_to: to, p_customer_type: type ?? null });
    const rows = (data ?? []) as { item_id: string; is_bundle: boolean; item_name: string; brand_name: string | null; adds: number; removes: number; orders: number; ordered_qty: number; conversion_rate: number }[];
    content = !rows.length ? <Empty>No data for this period.</Empty> : (
      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th>Item</th><th className="text-right">Added to cart</th><th className="text-right">Removed</th><th className="text-right">Ordered</th><th className="text-right">Units ordered</th><th className="text-right">Cart → order</th></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.item_id}>
              <td>{r.is_bundle ? <span className="mr-1 rounded-full bg-brand-green/10 px-1.5 text-xs text-brand-green">Bundle</span> : null}{r.brand_name ? `${r.brand_name} ` : ''}{r.item_name}</td>
              <td className="text-right">{r.adds}</td><td className="text-right">{r.removes}</td><td className="text-right">{r.orders}</td><td className="text-right">{r.ordered_qty}</td>
              <td className="text-right font-medium">{r.conversion_rate}%</td>
            </tr>))}</tbody>
        </table>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Cart activity monitor" subtitle="Who is adding what to their cart" actions={<a href={`/admin/export/cart-activity?${exportQs}`} className="btn-secondary btn-sm no-underline">Export CSV</a>} />
      <nav className="mb-4 flex flex-wrap gap-1" aria-label="Views">
        {TABS.map(([t, l]) => <Link key={t} href={qs(t)} aria-current={tab === t ? 'page' : undefined} className={`rounded-btn px-3 py-1.5 text-sm no-underline ${tab === t ? 'bg-brand-green text-brand-cream' : 'bg-white text-brand-green'}`}>{l}</Link>)}
      </nav>
      <form className="mb-4 flex flex-wrap gap-2">
        <input type="hidden" name="tab" value={tab} />
        <select name="type" defaultValue={type ?? ''} className="input input-sm w-auto"><option value="">Guests &amp; registered</option><option value="guest">Guests only</option><option value="registered">Registered only</option></select>
        {tab === 'feed' || tab === 'insights' ? <>
          <input type="date" name="from" defaultValue={sp.from} className="input input-sm w-auto" aria-label="From" />
          <input type="date" name="to" defaultValue={sp.to} className="input input-sm w-auto" aria-label="To" />
        </> : null}
        {tab === 'feed' ? <select name="product" defaultValue={sp.product ?? ''} className="input input-sm w-auto"><option value="">All products</option>{products?.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select> : null}
        <button className="btn-secondary btn-sm">Apply</button>
      </form>
      {content}
    </div>
  );
}
