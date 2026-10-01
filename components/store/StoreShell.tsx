import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Announce } from '@/components/site/Announce';
import { BagDrawer } from '@/components/site/BagDrawer';
import { Effects } from '@/components/site/Effects';
import { ProductModalProvider } from '@/components/site/ProductModal';
import { SiteFooter } from '@/components/site/SiteFooter';
import { FloatWhatsApp, SiteNav } from '@/components/site/SiteNav';
import { SiteProvider } from '@/components/site/SiteContext';
import { getAnnouncement, getSettings, isPreview } from '@/lib/data';
import { getSiteInfo } from '@/lib/site';

/** Storefront chrome from the original site: preloader, cursor, announcement, glass nav, footer, bag, product sheet */
export async function StoreShell({ children, minimal = false }: { children: React.ReactNode; minimal?: boolean }) {
  const [announcement, preview, site, { settings }, t] = await Promise.all([
    getAnnouncement().catch(() => null), isPreview(), getSiteInfo(), getSettings(), getTranslations(),
  ]);
  return (
    <SiteProvider value={site}>
      <ProductModalProvider>
        <a href="#top" className="skip-link">{t('common.skipToContent')}</a>
        <Effects />
        {preview ? (
          <div className="preview-bar">{t('shell.previewBar')} <Link href="/api/draft/disable" prefetch={false}>{t('shell.exitPreview')}</Link></div>
        ) : null}
        {announcement && !minimal ? <Announce id={announcement.id} text={announcement.text} short={settings.announcement_short} link={announcement.link_url} background={announcement.background} /> : null}
        <SiteNav />
        <main id="top">{children}</main>
        <SiteFooter site={site} />
        <FloatWhatsApp />
        <BagDrawer />
      </ProductModalProvider>
    </SiteProvider>
  );
}
