'use client';
import { useState } from 'react';
import { ActionForm } from './ActionForm';
import { MediaPicker, type Media } from './MediaPicker';
import { toLocalInput } from './ui';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { savePromotionAction } from '@/lib/actions/admin/content';
import { slugify } from '@/lib/format';

type Opt = { id: string; name: string };
interface Promo {
  id: string; name: string; slug: string; description: string | null; discount_type: string; discount_value: number; badge_text: string | null;
  show_countdown: boolean; include_bundles: boolean; seo_title: string | null; seo_description: string | null; starts_at: string; ends_at: string; is_active: boolean;
}
interface Target { target_type: string; target_id: string | null; is_exclusion: boolean }

function Picks({ name, options, selected, label }: { name: string; options: Opt[]; selected: string[]; label: string }) {
  const [q, setQ] = useState('');
  return (
    <div>
      <span className="label">{label}</span>
      {options.length > 8 ? <input className="input input-sm mb-1" placeholder="Filter…" value={q} onChange={(e) => setQ(e.target.value)} /> : null}
      <div className="max-h-44 overflow-y-auto rounded-btn border border-brand-beige bg-white p-2">
        {options.map((o) => (
          <label key={o.id} className={`flex items-center gap-2 py-0.5 text-sm ${q && !o.name.toLowerCase().includes(q.toLowerCase()) ? 'hidden' : ''}`}>
            <input type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(o.id)} className="h-4 w-4 accent-brand-green" />{o.name}
          </label>
        ))}
      </div>
    </div>
  );
}

export function PromotionForm({ promo, targets = [], options, desktop, mobile }: {
  promo?: Promo; targets?: Target[]; desktop?: Media | null; mobile?: Media | null;
  options: { categories: Opt[]; brands: Opt[]; products: Opt[]; variants: Opt[] };
}) {
  const [name, setName] = useState(promo?.name ?? '');
  const [slug, setSlug] = useState(promo?.slug ?? '');
  const [type, setType] = useState(promo?.discount_type ?? 'percent');
  const sel = (t: string, ex = false) => targets.filter((x) => x.target_type === t && x.is_exclusion === ex).map((x) => x.target_id!);
  const now = new Date();

  return (
    <ActionForm action={savePromotionAction} className="space-y-6" redirectTo={promo ? undefined : (id) => `/admin/promotions/${id}`}>
      <input type="hidden" name="id" value={promo?.id ?? ''} />
      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <label><span className="label">Name</span><input name="name" required className="input" value={name} onChange={(e) => { setName(e.target.value); if (!promo) setSlug(slugify(e.target.value)); }} placeholder="Avurudu Sale 2027" /></label>
        <label><span className="label">URL slug</span><div className="flex items-center gap-1"><span className="text-sm text-brand-muted">/promotions/</span><input name="slug" required className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></div></label>
        <label className="md:col-span-2"><span className="label">Description</span><textarea name="description" rows={2} className="input" defaultValue={promo?.description ?? ''} /></label>
        <label><span className="label">Discount type</span><select name="discount_type" value={type} onChange={(e) => setType(e.target.value)} className="input"><option value="percent">Percentage off</option><option value="amount">Fixed amount off per item (Rs.)</option></select></label>
        <label><span className="label">{type === 'percent' ? 'Percent off' : 'Rs. off each item'}</span><input name="discount_value" type="number" step="0.01" min="0.01" max={type === 'percent' ? 100 : undefined} required className="input" defaultValue={promo?.discount_value} /></label>
        <label><span className="label">Badge text</span><input name="badge_text" className="input" defaultValue={promo?.badge_text ?? ''} placeholder="Avurudu −20%" /></label>
        <div className="flex flex-col justify-end gap-2 pb-2 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="show_countdown" defaultChecked={promo?.show_countdown} className="h-4 w-4 accent-brand-green" />Show countdown (“Ends in 2d 5h”)</label>
          <label className="flex items-center gap-2"><input type="checkbox" name="include_bundles" defaultChecked={promo?.include_bundles} className="h-4 w-4 accent-brand-green" />Include bundles (in the targeted categories)</label>
        </div>
        <label><span className="label">Start *</span><input type="datetime-local" name="starts_at" required className="input" defaultValue={toLocalInput(promo?.starts_at ?? now.toISOString())} /></label>
        <label><span className="label">End *</span><input type="datetime-local" name="ends_at" required className="input" defaultValue={toLocalInput(promo?.ends_at)} /></label>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="is_active" defaultChecked={promo?.is_active} className="h-4 w-4 accent-brand-green" />Active (Draft until switched on)</label>
      </section>

      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <h2 className="font-serif text-xl font-semibold text-brand-green md:col-span-2">Applies to</h2>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="target_all" defaultChecked={targets.some((t) => t.target_type === 'all')} className="h-4 w-4 accent-brand-green" />Whole store</label>
        <Picks name="target_category" label="Categories" options={options.categories} selected={sel('category')} />
        <Picks name="target_brand" label="Brands" options={options.brands} selected={sel('brand')} />
        <Picks name="target_product" label="Specific products" options={options.products} selected={sel('product')} />
        <Picks name="target_variant" label="Specific sizes" options={options.variants} selected={sel('variant')} />
        <h3 className="mt-2 font-serif text-lg font-semibold text-brand-green md:col-span-2">Exclusions</h3>
        <Picks name="exclude_product" label="Leave out products" options={options.products} selected={sel('product', true)} />
        <Picks name="exclude_brand" label="Leave out brands" options={options.brands} selected={sel('brand', true)} />
        <p className="help md:col-span-2">No stacking: if a product is in two live promotions, the customer gets the one with the lowest price. Prices never go below zero.</p>
      </section>

      <section className="card grid gap-4 p-5 md:grid-cols-2">
        <MediaPicker name="desktop_media_id" initial={desktop} label="Banner image (desktop)" slot="promo_desktop" />
        <MediaPicker name="mobile_media_id" initial={mobile} label="Banner image (mobile)" slot="promo_mobile" />
        <label><span className="label">SEO title</span><input name="seo_title" className="input" defaultValue={promo?.seo_title ?? ''} /></label>
        <label><span className="label">SEO description</span><input name="seo_description" className="input" defaultValue={promo?.seo_description ?? ''} /></label>
      </section>
      <SubmitButton>{promo ? 'Save promotion' : 'Create promotion'}</SubmitButton>
    </ActionForm>
  );
}
