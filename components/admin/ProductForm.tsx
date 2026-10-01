'use client';
import { useState } from 'react';
import { saveProductAction } from '@/lib/actions/admin/catalog';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { slugify } from '@/lib/format';
import { ActionForm } from './ActionForm';

interface Variant { id?: string; size_ml: number | string; sku: string; price: number | string; compare_at_price: number | string | null; stock_qty: number | string; is_active: boolean }
interface Product {
  id?: string; name: string; slug: string; brand_id: string | null; category_id: string | null; gender: string; concentration: string;
  description: string | null; top_notes: string[]; middle_notes: string[]; base_notes: string[]; is_featured: boolean; is_active: boolean;
  seo_title: string | null; seo_description: string | null; badge?: string | null;
}

export function ProductForm({ product, variants: initialVariants, brands, categories, awaiting }: {
  product?: Product; variants?: Variant[]; brands: { id: string; name: string }[]; categories: { id: string; name: string }[];
  awaiting?: Record<string, number>;
}) {
  const [name, setName] = useState(product?.name ?? '');
  const [slug, setSlug] = useState(product?.slug ?? '');
  const [slugTouched, setSlugTouched] = useState(!!product?.slug);
  const [variants, setVariants] = useState<Variant[]>(initialVariants?.length ? initialVariants : [{ size_ml: '', sku: '', price: '', compare_at_price: '', stock_qty: 0, is_active: true }]);
  const set = (i: number, k: keyof Variant, v: unknown) => setVariants((cur) => cur.map((x, j) => (j === i ? { ...x, [k]: v } : x)));

  return (
    <ActionForm action={saveProductAction} className="space-y-6" redirectTo={product?.id ? undefined : (id) => `/admin/products/${id}`}>
      <input type="hidden" name="id" value={product?.id ?? ''} />
      <input type="hidden" name="variants" value={JSON.stringify(variants)} />
      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <label className="md:col-span-2"><span className="label">Name</span>
          <input name="name" required className="input" value={name} onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} /></label>
        <label className="md:col-span-2"><span className="label">URL slug</span>
          <div className="flex items-center gap-2"><span className="text-sm text-brand-muted">/product/</span>
            <input name="slug" required className="input" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} /></div>
          {product?.slug && slug !== product.slug ? <span className="help">The old URL will redirect here automatically (301).</span> : null}</label>
        <label><span className="label">Brand</span><select name="brand_id" className="input" defaultValue={product?.brand_id ?? ''}><option value="">—</option>{brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
        <label><span className="label">Category</span><select name="category_id" className="input" defaultValue={product?.category_id ?? ''}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="label">Gender</span><select name="gender" className="input" defaultValue={product?.gender ?? 'unisex'}><option value="men">Men</option><option value="women">Women</option><option value="unisex">Unisex</option></select></label>
        <label><span className="label">Concentration</span><select name="concentration" className="input" defaultValue={product?.concentration ?? 'EDP'}>{['EDP', 'EDT', 'Parfum', 'Body Mist', 'Other'].map((c) => <option key={c}>{c}</option>)}</select></label>
        <label className="md:col-span-2"><span className="label">Card tag <span className="text-brand-muted">(e.g. Bestseller, Signature, New — optional)</span></span><input name="badge" className="input" defaultValue={product?.badge ?? ''} maxLength={24} /></label>
        <label className="md:col-span-2"><span className="label">Description</span><textarea name="description" rows={5} className="input" defaultValue={product?.description ?? ''} /></label>
        <label><span className="label">Top notes</span><input name="top_notes" className="input" defaultValue={product?.top_notes.join(', ')} placeholder="Bergamot, Pepper" /></label>
        <label><span className="label">Heart notes</span><input name="middle_notes" className="input" defaultValue={product?.middle_notes.join(', ')} /></label>
        <label><span className="label">Base notes</span><input name="base_notes" className="input" defaultValue={product?.base_notes.join(', ')} /></label>
        <div className="flex items-end gap-6 pb-3">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={product?.is_active ?? true} className="h-4 w-4 accent-brand-green" />Active (visible in store)</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_featured" defaultChecked={product?.is_featured} className="h-4 w-4 accent-brand-green" />Featured</label>
        </div>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-serif text-xl font-semibold text-brand-green">Sizes &amp; stock</h2>
        <div className="overflow-x-auto">
          <table className="table-admin">
            <thead><tr><th>Size (ml)</th><th>SKU</th><th>Price (Rs.)</th><th>Compare-at</th><th>Stock</th>{awaiting ? <th>Awaiting</th> : null}<th>Active</th><th /></tr></thead>
            <tbody>
              {variants.map((v, i) => (
                <tr key={v.id ?? `new-${i}`}>
                  <td><input className="input input-sm w-20" type="number" min={1} value={v.size_ml} onChange={(e) => set(i, 'size_ml', e.target.value)} required aria-label="Size in ml" /></td>
                  <td><input className="input input-sm w-40" value={v.sku} onChange={(e) => set(i, 'sku', e.target.value)} required aria-label="SKU" /></td>
                  <td><input className="input input-sm w-28" type="number" min={0} step="0.01" value={v.price} onChange={(e) => set(i, 'price', e.target.value)} required aria-label="Price" /></td>
                  <td><input className="input input-sm w-28" type="number" min={0} step="0.01" value={v.compare_at_price ?? ''} onChange={(e) => set(i, 'compare_at_price', e.target.value)} aria-label="Compare-at price" /></td>
                  <td><input className="input input-sm w-20" type="number" min={0} value={v.stock_qty} onChange={(e) => set(i, 'stock_qty', e.target.value)} required aria-label="Stock" /></td>
                  {awaiting ? <td className="text-state-warning">{v.id && awaiting[v.id] ? awaiting[v.id] : '—'}</td> : null}
                  <td><input type="checkbox" checked={v.is_active} onChange={(e) => set(i, 'is_active', e.target.checked)} className="h-4 w-4 accent-brand-green" aria-label="Active" /></td>
                  <td>{variants.length > 1 ? <button type="button" className="text-sm text-state-error underline" onClick={() => setVariants((c) => c.filter((_, j) => j !== i))}>Remove</button> : null}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => setVariants((c) => [...c, { size_ml: '', sku: '', price: '', compare_at_price: '', stock_qty: 0, is_active: true }])}>+ Add size</button>
        {awaiting ? <p className="help mt-2">&quot;Awaiting&quot; = quantity in unconfirmed orders (pending / on hold). Stock is only reduced when an order is confirmed.</p> : null}
      </section>

      <section className="card grid gap-4 p-5">
        <h2 className="font-serif text-xl font-semibold text-brand-green">Search engine</h2>
        <label><span className="label">SEO title</span><input name="seo_title" className="input" defaultValue={product?.seo_title ?? ''} placeholder="Leave empty to build automatically" /></label>
        <label><span className="label">SEO description</span><textarea name="seo_description" rows={2} className="input" defaultValue={product?.seo_description ?? ''} placeholder="Leave empty to build automatically" /></label>
      </section>

      <SubmitButton>{product?.id ? 'Save product' : 'Create product & add photos →'}</SubmitButton>
    </ActionForm>
  );
}
