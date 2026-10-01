import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/site/PageHead';
import { ProductListing, type SearchParams } from '@/components/store/ProductListing';
import { pageLocale } from '@/i18n/server';
import { getCategory, listBundles } from '@/lib/data';
import { pageMeta, truncate } from '@/lib/seo/meta';
import { STORE_NAME } from '@/lib/config';

type Props = { params: Promise<{ locale: string; slug: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const [locale, { slug }] = await Promise.all([pageLocale(params), params]);
  const [c, t] = await Promise.all([getCategory(slug), getTranslations({ locale, namespace: 'meta' })]);
  if (!c) return {};
  return pageMeta({
    title: c.seo_title || t('categoryTitle', { category: c.name, store: STORE_NAME }),
    description: c.seo_description || truncate(c.intro_text) || t('categoryDescription', { category: c.name.toLowerCase(), store: STORE_NAME }),
    path: `/category/${c.slug}`,
    locale,
  });
}

export default async function CategoryPage({ params, searchParams }: Props) {
  await pageLocale(params);
  const [{ slug }, sp, t] = await Promise.all([params, searchParams, getTranslations()]);
  const c = await getCategory(slug);
  if (!c) notFound();
  const bundles = await listBundles({ categoryId: c.id });
  return (
    <section className="section section--dark page">
      <div className="container">
        <PageHead crumbs={[{ name: t('common.signatures'), href: '/shop' }, { name: c.name }]} eyebrow={t('pages.categoryEyebrow')} title={c.name} intro={c.intro_text} />
        <ProductListing searchParams={sp} fixed={{ category: c.slug }} hide={['category']} bundles={bundles} basePath={`/category/${c.slug}`} />
      </div>
    </section>
  );
}
