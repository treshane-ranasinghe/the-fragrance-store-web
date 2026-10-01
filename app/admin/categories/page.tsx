import { PageHeader } from '@/components/admin/ui';
import { TaxonomyManager } from '@/components/admin/TaxonomyManager';
import { requireAdmin } from '@/lib/admin';

export const metadata = { title: 'Categories' };

export default async function Page() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('categories').select('*, products(count)').order('sort_order').order('name');
  const rows = (data ?? []).map((r) => ({ ...r, image: r.image_url as string | null, products: (r.products as { count: number }[])[0]?.count ?? 0 }));
  return (
    <div className="max-w-5xl">
      <PageHeader title="Categories" />
      <TaxonomyManager table="categories" rows={rows} />
    </div>
  );
}
