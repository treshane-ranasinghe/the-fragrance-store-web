import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/site/PageHead';
import { BundleCard } from '@/components/site/ProductCard';
import { localeAlternates, pageLocale } from '@/i18n/server';
import { listBundles } from '@/lib/data';
import { STORE_NAME } from '@/lib/config';

export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: { absolute: t('bundlesTitle', { store: STORE_NAME }) }, description: t('bundlesDescription'), alternates: localeAlternates('/bundles', locale) };
}

export default async function BundlesPage({ params }: Props) {
  await pageLocale(params);
  const [bundles, t] = await Promise.all([listBundles(), getTranslations()]);
  return (
    <section className="section section--dark page">
      <div className="container">
        <PageHead crumbs={[{ name: t('common.giftSets') }]} eyebrow={t('common.giftSets')} title={t('pages.bundlesTitle')} intro={t('pages.bundlesIntro')} />
        <div className="products">
          {bundles.map((b) => <BundleCard key={b.id} b={b} />)}
          {!bundles.length ? <div className="products__empty"><h3>{t('pages.bundlesEmpty')}</h3><p>{t('pages.bundlesEmptyLead')}</p></div> : null}
        </div>
      </div>
    </section>
  );
}
