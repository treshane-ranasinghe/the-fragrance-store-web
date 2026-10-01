import { PageHeader } from '@/components/admin/ui';
import { TaxonomyManager } from '@/components/admin/TaxonomyManager';
import { requireAdmin } from '@/lib/admin';

export const metadata = { title: 'Brands' };

export default async function Page() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('brands').select('*, products(count)').order('sort_order').order('name');
  const rows = (data ?? []).map((r) => ({ ...r, image: r.logo_url as string | null, products: (r.products as { count: number }[])[0]?.count ?? 0 }));
  return (
    <div className="max-w-5xl">
      <PageHeader title="Brands" />
      <TaxonomyManager table="brands" rows={rows} />
    </div>
  );
}
