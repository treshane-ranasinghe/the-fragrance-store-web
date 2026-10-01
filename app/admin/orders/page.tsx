import Link from 'next/link';
import { PageHeader } from '@/components/admin/ui';
import { OrderStatusPill, PaymentStatusPill, Pill } from '@/components/ui/StatusPill';
import { requireAdmin } from '@/lib/admin';
import { formatDateTime, formatRs } from '@/lib/format';
import { ORDER_STATUS, PAYMENT_METHOD, PAYMENT_STATUS } from '@/lib/status';
import { NewOrderRefresher } from '@/components/admin/NewOrderRefresher';

export const metadata = { title: 'Orders' };

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const page = Math.max(1, Number(sp.page) || 1);
  let q = supabase.from('admin_orders').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (sp.status) q = q.eq('status', sp.status);
  if (sp.method) q = q.eq('payment_method', sp.method);
  if (sp.payment) q = q.eq('payment_status', sp.payment);
  if (sp.from) q = q.gte('created_at', `${sp.from}T00:00:00+05:30`);
  if (sp.to) q = q.lte('created_at', `${sp.to}T23:59:59+05:30`);
  if (sp.q) { const t = sp.q.replace(/[%,()]/g, ''); q = q.or(`order_number.ilike.%${t}%,customer_name.ilike.%${t}%,shipping_phone.ilike.%${t}%,customer_email.ilike.%${t}%`); }
  const { data: orders, count } = await q.range((page - 1) * 50, page * 50 - 1);
  const pages = Math.max(1, Math.ceil((count ?? 0) / 50));
  const qs = (p: number) => '?' + new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)) as Record<string, string>, page: String(p) }).toString();

  return (
    <div>
      <NewOrderRefresher />
      <PageHeader title="Orders" subtitle={`${count ?? 0} orders`} actions={<a href={`/admin/export/orders${qs(1)}`} className="btn-secondary btn-sm no-underline">Export CSV</a>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Order, name, phone, email" className="input input-sm w-56" />
        <select name="status" defaultValue={sp.status ?? ''} className="input input-sm w-auto"><option value="">Any status</option>{Object.entries(ORDER_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <select name="method" defaultValue={sp.method ?? ''} className="input input-sm w-auto"><option value="">Any method</option>{Object.entries(PAYMENT_METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="payment" defaultValue={sp.payment ?? ''} className="input input-sm w-auto"><option value="">Any payment</option>{Object.entries(PAYMENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select>
        <input type="date" name="from" defaultValue={sp.from} className="input input-sm w-auto" aria-label="From date" />
        <input type="date" name="to" defaultValue={sp.to} className="input input-sm w-auto" aria-label="To date" />
        <button className="btn-secondary btn-sm">Filter</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th>Order</th><th>Date</th><th>Customer</th><th className="text-right">Items</th><th className="text-right">Total</th><th>Method</th><th>Payment</th><th>Status</th><th>Flags</th></tr></thead>
          <tbody>
            {(orders ?? []).map((o) => (
              <tr key={o.id}>
                <td><Link href={`/admin/orders/${o.id}`} className="font-medium">{o.order_number}</Link></td>
                <td className="whitespace-nowrap">{formatDateTime(o.created_at)}</td>
                <td>{o.customer_name}<br /><span className="text-xs text-brand-muted">{o.shipping_phone}</span></td>
                <td className="text-right">{o.item_count}</td>
                <td className="text-right">{formatRs(o.total)}</td>
                <td>{PAYMENT_METHOD[o.payment_method as 'cod']}</td>
                <td><PaymentStatusPill status={o.payment_status} /></td>
                <td><OrderStatusPill status={o.status} /></td>
                <td className="space-x-1">
                  {o.stock_issue ? <Pill label="Paid — out of stock" tone="error" /> : null}
                  {o.is_overdue ? <Pill label="Overdue" tone="error" /> : null}
                  {o.cod_needs_attention ? <Pill label="Needs attention" tone="warning" /> : null}
                  {o.cod_remit_overdue ? <Pill label="Cash overdue" tone="error" /> : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {pages > 1 ? <nav className="mt-4 flex justify-center gap-3 text-sm">{page > 1 ? <Link href={qs(page - 1)}>← Newer</Link> : null}<span>Page {page} / {pages}</span>{page < pages ? <Link href={qs(page + 1)}>Older →</Link> : null}</nav> : null}
    </div>
  );
}
