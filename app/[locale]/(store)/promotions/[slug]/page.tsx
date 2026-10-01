import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/site/PageHead';
import { ProductListing, type SearchParams } from '@/components/store/ProductListing';
import { Countdown } from '@/components/ui/Countdown';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/server';
import { getMediaByIds, getPromotion, isPreview, listLivePromotions } from '@/lib/data';
import { formatDateTime } from '@/lib/format';
import { pageMeta, truncate } from '@/lib/seo/meta';
import { cmsImage } from '@/lib/storage';
import { STORE_NAME } from '@/lib/config';

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [locale, { slug }] = await Promise.all([pageLocale(params), params]);
  const [p, t] = await Promise.all([getPromotion(slug), getTranslations({ locale, namespace: 'meta' })]);
  if (!p) return {};
  const media = p.desktop_media_id ? await getMediaByIds([p.desktop_media_id]) : {};
  return pageMeta({
    title: p.seo_title || t('promotionTitle', { name: p.name, store: STORE_NAME }),
    description: p.seo_description || truncate(p.description) || t('promotionDescription', { name: p.name }),
    path: `/promotions/${p.slug}`,
    image: p.desktop_media_id ? cmsImage(media[p.desktop_media_id]?.storage_path) : null,
    noindex: new Date(p.ends_at) < new Date(),
    locale,
  });
}

export default async function PromotionPage({ params, searchParams }: Props) {
  const locale = await pageLocale(params);
  const [{ slug }, sp, t] = await Promise.all([params, searchParams, getTranslations()]);
  const p = await getPromotion(slug);
  if (!p) notFound();
  const now = new Date();
  const ended = new Date(p.ends_at) < now;
  const scheduled = new Date(p.starts_at) > now || !p.is_active;
  if (scheduled && !(await isPreview())) notFound();
  const media = p.desktop_media_id ? await getMediaByIds([p.desktop_media_id]) : {};
  const img = p.desktop_media_id ? media[p.desktop_media_id] : null;

  return (
    <section className="section section--dark page">
      <div className="container">
        <div className="promo__card promo__card--page">
          {img ? <Image src={cmsImage(img.storage_path)!} alt={img.alt_text || p.name} fill priority sizes="100vw" className="promo__img" /> : null}
          <div className="promo__body">
            <PageHead crumbs={[{ name: t('pages.offers') }, { name: p.name }]} eyebrow={p.badge_text || t('common.limitedTime')} title={p.name} intro={p.description} />
            {!ended && !scheduled && p.show_countdown ? <p className="promo__count"><Countdown endsAt={p.ends_at} /></p> : null}
            {scheduled ? <p className="promo__count">{t('pages.previewStarts', { date: formatDateTime(p.starts_at, locale) })}</p> : null}
          </div>
        </div>
        <div style={{ marginTop: 'clamp(40px, 5vw, 72px)' }}>
          {ended ? <EndedOffer /> : scheduled
            ? <p className="products__empty">{t('pages.startsSoon')}</p>
            : <ProductListing searchParams={sp} fixed={{ promotionId: p.id }} basePath={`/promotions/${p.slug}`} />}
        </div>
      </div>
    </section>
  );
}

async function EndedOffer() {
  const [live, t] = await Promise.all([listLivePromotions(), getTranslations()]);
  return (
    <div className="products__empty">
      <h3>{t('pages.endedTitle')}</h3>
      <p>{t('pages.endedLead')} {live.length ? t('pages.currentOffers') : ''}</p>
      <p className="co__done-cta">
        {live.map((l) => <Link key={l.id} className="btn btn--ghost" href={`/promotions/${l.slug}`}>{l.name}</Link>)}
        <Link className="btn btn--gold" href="/shop">{t('common.exploreSignatures')}</Link>
      </p>
    </div>
  );
}
