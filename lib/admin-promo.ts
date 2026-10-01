import 'server-only';
import type { createClient } from '@/lib/supabase/server';

export async function getPromotionOptions(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [categories, brands, products, variants] = await Promise.all([
    supabase.from('categories').select('id, name').order('sort_order'),
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('products').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('product_variants').select('id, size_ml, sku, price, products!inner(name, deleted_at)').is('products.deleted_at', null).order('sku'),
  ]);
  return {
    categories: categories.data ?? [], brands: brands.data ?? [], products: products.data ?? [],
    variants: (variants.data ?? []).map((v) => ({ id: v.id, name: `${(v.products as unknown as { name: string }).name} ${v.size_ml} ml (${v.sku})`, price: Number(v.price) })),
  };
}
