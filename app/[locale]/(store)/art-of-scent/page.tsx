import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/site/PageHead';
import { HomeSectionView } from '@/components/site/Sections';
import { waLink } from '@/components/site/wa';
import { Title } from '@/components/site/Title';
import { Link } from '@/i18n/navigation';
import { localeAlternates, pageLocale } from '@/i18n/server';
import { getPageSections } from '@/lib/page-sections';
import { getSiteInfo } from '@/lib/site';
import { STORE_NAME } from '@/lib/config';

export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: { absolute: t('artTitle', { store: STORE_NAME }) }, description: t('artDescription'), alternates: localeAlternates('/art-of-scent', locale) };
}

/** [message prefix, perfume oil %, filter value] */
const CONC = [['parfum', '20 – 30%', 'Parfum'], ['edp', '15 – 20%', 'EDP'], ['edt', '5 – 15%', 'EDT'], ['mist', '2 – 5%', 'Body Mist']] as const;

export default async function ArtOfScentPage({ params }: Props) {
  await pageLocale(params);
  const [{ sections, media }, site, t] = await Promise.all([getPageSections(['notes', 'marquee']), getSiteInfo(), getTranslations()]);
  return (
    <>
      <section className="section section--dark page page--head">
        <div className="container"><PageHead crumbs={[{ name: t('common.artOfScent') }]} eyebrow={t('pages.artEyebrow')} title={t('pages.artTitle')}
          intro={t('pages.artIntro')} /></div>
      </section>
      {sections.map((s) => <HomeSectionView key={s.id} s={s} media={media} site={site} />)}
      <section className="section">
        <div className="container">
          <header className="section__head reveal"><p className="eyebrow">{t('pages.concEyebrow')}</p><h2 className="section__title"><Title text={t('pages.concTitle')} /></h2></header>
          <div className="conc">
            {CONC.map(([k, oil, filter]) => (
              <article key={k} className="conc__item reveal">
                <h3>{t(`pages.${k}Name`)}</h3>
                <dl><div><dt>{t('pages.oil')}</dt><dd>{oil}</dd></div><div><dt>{t('pages.lasts')}</dt><dd>{t(`pages.${k}Lasts`)}</dd></div></dl>
                <p>{t(`pages.${k}Text`)}</p>
                <Link href={`/shop?concentration=${encodeURIComponent(filter)}`} className="link-arrow">{t('pages.shopConc', { name: k === 'parfum' ? t('pages.parfumShort') : t(`pages.${k}Name`) })}</Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="section section--dark">
        <div className="container cta-band reveal">
          <p className="eyebrow">{t('pages.artCtaEyebrow')}</p>
          <h2 className="section__title"><Title text={t('pages.artCtaTitle')} /></h2>
          <p className="co__done-cta"><a href={waLink(site.whatsapp, t('wa.consultation'))} className="btn btn--gold" target="_blank" rel="noopener noreferrer">{t('pages.artCtaMessage')}</a><Link href="/collections" className="btn btn--ghost">{t('pages.artCtaBrowse')}</Link></p>
        </div>
      </section>
    </>
  );
}
