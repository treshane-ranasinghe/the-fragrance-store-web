import { notFound } from 'next/navigation';
import { BundleForm, BundleImages } from '@/components/admin/BundleForm';
import { ContentStatus, PageHeader } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin';

export const metadata = { title: 'Bundle' };

export default async function BundleEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: vs }, { data: categories }] = await Promise.all([
    supabase.from('product_variants').select('id, size_ml, price, stock_qty, products!inner(name, deleted_at)').eq('is_active', true).is('products.deleted_at', null),
    supabase.from('categories').select('id, name').order('sort_order'),
  ]);
  const variants = (vs ?? []).map((v) => ({ id: v.id, name: `${(v.products as unknown as { name: string }).name} ${v.size_ml} ml`, price: Number(v.price), stock: v.stock_qty })).sort((a, b) => a.name.localeCompare(b.name));
  if (id === 'new') {
    return <div className="max-w-5xl"><PageHeader title="New bundle" back={{ href: '/admin/bundles', label: 'Bundles' }} /><BundleForm variants={variants} categories={categories ?? []} /></div>;
  }
  const [{ data: bundle }, { data: items }, { data: images }] = await Promise.all([
    supabase.from('bundles').select('*').eq('id', id).maybeSingle(),
    supabase.from('bundle_items').select('variant_id, quantity').eq('bundle_id', id),
    supabase.from('bundle_images').select('id, storage_path, alt_text').eq('bundle_id', id).order('sort_order'),
  ]);
  if (!bundle) notFound();
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={bundle.name} back={{ href: '/admin/bundles', label: 'Bundles' }} subtitle={<ContentStatus is_active={bundle.is_active} starts_at={bundle.starts_at} ends_at={bundle.ends_at} />}
        actions={<a href={`/api/draft?redirect=/bundle/${bundle.slug}`} target="_blank" className="btn-secondary btn-sm no-underline">Preview page</a>} />
      <BundleImages bundleId={bundle.id} name={bundle.name} images={images ?? []} />
      <BundleForm bundle={bundle} items={items ?? []} variants={variants} categories={categories ?? []} />
    </div>
  );
}
