'use client';
import { useState } from 'react';

export type LinkOptions = Record<'promotion' | 'bundle' | 'product' | 'category' | 'brand', { slug: string; name: string }[]>;

/** Button link: a promotion, bundle, product, category, brand, or custom URL */
export function LinkPicker({ prefix, options, initialType, initialTarget }: { prefix: string; options: LinkOptions; initialType?: string | null; initialTarget?: string | null }) {
  const [type, setType] = useState(initialType ?? '');
  const list = type && type !== 'url' ? options[type as keyof LinkOptions] ?? [] : [];
  return (
    <div className="flex gap-2">
      <select name={`${prefix}_link_type`} value={type} onChange={(e) => setType(e.target.value)} className="input input-sm w-36" aria-label="Link type">
        <option value="">No link</option><option value="promotion">Promotion</option><option value="bundle">Bundle</option><option value="product">Product</option>
        <option value="category">Category</option><option value="brand">Brand</option><option value="url">Custom URL</option>
      </select>
      {type === 'url' ? <input name={`${prefix}_link_target`} defaultValue={initialTarget ?? ''} placeholder="/shop or https://…" className="input input-sm" aria-label="URL" />
        : type ? (
          <select name={`${prefix}_link_target`} defaultValue={initialTarget ?? ''} className="input input-sm" aria-label="Link target">
            <option value="">Choose…</option>{list.map((o) => <option key={o.slug} value={o.slug}>{o.name}</option>)}
          </select>
        ) : <input type="hidden" name={`${prefix}_link_target`} value="" />}
    </div>
  );
}
