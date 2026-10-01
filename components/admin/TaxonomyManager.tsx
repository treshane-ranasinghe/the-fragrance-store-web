'use client';
import { useState } from 'react';
import { deleteTaxonomyAction, saveTaxonomyAction } from '@/lib/actions/admin/catalog';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { slugify } from '@/lib/format';
import { ActionForm } from './ActionForm';
import { MediaPicker, type Media } from './MediaPicker';

interface Row { id: string; name: string; slug: string; subtitle?: string | null; sort_order: number; is_active: boolean; intro_text: string | null; seo_title: string | null; seo_description: string | null; image: string | null; products: number }

export function TaxonomyManager({ table, rows }: { table: 'categories' | 'brands'; rows: Row[] }) {
  const [editing, setEditing] = useState<string | null>(null);
  const noun = table === 'brands' ? 'brand' : 'category';
  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th>Name</th><th>Slug</th><th className="text-right">Order</th><th className="text-right">Products</th><th>Status</th><th /></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="font-medium">{r.name}</td><td className="text-brand-muted">/{table === 'brands' ? 'brand' : 'category'}/{r.slug}</td>
                <td className="text-right">{r.sort_order}</td><td className="text-right">{r.products}</td>
                <td>{r.is_active ? <span className="text-state-success">Active</span> : <span className="text-brand-muted">Hidden</span>}</td>
                <td className="whitespace-nowrap text-right">
                  <button type="button" className="text-sm underline" onClick={() => setEditing(editing === r.id ? null : r.id)}>{editing === r.id ? 'Close' : 'Edit'}</button>
                  <form action={deleteTaxonomyAction} className="ml-3 inline" onSubmit={(e) => { if (!confirm(`Delete ${r.name}? If products use it, it will be hidden instead.`)) e.preventDefault(); }}>
                    <input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={r.id} />
                    <button className="text-sm text-state-error underline">Delete</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing ? <Editor key={editing} table={table} row={rows.find((r) => r.id === editing)!} onDone={() => setEditing(null)} /> : null}
      <details className="card p-5"><summary className="cursor-pointer font-medium text-brand-green">+ Add {noun}</summary><div className="mt-4"><Editor table={table} /></div></details>
    </div>
  );
}

function Editor({ table, row, onDone }: { table: 'categories' | 'brands'; row?: Row; onDone?: () => void }) {
  const [name, setName] = useState(row?.name ?? '');
  const [slug, setSlug] = useState(row?.slug ?? '');
  const initialImg: Media | null = row?.image ? { id: '', storage_path: row.image, file_name: '', alt_text: row.name, width: null, height: null } : null;
  return (
    <ActionForm action={saveTaxonomyAction} className="card grid gap-4 p-5 md:grid-cols-2" resetOnSuccess={!row} onSuccess={onDone}>
      <input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={row?.id ?? ''} />
      <label><span className="label">Name</span><input name="name" required className="input" value={name} onChange={(e) => { setName(e.target.value); if (!row) setSlug(slugify(e.target.value)); }} /></label>
      <label><span className="label">Slug</span><input name="slug" required className="input" value={slug} onChange={(e) => setSlug(e.target.value)} /></label>
      <label><span className="label">Display order</span><input name="sort_order" type="number" className="input" defaultValue={row?.sort_order ?? 0} /></label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="is_active" defaultChecked={row?.is_active ?? true} className="h-4 w-4 accent-brand-green" />Active</label>
      {table === 'categories' ? <label className="md:col-span-2"><span className="label">Line under the title (collection cards)</span><input name="subtitle" className="input" defaultValue={row?.subtitle ?? ''} placeholder="Woods, leather & spice" /></label> : null}
      <div className="md:col-span-2"><MediaPicker name="image" valueKind="path" initial={initialImg} label={table === 'brands' ? 'Logo' : 'Image (used on category tiles)'} slot={table === 'brands' ? 'brand_logo' : 'category'} /></div>
      <label className="md:col-span-2"><span className="label">Intro paragraph (shown on the page, good for Google)</span><textarea name="intro_text" rows={3} className="input" defaultValue={row?.intro_text ?? ''} /></label>
      <label><span className="label">SEO title</span><input name="seo_title" className="input" defaultValue={row?.seo_title ?? ''} /></label>
      <label><span className="label">SEO description</span><input name="seo_description" className="input" defaultValue={row?.seo_description ?? ''} /></label>
      <div className="md:col-span-2"><SubmitButton className="btn-primary btn-sm">Save</SubmitButton></div>
    </ActionForm>
  );
}
