'use client';
import { useTranslations } from 'next-intl';
import { Link, usePathname } from '@/i18n/navigation';

const LINKS = [
  ['/account', 'navOverview'], ['/account/orders', 'navOrders'], ['/account/purchases', 'navPurchased'],
  ['/account/profile', 'navProfile'], ['/account/addresses', 'navAddresses'], ['/account/security', 'navSecurity'],
] as const;

export function AccountNav() {
  const t = useTranslations('account');
  const path = usePathname();
  return (
    <nav className="filters ac__tabsnav" aria-label={t('navAria')}>
      {LINKS.map(([href, label]) => {
        const on = href === '/account' ? path === href : path.startsWith(href);
        return <Link key={href} href={href} className={`filter${on ? ' is-active' : ''}`} aria-current={on ? 'page' : undefined}>{t(label)}</Link>;
      })}
    </nav>
  );
}
