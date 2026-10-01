'use client';
import { useLocale, useTranslations } from 'next-intl';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';

/**
 * English ⇄ Sinhala toggle: same page in the other language (/shop ⇄ /si/shop), keeping filters and search.
 * A real link (works without JS and for crawlers); with JS it also keeps the ?query and scroll position.
 */
export function LanguageSwitch({ className, long = false, tabIndex }: { className?: string; long?: boolean; tabIndex?: number }) {
  const t = useTranslations('nav');
  const locale = useLocale() as Locale;
  const target: Locale = locale === 'si' ? 'en' : 'si';
  const pathname = usePathname();
  const router = useRouter();
  return (
    <Link href={pathname} locale={target} hrefLang={target} lang={target} className={className} aria-label={t('switchAria')} tabIndex={tabIndex}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        router.replace(`${pathname}${window.location.search}`, { locale: target, scroll: false });
      }}>
      {long ? t('switchLong') : t('switchLabel')}
    </Link>
  );
}
