import { defineRouting } from 'next-intl/routing';

/**
 * English lives at the plain URLs (/shop), Sinhala under /si (/si/shop).
 * The admin panel, API routes and /auth stay English-only and outside this routing.
 */
export const routing = defineRouting({
  locales: ['en', 'si'],
  defaultLocale: 'en',
  localePrefix: 'as-needed',
});

export type Locale = (typeof routing.locales)[number];

/** Language names shown on the switcher, each in its own language */
export const LOCALE_NAMES: Record<Locale, string> = { en: 'English', si: 'සිංහල' };

/** "/si/shop" → { locale: 'si', path: '/shop' }; "/shop" → { locale: 'en', path: '/shop' } */
export function splitLocale(pathname: string): { locale: Locale; path: string } {
  for (const l of routing.locales) {
    if (l === routing.defaultLocale) continue;
    if (pathname === `/${l}` || pathname.startsWith(`/${l}/`)) return { locale: l, path: pathname.slice(l.length + 1) || '/' };
  }
  return { locale: routing.defaultLocale, path: pathname };
}

/** "/shop" in Sinhala → "/si/shop" */
export function localePath(path: string, locale: Locale) {
  if (locale === routing.defaultLocale) return path;
  return path === '/' ? `/${locale}` : `/${locale}${path}`;
}
