import { PageHeader } from '@/components/admin/ui';
import { ProductForm } from '@/components/admin/ProductForm';
import { requireAdmin } from '@/lib/admin';

export const metadata = { title: 'New product' };

export default async function NewProductPage() {
  const { supabase } = await requireAdmin();
  const [{ data: brands }, { data: categories }] = await Promise.all([
    supabase.from('brands').select('id, name').order('name'), supabase.from('categories').select('id, name').order('sort_order'),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="New product" back={{ href: '/admin/products', label: 'Products' }} subtitle="Fill in the details, then add photos on the next step." />
      <section className="card mb-6 p-5">
        <h2 className="mb-2 font-serif text-xl font-semibold text-brand-green">Photos</h2>
        <div className="flex flex-col items-center justify-center rounded-card border-2 border-dashed border-brand-beige p-6 text-center text-sm text-brand-muted">
          <p className="font-medium text-brand-ink">Step 2 — photos are added right after you create the product</p>
          <p className="mt-1">Fill in the details below and click <b>Create product &amp; add photos</b>. You&rsquo;ll go straight to the product page, where this box becomes the photo uploader (drag and drop, several at once).</p>
          <p className="mt-2 text-xs">Best 1600 × 2000 px (4:5 portrait), min 1000 × 1250 px · JPG/PNG/WebP, max 5 MB</p>
        </div>
      </section>
      <ProductForm brands={brands ?? []} categories={categories ?? []} />
    </div>
  );
}
