import Link from 'next/link';
import { PageHeader } from '@/components/admin/ui';
import { ProductImage } from '@/components/ui/ProductImage';
import { requireAdmin } from '@/lib/admin';
import { bulkProductsAction } from '@/lib/actions/admin/catalog';
import { formatRs } from '@/lib/format';

export const metadata = { title: 'Products' };

export default async function ProductsPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string; category?: string; brand?: string; stock?: string }> }) {
  const sp = await searchParams;
  const { supabase } = await requireAdmin();
  let q = supabase.from('products')
    .select('id, name, slug, is_active, is_featured, deleted_at, brands(name), categories(name), product_images(storage_path, sort_order), product_variants(id, size_ml, price, stock_qty, is_active)')
    .is('deleted_at', null).order('updated_at', { ascending: false }).limit(200);
  if (sp.q) q = q.ilike('name', `%${sp.q.replace(/[%,()]/g, '')}%`);
  if (sp.status === 'active') q = q.eq('is_active', true);
  if (sp.status === 'hidden') q = q.eq('is_active', false);
  if (sp.status === 'featured') q = q.eq('is_featured', true);
  if (sp.category) q = q.eq('category_id', sp.category);
  if (sp.brand) q = q.eq('brand_id', sp.brand);
  const [{ data: products }, { data: awaiting }, { data: cats }, { data: brands }] = await Promise.all([
    q, supabase.from('admin_variant_awaiting').select('*'),
    supabase.from('categories').select('id, name').order('sort_order'), supabase.from('brands').select('id, name').order('name'),
  ]);
  const aw = Object.fromEntries((awaiting ?? []).map((a) => [a.variant_id, a.awaiting_qty as number]));
  type V = { id: string; size_ml: number; price: number; stock_qty: number; is_active: boolean };
  let rows = (products ?? []).map((p) => {
    const vs = (p.product_variants as V[]).filter((v) => v.is_active);
    return { ...p, vs, stock: vs.reduce((s, v) => s + v.stock_qty, 0), awaiting: vs.reduce((s, v) => s + (aw[v.id] ?? 0), 0),
      img: (p.product_images as { storage_path: string; sort_order: number }[]).sort((a, b) => a.sort_order - b.sort_order)[0]?.storage_path };
  });
  if (sp.stock === 'low') rows = rows.filter((r) => r.vs.some((v) => v.stock_qty <= 3));
  if (sp.stock === 'out') rows = rows.filter((r) => r.stock === 0);

  return (
    <div>
      <PageHeader title="Products" subtitle={`${rows.length} products`} actions={<Link href="/admin/products/new" className="btn-primary btn-sm no-underline">+ New product</Link>} />
      <form className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q} placeholder="Search" className="input input-sm w-48" />
        <select name="status" defaultValue={sp.status ?? ''} className="input input-sm w-auto"><option value="">All</option><option value="active">Active</option><option value="hidden">Hidden</option><option value="featured">Featured</option></select>
        <select name="category" defaultValue={sp.category ?? ''} className="input input-sm w-auto"><option value="">All categories</option>{cats?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select name="brand" defaultValue={sp.brand ?? ''} className="input input-sm w-auto"><option value="">All brands</option>{brands?.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select>
        <select name="stock" defaultValue={sp.stock ?? ''} className="input input-sm w-auto"><option value="">Any stock</option><option value="low">Low (≤3)</option><option value="out">Out of stock</option></select>
        <button className="btn-secondary btn-sm">Filter</button>
      </form>
      <form action={bulkProductsAction}>
        <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-brand-muted">With selected:</span>
          {[['show', 'Show'], ['hide', 'Hide'], ['feature', 'Mark featured'], ['unfeature', 'Unfeature']].map(([op, l]) => <button key={op} name="op" value={op} className="btn-secondary btn-sm">{l}</button>)}
        </div>
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead><tr><th><span className="sr-only">Select</span></th><th /><th>Product</th><th>Brand / category</th><th>Sizes &amp; price</th><th className="text-right">Stock</th><th className="text-right">Awaiting</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td><input type="checkbox" name="ids" value={p.id} className="h-4 w-4 accent-brand-green" aria-label={`Select ${p.name}`} /></td>
                  <td><Link href={`/admin/products/${p.id}#photos`} title={p.img ? 'Manage photos' : 'Add photos'} className="relative block h-12 w-10 overflow-hidden rounded bg-brand-cream">{p.img ? <ProductImage path={p.img} alt="" sizes="40px" /> : <span className="flex h-full items-center justify-center text-lg text-brand-muted">+</span>}</Link></td>
                  <td><Link href={`/admin/products/${p.id}`} className="font-medium underline">{p.name}</Link>{!p.img ? <span className="ml-2 text-xs text-state-warning">No photo</span> : null}{p.is_featured ? <span className="ml-2 text-xs text-brand-gold-dark">★ Featured</span> : null}</td>
                  <td className="text-brand-muted">{(p.brands as unknown as { name: string } | null)?.name ?? '—'} · {(p.categories as unknown as { name: string } | null)?.name ?? '—'}</td>
                  <td>{p.vs.map((v) => `${v.size_ml}ml ${formatRs(v.price)}`).join(' · ')}</td>
                  <td className={`text-right ${p.stock === 0 ? 'text-state-error' : p.vs.some((v) => v.stock_qty <= 3) ? 'text-state-warning' : ''}`}>{p.stock}</td>
                  <td className="text-right">{p.awaiting || '—'}</td>
                  <td>{p.is_active ? <span className="text-state-success">Active</span> : <span className="text-brand-muted">Hidden</span>}</td>
                  <td className="whitespace-nowrap text-right"><Link href={`/admin/products/${p.id}`} className="btn-secondary btn-sm no-underline">Edit</Link> <Link href={`/admin/products/${p.id}#photos`} className="btn-secondary btn-sm no-underline">Photos</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </form>
    </div>
  );
}
