import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import type { SiteInfo } from './SiteContext';
import { waLink } from './wa';
import { Logo } from './Logo';

export function SiteFooter({ site }: { site: SiteInfo }) {
  const t = useTranslations();
  const year = new Date().getFullYear();
  const wa = (m: string) => waLink(site.whatsapp, m);
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer__top">
          <Logo large />
          <p className="footer__tag">{t('footer.tagline')}</p>
        </div>
        <div className="footer__grid">
          <div>
            <h5>{t('footer.explore')}</h5>
            <Link href="/shop">{t('common.signatures')}</Link>
            <Link href="/collections">{t('common.collections')}</Link>
            <Link href="/bundles">{t('common.giftSets')}</Link>
            <Link href="/our-story">{t('common.ourStory')}</Link>
            <Link href="/art-of-scent">{t('common.artOfScent')}</Link>
          </div>
          <div>
            <h5>{t('footer.clientCare')}</h5>
            <Link href="/delivery-policy">{t('footer.deliveryLink')}</Link>
            <Link href="/returns-policy">{t('footer.returnsLink')}</Link>
            <a href={wa(t('wa.gift'))} target="_blank" rel="noopener noreferrer">{t('footer.gifting')}</a>
            <a href={wa(t('wa.consultation'))} target="_blank" rel="noopener noreferrer">{t('footer.consultation')}</a>
            <Link href="/account">{t('common.myAccount')}</Link>
          </div>
          <div>
            <h5>{t('footer.follow')}</h5>
            {site.instagram ? <a href={site.instagram} target="_blank" rel="noopener noreferrer">Instagram</a> : null}
            {site.facebook ? <a href={site.facebook} target="_blank" rel="noopener noreferrer">Facebook</a> : null}
            {site.tiktok ? <a href={site.tiktok} target="_blank" rel="noopener noreferrer">TikTok</a> : null}
          </div>
        </div>
        <div className="footer__bottom">
          <p>{t('footer.rights', { year })} · <Link href="/terms">{t('footer.terms')}</Link> · <Link href="/privacy">{t('footer.privacy')}</Link></p>
          <p>thefragrancestore.lk</p>
        </div>
      </div>
    </footer>
  );
}
