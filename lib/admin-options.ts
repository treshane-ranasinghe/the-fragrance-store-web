import 'server-only';
import type { createClient } from '@/lib/supabase/server';
import type { LinkOptions } from '@/components/admin/LinkPicker';

export async function getLinkOptions(supabase: Awaited<ReturnType<typeof createClient>>): Promise<LinkOptions> {
  const [promotion, bundle, product, category, brand] = await Promise.all([
    supabase.from('promotions').select('slug, name').order('starts_at', { ascending: false }),
    supabase.from('bundles').select('slug, name').order('name'),
    supabase.from('products').select('slug, name').is('deleted_at', null).order('name'),
    supabase.from('categories').select('slug, name').order('sort_order'),
    supabase.from('brands').select('slug, name').order('name'),
  ]);
  return { promotion: promotion.data ?? [], bundle: bundle.data ?? [], product: product.data ?? [], category: category.data ?? [], brand: brand.data ?? [] };
}
