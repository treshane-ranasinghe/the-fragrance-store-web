import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/site/PageHead';
import { ProductListing, type SearchParams } from '@/components/store/ProductListing';
import { pageLocale } from '@/i18n/server';
import { getBrand } from '@/lib/data';
import { pageMeta, truncate } from '@/lib/seo/meta';
import { STORE_NAME } from '@/lib/config';

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [locale, { slug }] = await Promise.all([pageLocale(params), params]);
  const [b, t] = await Promise.all([getBrand(slug), getTranslations({ locale, namespace: 'meta' })]);
  if (!b) return {};
  return pageMeta({
    title: b.seo_title || t('brandTitle', { brand: b.name, store: STORE_NAME }),
    description: b.seo_description || truncate(b.intro_text) || t('brandDescription', { brand: b.name }),
    path: `/brand/${b.slug}`,
    locale,
  });
}

export default async function BrandPage({ params, searchParams }: Props) {
  await pageLocale(params);
  const [{ slug }, sp, t] = await Promise.all([params, searchParams, getTranslations()]);
  const b = await getBrand(slug);
  if (!b) notFound();
  return (
    <section className="section section--dark page">
      <div className="container">
        <PageHead crumbs={[{ name: t('common.signatures'), href: '/shop' }, { name: b.name }]} eyebrow={t('pages.brandEyebrow')} title={b.name} intro={b.intro_text} />
        <ProductListing searchParams={sp} fixed={{ brand: b.slug }} hide={['brand']} basePath={`/brand/${b.slug}`} />
      </div>
    </section>
  );
}
