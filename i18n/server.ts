import 'server-only';
import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { localePath, routing, type Locale } from './routing';

/** Call first in every page / layout under app/[locale]: keeps the page statically renderable and returns its language */
export async function pageLocale(params: Promise<{ locale: string }>): Promise<Locale> {
  const { locale } = await params;
  setRequestLocale(locale);
  return locale as Locale;
}

/** canonical + hreflang links for a storefront path ("/shop") in the given language */
export function localeAlternates(path: string, locale: Locale): NonNullable<Metadata['alternates']> {
  return {
    canonical: localePath(path, locale),
    languages: { ...Object.fromEntries(routing.locales.map((l) => [l, localePath(path, l)])), 'x-default': path },
  };
}
