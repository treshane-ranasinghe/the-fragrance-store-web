'use client';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ActionForm } from './ActionForm';
import { toLocalInput } from './ui';
import { uploadImage } from './uploads';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { ProductImage } from '@/components/ui/ProductImage';
import { saveBundleAction, saveBundleImagesAction } from '@/lib/actions/admin/content';
import { formatRs, slugify } from '@/lib/format';

interface Bundle { id: string; name: string; slug: string; description: string | null; category_id: string | null; price: number; max_per_order: number | null; seo_title: string | null; seo_description: string | null; starts_at: string | null; ends_at: string | null; is_active: boolean }

export function BundleForm({ bundle, items: initialItems = [], variants, categories }: {
  bundle?: Bundle; items?: { variant_id: string; quantity: number }[];
  variants: { id: string; name: string; price: number; stock: number }[]; categories: { id: string; name: string }[];
}) {
  const [name, setName] = useState(bundle?.name ?? '');
  const [slug, setSlug] = useState(bundle?.slug ?? '');
  const [items, setItems] = useState(initialItems.length ? initialItems : [{ variant_id: '', quantity: 1 }]);
  const [price, setPrice] = useState<string>(bundle ? String(bundle.price) : '');
  const value = useMemo(() => items.reduce((s, i) => s + (variants.find((v) => v.id === i.variant_id)?.price ?? 0) * i.quantity, 0), [items, variants]);
  const saving = value - Number(price || 0);
  const sets = items.filter((i) => i.variant_id).length ? Math.min(...items.filter((i) => i.variant_id).map((i) => Math.floor((variants.find((v) => v.id === i.variant_id)?.stock ?? 0) / i.quantity))) : 0;

  return (
    <ActionForm action={saveBundleAction} className="space-y-6" redirectTo={bundle ? undefined : (id) => `/admin/bundles/${id}`}>
      <input type="hidden" name="id" value={bundle?.id ?? ''} />
      <input type="hidden" name="items" value={JSON.stringify(items)} />
      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <label><span className="label">Name</span><input name="name" required className="input" value={name} onChange={(e) => { setName(e.target.value); if (!bundle) setSlug(slugify(e.target.value)); }} /></label>
        <label><span className="label">URL slug</span><div className="flex items-center gap-1"><span className="text-sm text-brand-muted">/bundle/</span><input name="slug" required className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></div></label>
        <label className="md:col-span-2"><span className="label">Description</span><textarea name="description" rows={4} className="input" defaultValue={bundle?.description ?? ''} /><span className="help">**bold**, *italic*, [links](/shop) and “- ” lists</span></label>
      </section>

      <section className="card p-5">
        <h2 className="mb-3 font-serif text-xl font-semibold text-brand-green">Items</h2>
        <ul className="space-y-2">
          {items.map((it, i) => (
            <li key={i} className="flex flex-wrap items-center gap-2">
              <select className="input input-sm min-w-[260px] flex-1" value={it.variant_id} onChange={(e) => setItems((c) => c.map((x, j) => (j === i ? { ...x, variant_id: e.target.value } : x)))} aria-label="Product size">
                <option value="">Choose a product size…</option>{variants.map((v) => <option key={v.id} value={v.id}>{v.name} — {formatRs(v.price)} (stock {v.stock})</option>)}
              </select>
              <input type="number" min={1} className="input input-sm w-20" value={it.quantity} onChange={(e) => setItems((c) => c.map((x, j) => (j === i ? { ...x, quantity: Math.max(1, Number(e.target.value) || 1) } : x)))} aria-label="Quantity" />
              {items.length > 1 ? <button type="button" className="text-sm text-state-error underline" onClick={() => setItems((c) => c.filter((_, j) => j !== i))}>Remove</button> : null}
            </li>
          ))}
        </ul>
        <button type="button" className="btn-secondary btn-sm mt-3" onClick={() => setItems((c) => [...c, { variant_id: '', quantity: 1 }])}>+ Add item</button>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <label><span className="label">Bundle price (Rs.)</span><input name="price" type="number" step="0.01" min="0.01" required className="input" value={price} onChange={(e) => setPrice(e.target.value)} /></label>
          <div className="text-sm"><p className="label">Items bought separately</p><p className="text-lg">{formatRs(value)}</p></div>
          <div className="text-sm"><p className="label">You save</p>
            <p className={`text-lg font-medium ${saving < 0 ? 'text-state-error' : saving < value * 0.05 ? 'text-state-warning' : 'text-state-success'}`}>{formatRs(saving)}</p>
            {saving < 0 ? <p className="text-state-error">Higher than buying separately — can&apos;t save</p> : saving < value * 0.05 && value > 0 ? <p className="text-state-warning">Saving under 5%</p> : null}</div>
        </div>
        <p className="help mt-2">Bundles have no stock of their own. Available sets now: <strong>{sets}</strong>.</p>
      </section>

      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <label><span className="label">Category (optional)</span><select name="category_id" className="input" defaultValue={bundle?.category_id ?? ''}><option value="">—</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
        <label><span className="label">Max per order (optional)</span><input name="max_per_order" type="number" min={1} className="input" defaultValue={bundle?.max_per_order ?? ''} /></label>
        <label><span className="label">Start (optional)</span><input type="datetime-local" name="starts_at" className="input" defaultValue={toLocalInput(bundle?.starts_at)} /></label>
        <label><span className="label">End (optional)</span><input type="datetime-local" name="ends_at" className="input" defaultValue={toLocalInput(bundle?.ends_at)} /></label>
        <label><span className="label">SEO title</span><input name="seo_title" className="input" defaultValue={bundle?.seo_title ?? ''} /></label>
        <label><span className="label">SEO description</span><input name="seo_description" className="input" defaultValue={bundle?.seo_description ?? ''} /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={bundle?.is_active} className="h-4 w-4 accent-brand-green" />Active</label>
      </section>
      <SubmitButton>{bundle ? 'Save bundle' : 'Create bundle'}</SubmitButton>
    </ActionForm>
  );
}

export function BundleImages({ bundleId, name, images }: { bundleId: string; name: string; images: { id: string; storage_path: string; alt_text: string | null }[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  return (
    <section className="card p-5">
      <h2 className="mb-1 font-serif text-xl font-semibold text-brand-green">Images</h2>
      <p className="help mb-3">If there are none, a collage of the item images is shown.</p>
      <ul className="mb-3 flex flex-wrap gap-3">
        {images.map((img) => (
          <li key={img.id} className="text-center text-xs">
            <div className="relative h-24 w-24 overflow-hidden rounded-btn bg-brand-cream"><ProductImage path={img.storage_path} alt={img.alt_text ?? ''} sizes="96px" /></div>
            <button type="button" className="mt-1 text-state-error underline" onClick={async () => { await saveBundleImagesAction(bundleId, [], [img.id]); router.refresh(); }}>Delete</button>
          </li>
        ))}
      </ul>
      <label className="btn-secondary btn-sm cursor-pointer">{busy ? 'Uploading…' : 'Upload images'}
        <input type="file" multiple accept="image/*" className="sr-only" onChange={async (e) => {
          if (!e.target.files) return;
          setBusy(true); setErr('');
          try {
            const up = [];
            for (const f of Array.from(e.target.files)) up.push({ storage_path: (await uploadImage('product-images', f, `bundles/${bundleId}`)).path, alt_text: name });
            await saveBundleImagesAction(bundleId, up, []);
            router.refresh();
          } catch (x) { setErr((x as Error).message); }
          setBusy(false);
        }} /></label>
      <p className="help mt-1">Best 1600 × 2000 px (4:5 portrait), min 1000 × 1250 px · JPG/PNG/WebP, max 5 MB</p>
      {err ? <p className="error-text">{err}</p> : null}
    </section>
  );
}
