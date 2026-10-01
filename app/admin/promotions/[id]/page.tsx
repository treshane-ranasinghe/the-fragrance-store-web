import { notFound } from 'next/navigation';
import type { Media } from '@/components/admin/MediaPicker';
import { PromotionForm } from '@/components/admin/PromotionForm';
import { ContentStatus, PageHeader } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin';
import { getPromotionOptions } from '@/lib/admin-promo';

export const metadata = { title: 'Promotion' };

export default async function PromotionEditPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const options = await getPromotionOptions(supabase);
  if (id === 'new') {
    return <div className="max-w-5xl"><PageHeader title="New promotion" back={{ href: '/admin/promotions', label: 'Promotions' }} /><PromotionForm options={options} /></div>;
  }
  const [{ data: promo }, { data: targets }] = await Promise.all([
    supabase.from('promotions').select('*').eq('id', id).maybeSingle(),
    supabase.from('promotion_targets').select('*').eq('promotion_id', id),
  ]);
  if (!promo) notFound();
  const ids = [promo.desktop_media_id, promo.mobile_media_id].filter(Boolean);
  const { data: media } = ids.length ? await supabase.from('media_assets').select('*').in('id', ids) : { data: [] };
  const m = (x: string | null) => ((media ?? []).find((y) => y.id === x) ?? null) as Media | null;
  return (
    <div className="max-w-5xl">
      <PageHeader title={promo.name} back={{ href: '/admin/promotions', label: 'Promotions' }}
        subtitle={<ContentStatus is_active={promo.is_active} starts_at={promo.starts_at} ends_at={promo.ends_at} draftLabel="Draft" />}
        actions={<a href={`/api/draft?redirect=/promotions/${promo.slug}`} target="_blank" className="btn-secondary btn-sm no-underline">Preview page</a>} />
      <PromotionForm promo={promo} targets={targets ?? []} options={options} desktop={m(promo.desktop_media_id)} mobile={m(promo.mobile_media_id)} />
    </div>
  );
}
