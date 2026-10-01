import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BundleBuy } from '@/components/site/BundleBuy';
import { PageHead } from '@/components/site/PageHead';
import { PdGallery } from '@/components/site/ProductBuy';
import { money } from '@/components/site/money';
import { Link } from '@/i18n/navigation';
import { localePath } from '@/i18n/routing';
import { pageLocale } from '@/i18n/server';
import { getBundle } from '@/lib/data';
import { RichText } from '@/lib/markdown';
import { JsonLd } from '@/lib/seo/jsonld';
import { pageMeta, truncate } from '@/lib/seo/meta';
import { productImage } from '@/lib/storage';
import { SITE_URL, STORE_NAME } from '@/lib/config';

export const revalidate = 300;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [locale, { slug }] = await Promise.all([pageLocale(params), params]);
  const [data, t] = await Promise.all([getBundle(slug), getTranslations({ locale, namespace: 'meta' })]);
  if (!data) return {};
  const b = data.bundle;
  const values = { name: b.name, price: money(b.effective_price), save: money(b.you_save), description: b.description ?? '' };
  return pageMeta({
    title: b.seo_title || t('bundleTitle', { name: b.name, store: STORE_NAME }),
    description: b.seo_description || truncate(b.you_save > 0 ? t('bundleDescriptionSave', values) : t('bundleDescription', values)),
    path: `/bundle/${b.slug}`,
    image: productImage(data.images[0]?.storage_path ?? b.image_path ?? b.item_images?.[0]),
    locale,
  });
}

export default async function BundlePage({ params }: Props) {
  const locale = await pageLocale(params);
  const [data, t] = await Promise.all([getBundle((await params).slug), getTranslations()]);
  if (!data) notFound();
  const { bundle: b, images, items } = data;
  const gallery = images.length ? images.map((i, k) => ({ id: String(k), ...i })) : items.filter((i) => i.image_path).map((i, k) => ({ id: `i${k}`, storage_path: i.image_path!, alt_text: i.name }));
  return (
    <section className="section section--dark page">
      <JsonLd data={{
        '@context': 'https://schema.org', '@type': 'Product', name: b.name, description: b.description ?? undefined,
        image: gallery.map((i) => productImage(i.storage_path)).filter(Boolean),
        offers: { '@type': 'Offer', price: Number(b.effective_price).toFixed(2), priceCurrency: 'LKR', url: `${SITE_URL}${localePath(`/bundle/${b.slug}`, locale)}`,
          availability: b.available > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', ...(b.ends_at ? { priceValidUntil: b.ends_at.slice(0, 10) } : {}) },
      }} />
      <div className="container">
        <PageHead crumbs={[{ name: t('common.giftSets'), href: '/bundles' }, { name: b.name }]} title="" />
        <div className="pd">
          <PdGallery images={gallery} name={b.name} />
          <div className="pd__body">
            <p className="eyebrow">{t('common.giftSet')}</p>
            <h1 className="pd__title">{b.name}</h1>
            {b.you_save > 0 ? <p className="modal__meta" style={{ color: 'var(--gold-light)' }}>{t('product.youSave', { save: money(b.you_save), value: money(b.items_value) })}</p> : null}
            {b.description ? <div className="modal__desc"><RichText text={b.description} /></div> : null}
            <dl className="modal__notes">
              {items.map((i) => (
                <div key={i.slug + i.size_ml}>
                  <dt>{i.quantity} ×</dt>
                  <dd className="pd__item">
                    <span className="bag__img ph-bottle pd__itemimg">{productImage(i.image_path) ? <Image src={productImage(i.image_path)!} alt="" fill sizes="44px" /> : null}</span>
                    <span><Link href={`/product/${i.slug}`}>{i.brand ? `${i.brand} ` : ''}{i.name}</Link><small>{t('common.ml', { size: i.size_ml })}{i.price != null ? ` · ${money(i.price)}` : ''}</small></span>
                  </dd>
                </div>
              ))}
            </dl>
            <p className="modal__price">{money(b.effective_price)}{b.effective_price < b.price ? <s className="pd__was">{money(b.price)}</s> : null}</p>
            {b.available > 0 && b.available <= 3 ? <p className="pd__stock">{t('product.onlySetsLeft', { count: b.available })}</p> : null}
            <BundleBuy bundleId={b.id} available={b.available} maxPerOrder={b.max_per_order} />
            <ul className="co__assure"><li>{t('product.giftWrapped')}</li><li>{t('common.authentic')}</li></ul>
          </div>
        </div>
      </div>
    </section>
  );
}
