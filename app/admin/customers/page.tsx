import Link from 'next/link';
import { PageHeader } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin';
import { formatDate, formatRs } from '@/lib/format';

export const metadata = { title: 'Customers' };

const SORTS: Record<string, [string, boolean]> = {
  newest: ['created_at', false], spent: ['total_spent', false], orders: ['total_orders', false], last: ['last_order_at', false], name: ['full_name', true],
};

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string; sort?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  const [col, asc] = SORTS[sp.sort ?? 'newest'] ?? SORTS.newest;
  let q = supabase.from('admin_customer_stats').select('*').is('deleted_at', null).order(col, { ascending: asc, nullsFirst: false }).limit(500);
  if (sp.q) { const t = sp.q.replace(/[%,()]/g, ''); q = q.or(`full_name.ilike.%${t}%,email.ilike.%${t}%,phone.ilike.%${t}%`); }
  const { data } = await q;
  return (
    <div>
      <PageHeader title="Customers" subtitle={`${data?.length ?? 0} registered customers`} actions={<a href="/admin/export/customers" className="btn-secondary btn-sm no-underline">Export CSV</a>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Name, email or phone" className="input input-sm w-64" />
        <select name="sort" defaultValue={sp.sort ?? 'newest'} className="input input-sm w-auto">
          <option value="newest">Newest members</option><option value="spent">Total spent</option><option value="orders">Most orders</option><option value="last">Last order</option><option value="name">Name</option>
        </select>
        <button className="btn-secondary btn-sm">Apply</button>
      </form>
      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th>Name</th><th>Phone</th><th>Email</th><th>Member since</th><th className="text-right">Orders</th><th className="text-right">Total spent</th><th>Last order</th><th className="text-right">Refused COD</th></tr></thead>
          <tbody>
            {(data ?? []).map((c) => (
              <tr key={c.id}>
                <td><Link href={`/admin/customers/${c.id}`} className="font-medium">{c.full_name || '—'}</Link>{c.role === 'admin' ? <span className="ml-2 text-xs text-brand-gold-dark">Admin</span> : null}</td>
                <td>{c.phone}</td><td>{c.email}</td><td>{formatDate(c.created_at)}</td>
                <td className="text-right">{c.total_orders}</td><td className="text-right">{formatRs(c.total_spent)}</td>
                <td>{formatDate(c.last_order_at)}</td>
                <td className={`text-right ${c.failed_cod_count ? 'text-state-error' : ''}`}>{c.failed_cod_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
