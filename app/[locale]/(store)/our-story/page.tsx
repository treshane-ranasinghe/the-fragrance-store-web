import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PageHead } from '@/components/site/PageHead';
import { HomeSectionView } from '@/components/site/Sections';
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
  return { title: { absolute: t('ourStoryTitle', { store: STORE_NAME }) }, description: t('ourStoryDescription'), alternates: localeAlternates('/our-story', locale) };
}

export default async function OurStoryPage({ params }: Props) {
  await pageLocale(params);
  const [{ sections, media }, site, t] = await Promise.all([getPageSections(['story', 'marquee', 'testimonials', 'gallery']), getSiteInfo(), getTranslations()]);
  return (
    <>
      <section className="section section--dark page page--head">
        <div className="container"><PageHead crumbs={[{ name: t('common.ourStory') }]} eyebrow={t('pages.storyEyebrow')} title={t('pages.storyTitle')}
          intro={t('pages.storyIntro')} /></div>
      </section>
      {sections.map((s) => <HomeSectionView key={s.id} s={s} media={media} site={site} />)}
      <section className="section section--dark">
        <div className="container cta-band reveal">
          <p className="eyebrow">{t('pages.storyCtaEyebrow')}</p>
          <h2 className="section__title"><Title text={t('pages.storyCtaTitle')} /></h2>
          <p className="co__done-cta"><Link href="/shop" className="btn btn--gold">{t('common.exploreSignatures')}</Link><Link href="/art-of-scent" className="btn btn--ghost">{t('common.artOfScent')}</Link></p>
        </div>
      </section>
    </>
  );
}
