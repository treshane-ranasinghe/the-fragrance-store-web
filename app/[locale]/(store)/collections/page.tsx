import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/site/PageHead';
import { Title } from '@/components/site/Title';
import { Link } from '@/i18n/navigation';
import { localeAlternates, pageLocale } from '@/i18n/server';
import { getNav, listBundles, listProducts } from '@/lib/data';
import { cmsImage } from '@/lib/storage';
import { STORE_NAME } from '@/lib/config';

export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: { absolute: t('collectionsTitle', { store: STORE_NAME }) }, description: t('collectionsDescription'), alternates: localeAlternates('/collections', locale) };
}

export default async function CollectionsPage({ params }: Props) {
  await pageLocale(params);
  const [{ categories, brands }, { products }, bundles, t] = await Promise.all([getNav(), listProducts({ perPage: 200 }), listBundles(), getTranslations()]);
  const count = (slug: string) => products.filter((p) => p.category_slug === slug).length + bundles.filter((b) => b.category_slug === slug).length;
  const perBrand = (slug: string) => products.filter((p) => p.brand_slug === slug).length;
  return (
    <>
      <section className="section section--dark page page--head">
        <div className="container">
          <PageHead crumbs={[{ name: t('common.collections') }]} eyebrow={t('pages.collectionsEyebrow')} title={t('pages.collectionsTitle')}
            intro={t('pages.collectionsIntro')} />
        </div>
      </section>
      <section className="section">
        <div className="container">
          <div className="collections collections--all">
            {categories.map((c, i) => (
              <Link key={c.id} href={`/category/${c.slug}`} className={`collection reveal${i % 3 === 1 ? ' collection--tall' : ''}`}>
                <div className="collection__media">{c.image_url ? <Image src={cmsImage(c.image_url)!} alt={c.name} fill sizes="(max-width: 860px) 78vw, 33vw" /> : null}</div>
                <div className="collection__body">
                  <span className="collection__num">{String(i + 1).padStart(2, '0')} · {t('pages.scents', { count: count(c.slug) })}</span>
                  <h3>{c.name}</h3>
                  {c.subtitle ? <p>{c.subtitle}</p> : null}
                  <span className="link-arrow">{t('common.explore')}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--dark">
        <div className="container">
          <header className="section__head reveal"><p className="eyebrow">{t('pages.housesEyebrow')}</p><h2 className="section__title"><Title text={t('pages.housesTitle')} /></h2></header>
          <ul className="houses">
            {brands.map((b) => (
              <li key={b.id} className="reveal">
                <Link href={`/brand/${b.slug}`} className="house">
                  <span className="house__name">{b.name}</span>
                  <span className="house__count">{t('common.fragrances', { count: perBrand(b.slug) })}</span>
                  <span className="link-arrow">{t('common.view')}</span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="products__note reveal"><Link href="/shop">{t('pages.seeEvery')}</Link></p>
        </div>
      </section>
    </>
  );
}
