import { notFound } from 'next/navigation';
import { PageHeader } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/ProductForm';
import { ProductImages } from '@/components/admin/ProductImages';
import { requireAdmin } from '@/lib/admin';
import { deleteProductAction } from '@/lib/actions/admin/catalog';

export const metadata = { title: 'Edit product' };

export default async function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const [{ data: product }, { data: variants }, { data: images }, { data: brands }, { data: categories }, { data: awaiting }, { count: orderCount }] = await Promise.all([
    supabase.from('products').select('*').eq('id', id).maybeSingle(),
    supabase.from('product_variants').select('*').eq('product_id', id).order('size_ml'),
    supabase.from('product_images').select('id, storage_path, alt_text').eq('product_id', id).order('sort_order'),
    supabase.from('brands').select('id, name').order('name'),
    supabase.from('categories').select('id, name').order('sort_order'),
    supabase.from('admin_variant_awaiting').select('*'),
    supabase.from('order_items').select('id', { count: 'exact', head: true }).eq('product_id', id),
  ]);
  if (!product) notFound();
  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title={product.name} back={{ href: '/admin/products', label: 'Products' }}
        subtitle={product.deleted_at ? 'Deleted (hidden from the store, kept for order history)' : product.is_active ? 'Active' : 'Hidden'}
        actions={<a href={`/product/${product.slug}`} target="_blank" className="btn-secondary btn-sm no-underline">View in store</a>} />
      <ProductImages productId={product.id} productName={product.name} images={images ?? []} />
      <ProductForm product={product} variants={variants ?? []} brands={brands ?? []} categories={categories ?? []}
        awaiting={Object.fromEntries((awaiting ?? []).map((a) => [a.variant_id, a.awaiting_qty]))} />
      <form action={deleteProductAction} className="card border-state-error/30 p-5">
        <input type="hidden" name="id" value={product.id} />
        <p className="mb-3 text-sm">{(orderCount ?? 0) > 0
          ? `This product appears in ${orderCount} order line(s), so it will be hidden (soft delete) and kept for history.`
          : 'This product has no orders and will be permanently deleted with its images.'}</p>
        <button className="btn-danger btn-sm">Delete product</button>
      </form>
    </div>
  );
}
