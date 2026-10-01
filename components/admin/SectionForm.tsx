'use client';
import { useState } from 'react';
import { ActionForm } from './ActionForm';
import { MediaPicker, type Media } from './MediaPicker';
import { toLocalInput } from './ui';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { saveSectionAction } from '@/lib/actions/admin/content';
import { PRODUCT_SOURCES, SECTION_TYPES, TRUST_ICONS, type SectionType } from '@/lib/cms-schemas';

export interface SectionOptions {
  products: { id: string; name: string }[]; categories: { id: string; name: string; slug: string }[]; brands: { id: string; name: string; slug: string }[];
  promotions: { id: string; name: string }[]; bundles: { id: string; name: string }[];
}
interface Section { id: string; type: SectionType; title: string | null; subtitle: string | null; config: Record<string, unknown>; background: string; spacing: string; starts_at: string | null; ends_at: string | null; is_active: boolean }

function MultiCheck({ name, options, selected }: { name: string; options: { id: string; name: string }[]; selected: string[] }) {
  return (
    <div className="max-h-48 overflow-y-auto rounded-btn border border-brand-beige bg-white p-2">
      {options.map((o) => <label key={o.id} className="flex items-center gap-2 py-0.5 text-sm"><input type="checkbox" name={name} value={o.id} defaultChecked={selected.includes(o.id)} className="h-4 w-4 accent-brand-green" />{o.name}</label>)}
    </div>
  );
}

export function SectionForm({ section, options, media, galleryMedia = [] }: { section?: Section; options: SectionOptions; media?: Media | null; galleryMedia?: (Media | null)[] }) {
  const [type, setType] = useState<SectionType>(section?.type ?? 'product_row');
  const c = (section?.config ?? {}) as Record<string, unknown>;
  const [source, setSource] = useState(String(c.source ?? 'new'));
  const arr = (k: string) => (Array.isArray(c[k]) ? (c[k] as string[]) : []);
  const badges = (Array.isArray(c.badges) ? c.badges : []) as { icon: string; text: string }[];
  const pillars = (Array.isArray(c.pillars) ? c.pillars : []) as { icon: string; title: string; text: string }[];
  const noteItems = (Array.isArray(c.items) ? c.items : []) as { title: string; time: string; text: string }[];
  const quotes = (Array.isArray(c.quotes) ? c.quotes : []) as { text: string; author: string }[];

  return (
    <ActionForm action={saveSectionAction} className="grid gap-4 md:grid-cols-2" resetOnSuccess={!section}>
      <input type="hidden" name="id" value={section?.id ?? ''} />
      <label><span className="label">Section type</span>
        <select name="type" value={type} onChange={(e) => setType(e.target.value as SectionType)} disabled={!!section} className="input">
          {Object.entries(SECTION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {section ? <input type="hidden" name="type" value={type} /> : null}
      </label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="is_active" defaultChecked={section?.is_active ?? true} className="h-4 w-4 accent-brand-green" />Visible</label>
      {!['hero', 'trust_badges', 'marquee'].includes(type) ? <>
        <label><span className="label">Title <span className="text-brand-muted">(wrap words in *stars* for gold italics)</span></span><input name="title" defaultValue={section?.title ?? ''} className="input" /></label>
        <label><span className="label">Eyebrow / sub-title</span><input name="subtitle" defaultValue={section?.subtitle ?? ''} className="input" /></label>
      </> : null}

      {type === 'hero' ? <p className="text-sm text-brand-muted md:col-span-2">Uses the hero banners (Content → Hero banners). Always shown at the top.</p> : null}

      {type === 'product_row' ? <>
        <label><span className="label">Product source</span><select name="source" value={source} onChange={(e) => setSource(e.target.value)} className="input">
          {Object.entries(PRODUCT_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label><span className="label">Number of products (4–12)</span><input name="limit" type="number" min={4} max={12} defaultValue={Number(c.limit ?? 8)} className="input" /></label>
        {source === 'manual' ? <div className="md:col-span-2"><span className="label">Products</span><MultiCheck name="product_ids" options={options.products} selected={arr('product_ids')} /></div> : null}
        {source === 'category' ? <label><span className="label">Category</span><select name="category_slug" defaultValue={String(c.category_slug ?? '')} className="input">{options.categories.map((o) => <option key={o.id} value={o.slug}>{o.name}</option>)}</select></label> : null}
        {source === 'brand' ? <label><span className="label">Brand</span><select name="brand_slug" defaultValue={String(c.brand_slug ?? '')} className="input">{options.brands.map((o) => <option key={o.id} value={o.slug}>{o.name}</option>)}</select></label> : null}
        {source === 'promotion' ? <label><span className="label">Promotion</span><select name="promotion_id" defaultValue={String(c.promotion_id ?? '')} className="input">{options.promotions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label> : null}
        <label><span className="label">Layout</span><select name="layout" defaultValue={String(c.layout ?? 'grid')} className="input"><option value="grid">Grid</option><option value="slider">Slider row</option></select></label>
        <label><span className="label">“View all” link (optional)</span><input name="view_all" defaultValue={String(c.view_all ?? '')} className="input" placeholder="/shop?sort=newest" /></label>
        <label className="flex items-center gap-2 text-sm md:col-span-2"><input type="checkbox" name="filters" defaultChecked={!!c.filters} className="h-4 w-4 accent-brand-green" />Show filter tabs, search and sort (the “Signatures” layout)</label>
      </> : null}

      {type === 'marquee' ? <label className="md:col-span-2"><span className="label">Words (one per line)</span>
        <textarea name="words" rows={5} className="input" defaultValue={(Array.isArray(c.words) ? (c.words as string[]) : ['Oud', 'Amber', 'Rose de Mai', 'Sandalwood', 'Bergamot', 'Vetiver', 'Iris', 'Musk', 'Leather', 'Saffron']).join('\n')} /></label> : null}

      {type === 'notes' ? <div className="grid gap-3 md:col-span-2">
        <p className="help">Three columns with outlined roman numerals I / II / III. Leave empty to use the default copy.</p>
        {[0, 1, 2].map((i) => (
          <div key={i} className="grid gap-2 md:grid-cols-3">
            <input name={`note_title_${i}`} defaultValue={noteItems[i]?.title ?? ['Top Notes', 'Heart Notes', 'Base Notes'][i]} className="input input-sm" aria-label={`Column ${i + 1} title`} />
            <input name={`note_time_${i}`} defaultValue={noteItems[i]?.time ?? ['The first 15 minutes', 'Up to 4 hours', 'Lingers all day'][i]} className="input input-sm" aria-label={`Column ${i + 1} duration`} />
            <input name={`note_text_${i}`} defaultValue={noteItems[i]?.text ?? ''} className="input input-sm" placeholder="Text" aria-label={`Column ${i + 1} text`} />
          </div>
        ))}
      </div> : null}

      {type === 'testimonials' ? <div className="grid gap-2 md:col-span-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="grid gap-2 md:grid-cols-[1fr_220px]">
            <input name={`quote_text_${i}`} defaultValue={quotes[i]?.text ?? ''} className="input input-sm" placeholder={`Quote ${i + 1}`} aria-label={`Quote ${i + 1}`} />
            <input name={`quote_author_${i}`} defaultValue={quotes[i]?.author ?? ''} className="input input-sm" placeholder="Name, city" aria-label={`Quote ${i + 1} author`} />
          </div>
        ))}
      </div> : null}

      {type === 'gallery' ? <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
        <p className="help md:col-span-3">Five square tiles, then a gold Instagram tile (handle from Store settings). Empty = featured product photos.</p>
        {[0, 1, 2, 3, 4].map((i) => <MediaPicker key={i} name={`gallery_${i}`} initial={galleryMedia[i] ?? null} label={`Tile ${i + 1}`} slot="gallery" />)}
      </div> : null}

      {type === 'visit' ? <>
        <label className="md:col-span-2"><span className="label">Paragraph</span><textarea name="body" rows={3} defaultValue={String(c.body ?? '')} className="input" /></label>
        <div className="md:col-span-2"><MediaPicker name="media_id" initial={media} label="Boutique photo" slot="visit" hint="Address, hours and contact come from Store settings" /></div>
      </> : null}

      {type === 'promo_banner' ? <>
        <label><span className="label">Promotion</span><select name="promotion_id" required defaultValue={String(c.promotion_id ?? '')} className="input"><option value="">Choose…</option>{options.promotions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}</select>
          <span className="help">Uses the promotion&apos;s banner image. Shown only while the promotion is live.</span></label>
        <label><span className="label">Button text</span><input name="button_text" defaultValue={String(c.button_text ?? 'Shop the sale')} className="input" /></label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="countdown" defaultChecked={c.countdown !== false} className="h-4 w-4 accent-brand-green" />Show countdown to the end</label>
        <div className="md:col-span-2"><MediaPicker name="media_id" initial={media} label="Right-side photo (optional)" slot="promo_side" hint="Shown on the right of the banner, next to the text. Leave empty to use the promotion's own banner image as a dimmed background." /></div>
        <label><span className="label">Photo fit</span><select name="image_fit" defaultValue={String(c.image_fit ?? 'cover')} className="input">
          <option value="cover">Fill the right side (photos)</option><option value="contain">Show the whole image (cut-out bottle PNGs)</option></select></label>
      </> : null}

      {type === 'bundle_showcase' ? <>
        <label><span className="label">Bundles</span><select name="source" value={source === 'manual' ? 'manual' : 'all'} onChange={(e) => setSource(e.target.value)} className="input"><option value="all">All live bundles</option><option value="manual">Hand-picked</option></select></label>
        {source === 'manual' ? <div className="md:col-span-2"><MultiCheck name="bundle_ids" options={options.bundles} selected={arr('bundle_ids')} /></div> : null}
      </> : null}

      {type === 'category_tiles' ? <div className="md:col-span-2"><span className="label">Categories (uses each category&apos;s image)</span><MultiCheck name="category_ids" options={options.categories} selected={arr('category_ids')} /></div> : null}
      {type === 'brand_strip' ? <div className="md:col-span-2"><span className="label">Brands (shows their logos)</span><MultiCheck name="brand_ids" options={options.brands} selected={arr('brand_ids')} /></div> : null}

      {type === 'image_text' ? <>
        <div className="md:col-span-2"><MediaPicker name="media_id" initial={media} label="Image" slot="image_text" /></div>
        <label><span className="label">Image side</span><select name="image_side" defaultValue={String(c.image_side ?? 'left')} className="input"><option value="left">Left</option><option value="right">Right</option></select></label>
        <label><span className="label">Headline</span><input name="heading" defaultValue={String(c.heading ?? '')} className="input" /></label>
        <label className="md:col-span-2"><span className="label">Paragraph</span><textarea name="body" rows={4} defaultValue={String(c.body ?? '')} className="input" /><span className="help">**bold**, *italic*, [link](/about), and lines starting with “- ” for lists</span></label>
        <label><span className="label">Button text</span><input name="button_text" defaultValue={String(c.button_text ?? '')} className="input" /></label>
        <label><span className="label">Button link</span><input name="button_link" defaultValue={String(c.button_link ?? '')} className="input" placeholder="/about" /></label>
        <label><span className="label">Badge number (e.g. 100 → “100%”, optional)</span><input name="badge_number" type="number" min={0} defaultValue={c.badge_number != null ? String(c.badge_number) : ''} className="input" /></label>
        <label><span className="label">Badge text</span><textarea name="badge_text" rows={2} defaultValue={String(c.badge_text ?? '')} className="input" placeholder={'Authentic\nGuaranteed'} /><span className="help">Press Enter for a second line</span></label>
        <div className="grid gap-2 md:col-span-2">
          <span className="label">Pillars (round gold icons, optional)</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="grid gap-2 md:grid-cols-[110px_1fr_2fr]">
              <select name={`pillar_icon_${i}`} defaultValue={pillars[i]?.icon ?? 'star'} className="input input-sm" aria-label={`Pillar ${i + 1} icon`}>{TRUST_ICONS.map((ic) => <option key={ic}>{ic}</option>)}</select>
              <input name={`pillar_title_${i}`} defaultValue={pillars[i]?.title ?? ''} className="input input-sm" placeholder="Title" aria-label={`Pillar ${i + 1} title`} />
              <input name={`pillar_text_${i}`} defaultValue={pillars[i]?.text ?? ''} className="input input-sm" placeholder="Text" aria-label={`Pillar ${i + 1} text`} />
            </div>
          ))}
        </div>
      </> : null}

      {type === 'text' ? <>
        <label className="md:col-span-2"><span className="label">Heading</span><input name="heading" defaultValue={String(c.heading ?? '')} className="input" /></label>
        <label className="md:col-span-2"><span className="label">Text</span><textarea name="body" rows={6} defaultValue={String(c.body ?? '')} className="input" /><span className="help">**bold**, *italic*, [link](/about), and lines starting with “- ” for lists</span></label>
      </> : null}

      {type === 'trust_badges' ? <div className="grid gap-2 md:col-span-2 md:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-2">
            <select name={`badge_icon_${i}`} defaultValue={badges[i]?.icon ?? 'shield'} className="input input-sm w-28" aria-label={`Badge ${i + 1} icon`}>{TRUST_ICONS.map((ic) => <option key={ic}>{ic}</option>)}</select>
            <input name={`badge_text_${i}`} defaultValue={badges[i]?.text ?? ''} className="input input-sm" placeholder={`Badge ${i + 1} text`} aria-label={`Badge ${i + 1} text`} />
          </div>
        ))}
      </div> : null}

      <label><span className="label">Background</span><select name="background" defaultValue={section?.background ?? 'cream'} className="input"><option value="cream">Cream</option><option value="beige">Beige</option><option value="green">Dark Green</option></select></label>
      <label><span className="label">Spacing</span><select name="spacing" defaultValue={section?.spacing ?? 'medium'} className="input"><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option></select></label>
      <label><span className="label">Show from</span><input type="datetime-local" name="starts_at" defaultValue={toLocalInput(section?.starts_at)} className="input" /></label>
      <label><span className="label">Show until</span><input type="datetime-local" name="ends_at" defaultValue={toLocalInput(section?.ends_at)} className="input" /></label>
      <div className="md:col-span-2"><SubmitButton>{section ? 'Save section' : 'Add section'}</SubmitButton></div>
    </ActionForm>
  );
}
