import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Logo } from '@/components/site/Logo';
import { SiteProvider } from '@/components/site/SiteContext';
import { waLink } from '@/components/site/wa';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/server';
import { getSiteInfo } from '@/lib/site';

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Minimal checkout chrome from checkout.html: back link, logo, "Secure checkout" */
export default async function CheckoutLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await pageLocale(params);
  const [site, t] = await Promise.all([getSiteInfo(), getTranslations()]);
  return (
    <SiteProvider value={site}>
      <div className="co-page">
        <header className="co-head">
          <div className="container co-head__inner">
            <Link href="/shop" className="co-head__back">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
              <span>{t('checkout.back')}</span>
            </Link>
            <Logo />
            <p className="co-head__secure">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="1.5" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>
              <span>{t('checkout.secure')}</span>
            </p>
          </div>
        </header>
        <main className="co container" id="top">{children}</main>
        <footer className="co-foot">
          <div className="container">
            <p>{t('checkout.copyright', { year: new Date().getFullYear() })} &nbsp;·&nbsp; <a href={waLink(site.whatsapp, t('wa.orderHelp'))} target="_blank" rel="noopener noreferrer">{t('checkout.help')}</a></p>
          </div>
        </footer>
      </div>
    </SiteProvider>
  );
}
