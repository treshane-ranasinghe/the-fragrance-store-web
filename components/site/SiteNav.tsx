'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/components/store/CartProvider';
import { Link, usePathname } from '@/i18n/navigation';
import { BagIcon, WaIcon } from './icons';
import { LanguageSwitch } from './LanguageSwitch';
import { Logo } from './Logo';
import { useSite, waLink } from './SiteContext';

/** Floating glass pill nav + full-screen glass menu on phones (original markup and classes) */
export function SiteNav() {
  const t = useTranslations();
  const site = useSite();
  const { cart, setDrawerOpen } = useCart();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const [bump, setBump] = useState(false);
  const last = useRef(cart.count);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && open) { setOpen(false); toggleRef.current?.focus(); } };
    const mq = window.matchMedia('(min-width: 1081px)');
    const onMq = (m: MediaQueryListEvent) => m.matches && setOpen(false);
    document.addEventListener('keydown', onKey);
    mq.addEventListener('change', onMq);
    return () => { document.removeEventListener('keydown', onKey); mq.removeEventListener('change', onMq); };
  }, [open]);
  useEffect(() => {
    if (cart.count > last.current) { setBump(false); requestAnimationFrame(() => setBump(true)); }
    last.current = cart.count;
  }, [cart.count]);

  const wa = waLink(site.whatsapp, t('wa.enquire'));
  const links = [
    ['/collections', t('common.collections')], ['/shop', t('common.signatures')], ['/bundles', t('common.giftSets')], ['/our-story', t('common.ourStory')],
    ['/art-of-scent', t('common.artOfScent')], ['/account', t('common.myAccount')],
  ];

  return (
    <header className="nav" id="nav">
      <div className="nav__inner container">
        <button ref={toggleRef} className="nav__toggle" aria-label={open ? t('nav.closeMenu') : t('nav.openMenu')} aria-expanded={open} aria-controls="drawer" onClick={() => setOpen(!open)}>
          <span /><span /><span />
        </button>

        <nav className="nav__links nav__links--left" aria-label={t('nav.primary')}>
          <Link href="/collections" aria-current={pathname.startsWith('/collections') || pathname.startsWith('/category') ? 'page' : undefined}>{t('common.collections')}</Link>
          <Link href="/shop" aria-current={pathname.startsWith('/shop') || pathname.startsWith('/product') ? 'page' : undefined}>{t('common.signatures')}</Link>
          <Link href="/bundles" aria-current={pathname.startsWith('/bundle') ? 'page' : undefined}>{t('common.giftSets')}</Link>
        </nav>

        <Logo />

        <div className="nav__actions">
          <nav className="nav__links nav__links--right" aria-label={t('nav.secondary')}>
            <Link href="/our-story" aria-current={pathname.startsWith('/our-story') || pathname.startsWith('/art-of-scent') ? 'page' : undefined}>{t('common.ourStory')}</Link>
            <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--ghost btn--sm">{t('nav.enquire')}</a>
          </nav>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="nav__wa" aria-label={t('nav.chatWhatsApp')}><WaIcon /></a>
          <LanguageSwitch className="nav__bag nav__lang" />
          <Link href="/account" className="nav__bag nav__account" aria-label={t('nav.account')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5" /><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5" /></svg>
          </Link>
          <button type="button" className={`nav__bag${cart.count > 0 ? ' has-items' : ''}`} onClick={() => setDrawerOpen(true)}
            aria-label={t('nav.openBag', { count: cart.count })}>
            <BagIcon /><b className={bump ? 'is-bump' : ''} onAnimationEnd={() => setBump(false)}>{cart.count}</b>
          </button>
        </div>
      </div>

      <div className={`drawer${open ? ' is-open' : ''}`} id="drawer" aria-hidden={!open}>
        <nav className="drawer__links" aria-label={t('nav.mobile')}>
          {links.map(([href, label], i) => (
            <Link key={href} href={href} style={{ '--i': i } as React.CSSProperties} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>
              <span>{String(i + 1).padStart(2, '0')}</span>{label}
            </Link>
          ))}
        </nav>
        <div className="drawer__foot" style={{ '--i': links.length } as React.CSSProperties}>
          <a href={wa} target="_blank" rel="noopener noreferrer" className="btn btn--gold btn--block" tabIndex={open ? 0 : -1}>{t('nav.enquireWhatsApp')}</a>
          <LanguageSwitch className="drawer__lang" long tabIndex={open ? 0 : -1} />
          <div className="drawer__social">
            {site.instagram ? <a href={site.instagram} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>Instagram</a> : null}
            {site.facebook ? <a href={site.facebook} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>Facebook</a> : null}
            {site.tiktok ? <a href={site.tiktok} target="_blank" rel="noopener noreferrer" tabIndex={open ? 0 : -1}>TikTok</a> : null}
          </div>
        </div>
      </div>
    </header>
  );
}

export function FloatWhatsApp() {
  const t = useTranslations();
  const site = useSite();
  return (
    <a href={waLink(site.whatsapp, t('wa.enquire'))} target="_blank" rel="noopener noreferrer" className="float-wa" aria-label={t('nav.chatWhatsApp')}><WaIcon /></a>
  );
}
