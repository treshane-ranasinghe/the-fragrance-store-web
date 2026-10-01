import Link from 'next/link';
import { ContentRowActions } from '@/components/admin/ContentRowActions';
import { ContentStatus, Empty, PageHeader } from '@/components/admin/ui';
import { ProductImage } from '@/components/ui/ProductImage';
import { requireAdmin } from '@/lib/admin';
import { formatDate, formatRs } from '@/lib/format';

export const metadata = { title: 'Bundles' };

export default async function BundlesAdmin() {
  const { supabase } = await requireAdmin();
  const { data: bundles } = await supabase.from('bundles')
    .select('*, bundle_images(storage_path, sort_order), bundle_items(quantity, product_variants(price, size_ml, products(name)))').order('created_at', { ascending: false });
  const avail = await Promise.all((bundles ?? []).map((b) => supabase.rpc('bundle_availability', { p_bundle_id: b.id }).then((r) => r.data as number)));
  return (
    <div>
      <PageHeader title="Bundles" subtitle="Several products sold together at one price" actions={<Link href="/admin/bundles/new" className="btn-primary btn-sm no-underline">+ New bundle</Link>} />
      {!bundles?.length ? <Empty>No bundles yet.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead><tr><th /><th>Name</th><th>Items</th><th className="text-right">Price</th><th className="text-right">You save</th><th className="text-right">Available</th><th>Dates</th><th>Status</th><th /></tr></thead>
            <tbody>{bundles.map((b, i) => {
              const items = b.bundle_items as unknown as { quantity: number; product_variants: { price: number; size_ml: number; products: { name: string } } }[];
              const value = items.reduce((s, it) => s + Number(it.product_variants.price) * it.quantity, 0);
              const img = (b.bundle_images as { storage_path: string; sort_order: number }[]).sort((x, y) => x.sort_order - y.sort_order)[0]?.storage_path;
              return (
                <tr key={b.id}>
                  <td><div className="relative h-12 w-12 overflow-hidden rounded bg-brand-cream"><ProductImage path={img} alt="" sizes="48px" /></div></td>
                  <td><Link href={`/admin/bundles/${b.id}`} className="font-medium">{b.name}</Link></td>
                  <td className="text-xs">{items.map((it) => `${it.product_variants.products.name} ${it.product_variants.size_ml}ml ×${it.quantity}`).join(', ')}</td>
                  <td className="text-right">{formatRs(b.price)}</td>
                  <td className="text-right">{formatRs(value - Number(b.price))}</td>
                  <td className={`text-right ${avail[i] === 0 ? 'text-state-error' : ''}`}>{avail[i] ?? 0}</td>
                  <td className="text-xs">{b.starts_at || b.ends_at ? `${formatDate(b.starts_at)} → ${formatDate(b.ends_at)}` : '—'}</td>
                  <td><ContentStatus is_active={b.is_active} starts_at={b.starts_at} ends_at={b.ends_at} /></td>
                  <td className="whitespace-nowrap"><ContentRowActions table="bundles" id={b.id} active={b.is_active} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
