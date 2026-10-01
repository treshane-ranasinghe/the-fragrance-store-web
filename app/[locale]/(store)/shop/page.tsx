import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/site/PageHead';
import { ProductListing, type SearchParams } from '@/components/store/ProductListing';
import { localeAlternates, pageLocale } from '@/i18n/server';
import { STORE_NAME } from '@/lib/config';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const [locale, sp] = await Promise.all([pageLocale(params), searchParams]);
  const t = await getTranslations({ locale, namespace: 'meta' });
  const q = typeof sp.q === 'string' ? sp.q : '';
  return {
    title: { absolute: q ? t('searchTitle', { q, store: STORE_NAME }) : t('shopTitle', { store: STORE_NAME }) },
    description: t('shopDescription'),
    // Filtered / sorted pages point back to the main listing
    alternates: localeAlternates('/shop', locale),
    robots: q ? { index: false, follow: true } : undefined,
  };
}

export default async function ShopPage({ params, searchParams }: Props) {
  await pageLocale(params);
  const [sp, t] = await Promise.all([searchParams, getTranslations()]);
  return (
    <section className="section section--dark page">
      <div className="container">
        <PageHead crumbs={[{ name: t('common.signatures') }]} eyebrow={t('pages.shopEyebrow')} title={t('pages.shopTitle')}
          intro={t('pages.shopIntro')} />
        <ProductListing searchParams={sp} basePath="/shop" />
      </div>
    </section>
  );
}
