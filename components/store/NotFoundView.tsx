import { getTranslations } from 'next-intl/server';
import { Title } from '@/components/site/Title';
import { StoreShell } from '@/components/store/StoreShell';
import { Link } from '@/i18n/navigation';

export async function NotFoundView() {
  const t = await getTranslations();
  return (
    <StoreShell>
      <section className="section section--dark page">
        <div className="container co__empty">
          <p className="eyebrow">404</p>
          <h1 className="section__title"><Title text={t('notFound.title')} /></h1>
          <p>{t('notFound.lead')}</p>
          <p className="co__done-cta"><Link href="/shop" className="btn btn--gold">{t('common.exploreSignatures')}</Link><Link href="/" className="btn btn--ghost">{t('common.home')}</Link></p>
        </div>
      </section>
    </StoreShell>
  );
}
