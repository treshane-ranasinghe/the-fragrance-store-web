import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/ActionForm';
import { ActivityFeed, type FeedRow } from '@/components/admin/ActivityFeed';
import { Card, Empty, PageHeader, StatCard } from '@/components/admin/ui';
import { OrderStatusPill, PaymentStatusPill } from '@/components/ui/StatusPill';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { requireAdmin } from '@/lib/admin';
import { saveCustomerNoteAction } from '@/lib/actions/admin/customers';
import { formatDate, formatRs } from '@/lib/format';
import { PAYMENT_METHOD } from '@/lib/status';

export const metadata = { title: 'Customer' };

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: stats }, { data: profile }, { data: addresses }, { data: orders }, { data: note }, { data: cart }, { data: events }] = await Promise.all([
    supabase.from('admin_customer_stats').select('*').eq('id', id).maybeSingle(),
    supabase.from('profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('addresses').select('*').eq('user_id', id),
    supabase.from('orders').select('id, order_number, created_at, status, payment_status, payment_method, total').eq('user_id', id).order('created_at', { ascending: false }),
    supabase.from('customer_admin_notes').select('note, updated_at').eq('user_id', id).maybeSingle(),
    supabase.from('admin_cart_lines').select('*').eq('user_id', id),
    supabase.from('admin_cart_feed').select('*').eq('user_id', id).order('id', { ascending: false }).limit(50),
  ]);
  if (!profile) notFound();
  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: bought } = orderIds.length
    ? await supabase.from('order_items').select('product_name, size_ml, quantity, orders!inner(created_at, status)').in('order_id', orderIds).not('variant_id', 'is', null).neq('orders.status', 'cancelled')
    : { data: [] };
  const products = Object.values((bought ?? []).reduce<Record<string, { name: string; qty: number; last: string }>>((acc, i) => {
    const k = `${i.product_name} ${i.size_ml} ml`;
    const at = (i.orders as unknown as { created_at: string }).created_at;
    acc[k] = { name: k, qty: (acc[k]?.qty ?? 0) + i.quantity, last: !acc[k] || at > acc[k].last ? at : acc[k].last };
    return acc;
  }, {})).sort((a, b) => b.last.localeCompare(a.last));

  return (
    <div className="space-y-6">
      <PageHeader title={profile.full_name || 'Customer'} back={{ href: '/admin/customers', label: 'Customers' }}
        subtitle={<>{profile.email} · {profile.phone} · Member since {formatDate(profile.created_at)}{profile.deleted_at ? ' · Account deleted' : ''}{profile.role === 'admin' ? ' · Admin' : ''}</>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total orders" value={stats?.total_orders ?? 0} />
        <StatCard label="Total spent" value={formatRs(stats?.total_spent ?? 0)} />
        <StatCard label="Avg order" value={formatRs(stats?.avg_order_value ?? 0)} />
        <StatCard label="Completed / cancelled / returned" value={`${stats?.completed_orders ?? 0} / ${stats?.cancelled_orders ?? 0} / ${stats?.returned_orders ?? 0}`} />
        <StatCard label="First / last order" value={<span className="text-base">{formatDate(stats?.first_order_at)} – {formatDate(stats?.last_order_at)}</span>} />
        <StatCard label="Refused COD" value={profile.failed_cod_count} tone={profile.failed_cod_count ? 'error' : undefined} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card title="Purchase history">
            {!orders?.length ? <Empty>No orders yet.</Empty> : (
              <table className="table-admin"><thead><tr><th>Order</th><th>Date</th><th>Method</th><th className="text-right">Total</th><th>Payment</th><th>Status</th></tr></thead>
                <tbody>{orders.map((o) => <tr key={o.id}><td><Link href={`/admin/orders/${o.id}`}>{o.order_number}</Link></td><td>{formatDate(o.created_at)}</td><td>{PAYMENT_METHOD[o.payment_method as 'cod']}</td><td className="text-right">{formatRs(o.total)}</td><td><PaymentStatusPill status={o.payment_status} /></td><td><OrderStatusPill status={o.status} /></td></tr>)}</tbody></table>
            )}
          </Card>
          <Card title="Products bought">
            {!products.length ? <Empty>Nothing yet.</Empty> : <ul className="space-y-1 text-sm">{products.map((p) => <li key={p.name} className="flex justify-between"><span>{p.name}</span><span className="text-brand-muted">× {p.qty} · last {formatDate(p.last)}</span></li>)}</ul>}
          </Card>
          <Card title="Cart history">
            <p className="label">Current cart</p>
            {cart?.length ? <ul className="mb-4 text-sm">{cart.map((l) => <li key={l.id}>{l.item_name} × {l.quantity} — {formatRs(l.line_value)}</li>)}</ul> : <p className="mb-4 text-sm text-brand-muted">Empty</p>}
            <ActivityFeed initial={(events ?? []) as FeedRow[]} limit={50} />
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Internal notes">
            <ActionForm action={saveCustomerNoteAction} className="space-y-2">
              <input type="hidden" name="user_id" value={id} />
              <textarea name="note" rows={5} className="input input-sm" defaultValue={note?.note ?? ''} placeholder="e.g. Prefers evening delivery" />
              <SubmitButton className="btn-secondary btn-sm">Save note</SubmitButton>
              {note?.updated_at ? <p className="help">Updated {formatDate(note.updated_at)}</p> : null}
            </ActionForm>
          </Card>
          <Card title="Addresses">
            {addresses?.length ? <ul className="space-y-3 text-sm">{addresses.map((a) => <li key={a.id}>{a.is_default ? <strong>Default · </strong> : null}{a.full_name}, {a.phone}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.district}</li>)}</ul> : <Empty>No saved addresses.</Empty>}
          </Card>
          <Card title="Profile">
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between"><dt>Date of birth</dt><dd>{formatDate(profile.date_of_birth)}</dd></div>
              <div className="flex justify-between"><dt>Marketing emails</dt><dd>{profile.marketing_opt_in ? 'Yes' : 'No'}</dd></div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
