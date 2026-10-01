'use server';
import { z } from 'zod';
import { redirect } from 'next/navigation';
import { refreshStore, requireAdmin } from '@/lib/admin';
import { slugify } from '@/lib/format';
import { bool, fail, optStr, str, type AdminState } from './result';

const variantSchema = z.object({
  id: z.string().uuid().optional().or(z.literal('')).transform((v) => v || undefined),
  size_ml: z.coerce.number().int().positive('Size must be a positive number of ml'),
  sku: z.string().trim().min(1, 'Every variant needs a SKU'),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  compare_at_price: z.union([z.literal(''), z.null(), z.coerce.number().min(0)]).transform((v) => (v === '' || v == null ? null : Number(v))),
  stock_qty: z.coerce.number().int().min(0, 'Stock cannot be negative'),
  is_active: z.boolean().default(true),
});

const notes = (s: string) => s.split(',').map((x) => x.trim()).filter(Boolean);

export async function saveProductAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase, user } = await requireAdmin();
  const id = str(fd, 'id');
  const name = str(fd, 'name');
  if (!name) return { error: 'Enter the product name' };
  let variants: z.infer<typeof variantSchema>[];
  try {
    const parsed = z.array(variantSchema).min(1, 'Add at least one size').safeParse(JSON.parse(str(fd, 'variants') || '[]'));
    if (!parsed.success) return { error: parsed.error.issues[0].message };
    variants = parsed.data;
  } catch { return { error: 'Invalid variants' }; }

  const row = {
    name,
    slug: slugify(str(fd, 'slug') || name),
    brand_id: optStr(fd, 'brand_id'),
    category_id: optStr(fd, 'category_id'),
    gender: str(fd, 'gender') || 'unisex',
    concentration: str(fd, 'concentration') || 'EDP',
    description: optStr(fd, 'description'),
    top_notes: notes(str(fd, 'top_notes')),
    middle_notes: notes(str(fd, 'middle_notes')),
    base_notes: notes(str(fd, 'base_notes')),
    is_featured: bool(fd, 'is_featured'),
    is_active: bool(fd, 'is_active'),
    badge: optStr(fd, 'badge'),
    seo_title: optStr(fd, 'seo_title'),
    seo_description: optStr(fd, 'seo_description'),
  };

  let productId = id;
  let oldSlug: string | null = null;
  if (id) {
    const { data: old } = await supabase.from('products').select('slug').eq('id', id).single();
    oldSlug = old?.slug ?? null;
    const { error } = await supabase.from('products').update(row).eq('id', id);
    if (error) return fail(error);
  } else {
    const { data, error } = await supabase.from('products').insert({ ...row, created_by: user.id }).select('id').single();
    if (error) return fail(error);
    productId = data.id;
  }

  // Variants: update existing, insert new, deactivate / delete removed
  const { data: existing } = await supabase.from('product_variants').select('id').eq('product_id', productId);
  const keep = new Set(variants.filter((v) => v.id).map((v) => v.id));
  for (const ex of existing ?? []) {
    if (!keep.has(ex.id)) {
      const { error } = await supabase.from('product_variants').delete().eq('id', ex.id);
      // Used in past orders / bundles → hide instead of delete
      if (error) await supabase.from('product_variants').update({ is_active: false }).eq('id', ex.id);
    }
  }
  for (const v of variants) {
    const { id: vid, ...vr } = v;
    const { error } = vid
      ? await supabase.from('product_variants').update(vr).eq('id', vid)
      : await supabase.from('product_variants').insert({ ...vr, product_id: productId });
    if (error) return fail(error);
  }

  refreshStore(['catalog', 'bundles'], [`/product/${row.slug}`, ...(oldSlug && oldSlug !== row.slug ? [`/product/${oldSlug}`] : []), '/shop', '/']);
  return { ok: 'Product saved.', id: productId };
}

export async function deleteProductAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'id');
  const { data: p } = await supabase.from('products').select('slug').eq('id', id).single();
  const { count } = await supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id);
  if ((count ?? 0) > 0) {
    // Has past orders → soft delete (hidden from store, kept for history)
    await supabase.from('products').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id);
  } else {
    const { data: imgs } = await supabase.from('product_images').select('storage_path').eq('product_id', id);
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) await supabase.from('products').update({ deleted_at: new Date().toISOString(), is_active: false }).eq('id', id);
    else if (imgs?.length) await supabase.storage.from('product-images').remove(imgs.map((i) => i.storage_path));
  }
  refreshStore(['catalog', 'bundles'], [`/product/${p?.slug}`, '/shop', '/']);
  redirect('/admin/products');
}

export async function bulkProductsAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  const ids = fd.getAll('ids').map(String).filter(Boolean);
  const op = str(fd, 'op');
  if (!ids.length) return;
  const patch = op === 'hide' ? { is_active: false } : op === 'show' ? { is_active: true } : op === 'feature' ? { is_featured: true } : op === 'unfeature' ? { is_featured: false } : null;
  if (patch) await supabase.from('products').update(patch).in('id', ids);
  refreshStore(['catalog', 'bundles'], ['/shop', '/']);
}

export async function addProductImagesAction(productId: string, images: { storage_path: string; alt_text: string }[]) {
  const { supabase } = await requireAdmin();
  const { data: last } = await supabase.from('product_images').select('sort_order').eq('product_id', productId).order('sort_order', { ascending: false }).limit(1);
  let n = (last?.[0]?.sort_order ?? -1) + 1;
  const { error } = await supabase.from('product_images').insert(images.map((i) => ({ ...i, product_id: productId, sort_order: n++ })));
  if (error) return fail(error);
  refreshStore(['catalog']);
  return { ok: 'Images added' };
}

export async function updateProductImagesAction(productId: string, images: { id: string; alt_text: string }[], removed: string[]) {
  const { supabase } = await requireAdmin();
  for (const [i, img] of images.entries()) await supabase.from('product_images').update({ alt_text: img.alt_text, sort_order: i }).eq('id', img.id).eq('product_id', productId);
  if (removed.length) {
    const { data } = await supabase.from('product_images').select('storage_path').in('id', removed);
    await supabase.from('product_images').delete().in('id', removed);
    if (data?.length) await supabase.storage.from('product-images').remove(data.map((d) => d.storage_path));
  }
  refreshStore(['catalog']);
  return { ok: 'Images saved' };
}

// ---------------------------------------------------------------------------
// Categories & brands
// ---------------------------------------------------------------------------
export async function saveTaxonomyAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const table = str(fd, 'table') === 'brands' ? 'brands' : 'categories';
  const id = str(fd, 'id');
  const name = str(fd, 'name');
  if (!name) return { error: 'Enter a name' };
  const row: Record<string, unknown> = {
    name, slug: slugify(str(fd, 'slug') || name), sort_order: Number(str(fd, 'sort_order') || 0), is_active: bool(fd, 'is_active'),
    intro_text: optStr(fd, 'intro_text'), seo_title: optStr(fd, 'seo_title'), seo_description: optStr(fd, 'seo_description'),
  };
  if (table === 'categories') row.subtitle = optStr(fd, 'subtitle');
  const img = optStr(fd, 'image');
  row[table === 'brands' ? 'logo_url' : 'image_url'] = img;
  const { error } = id ? await supabase.from(table).update(row).eq('id', id) : await supabase.from(table).insert(row);
  if (error) return fail(error);
  refreshStore(['catalog', 'cms'], [`/${table === 'brands' ? 'brand' : 'category'}/${row.slug}`, '/', '/shop']);
  return { ok: 'Saved.' };
}

export async function deleteTaxonomyAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  const table = str(fd, 'table') === 'brands' ? 'brands' : 'categories';
  const { error } = await supabase.from(table).delete().eq('id', str(fd, 'id'));
  // In use by products → hide it instead
  if (error) await supabase.from(table).update({ is_active: false }).eq('id', str(fd, 'id'));
  refreshStore(['catalog', 'cms'], ['/', '/shop']);
}
