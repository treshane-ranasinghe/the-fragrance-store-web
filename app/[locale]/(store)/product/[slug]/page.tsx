import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/site/PageHead';
import { BundleCard, ProductCard } from '@/components/site/ProductCard';
import { PdGallery, ProductBuy } from '@/components/site/ProductBuy';
import { Title } from '@/components/site/Title';
import { concentrationLabel } from '@/components/site/labels';
import { money } from '@/components/site/money';
import { Link, permanentRedirect } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/server';
import { getProduct } from '@/lib/data';
import { JsonLd, productJsonLd } from '@/lib/seo/jsonld';
import { pageMeta, truncate } from '@/lib/seo/meta';
import { productImage } from '@/lib/storage';
import { STORE_NAME } from '@/lib/config';

export const revalidate = 300;
export const generateStaticParams = async () => [];

type Props = { params: Promise<{ locale: string; slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [locale, { slug }] = await Promise.all([pageLocale(params), params]);
  const [data, t] = await Promise.all([getProduct(slug), getTranslations({ locale })]);
  if (!data.product) return {};
  const p = data.product;
  const size = data.variants?.[data.variants.length - 1]?.size_ml;
  const name = `${p.brand_name ? p.brand_name + ' ' : ''}${p.name}${size ? ` ${size}ml` : ''}`;
  const title = p.seo_title || t('meta.productTitle', { name, store: STORE_NAME });
  const description = p.seo_description || truncate(t('meta.productDescription', {
    name: `${p.brand_name ?? ''} ${p.name}`.trim(), concentration: concentrationLabel(p.concentration, t), price: money(p.min_price), description: p.description ?? '',
  }));
  return pageMeta({ title, description, path: `/product/${p.slug}`, image: productImage(data.images?.[0]?.storage_path), locale });
}

export default async function ProductPage({ params }: Props) {
  const locale = await pageLocale(params);
  const { slug } = await params;
  const [data, t] = await Promise.all([getProduct(slug), getTranslations()]);
  if (!data.product) {
    // Slug changed → 301 to the new URL; hidden / deleted → 404
    if (data.redirectTo) permanentRedirect({ href: `/product/${data.redirectTo}`, locale });
    notFound();
  }
  const { product: p, variants, images, related, bundles } = data;

  return (
    <>
      <JsonLd data={productJsonLd(p, variants, images, locale)} />
      <section className="section section--dark page">
        <div className="container">
          <PageHead crumbs={[{ name: t('common.signatures'), href: '/shop' }, ...(p.category_slug ? [{ name: p.category_name!, href: `/category/${p.category_slug}` }] : []), { name: p.name }]} title="" />
          <div className="pd">
            <PdGallery images={images.length ? images : p.image_path ? [{ id: 'main', storage_path: p.image_path, alt_text: p.image_alt }] : []} name={`${p.brand_name ?? ''} ${p.name}`} />
            <div className="pd__body">
              {p.brand_slug ? <Link href={`/brand/${p.brand_slug}`} className="eyebrow">{p.brand_name}</Link> : null}
              <h1 className="pd__title">{p.name}</h1>
              <p className="modal__meta">{concentrationLabel(p.concentration, t)} · {t(`gender.${p.gender}`)}{p.badge ? ` · ${p.badge}` : ''}</p>
              {p.description ? <p className="modal__desc">{p.description}</p> : null}
              <dl className="modal__notes">
                {([[t('common.notesTop'), p.top_notes], [t('common.notesHeart'), p.middle_notes], [t('common.notesBase'), p.base_notes]] as const).filter(([, n]) => n?.length).map(([k, n]) => (
                  <div key={k}><dt>{k}</dt><dd>{n.join(', ')}</dd></div>
                ))}
              </dl>
              <ProductBuy variants={variants} name={`${p.brand_name ?? ''} ${p.name}`} />
              <ul className="co__assure">
                <li>{t('common.authentic')}</li>
                <li>{t('product.islandWide')}</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {bundles.length ? (
        <section className="section section--dark section--flush">
          <div className="container">
            <header className="section__head reveal"><p className="eyebrow">{t('product.giftSetsEyebrow')}</p><h2 className="section__title"><Title text={t('product.alsoInSets')} /></h2></header>
            <div className="products">{bundles.map((b) => <BundleCard key={b.id} b={b} />)}</div>
          </div>
        </section>
      ) : null}

      {related.length ? (
        <section className="section section--dark section--flush">
          <div className="container">
            <header className="section__head reveal"><p className="eyebrow">{t('product.youMayLike')}</p><h2 className="section__title"><Title text={p.category_name ? t('product.moreFrom', { name: p.category_name }) : t('product.moreFromHouse')} /></h2></header>
            <div className="products">{related.map((r) => <ProductCard key={r.id} p={r} />)}</div>
          </div>
        </section>
      ) : null}
    </>
  );
}
