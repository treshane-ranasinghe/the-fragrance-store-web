import type { Metadata } from 'next';
import type { Locale } from '@/i18n/routing';
import { localePath } from '@/i18n/routing';
import { localeAlternates } from '@/i18n/server';

export function truncate(s: string | null | undefined, n = 158) {
  if (!s) return undefined;
  const clean = s.replace(/\s+/g, ' ').trim();
  return clean.length > n ? clean.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : clean;
}

/** `path` is the English path ("/product/x"); the canonical / og:url get "/si" in Sinhala, plus hreflang links to both */
export function pageMeta({ title, description, path, image, noindex, locale }:
  { title: string; description?: string; path: string; image?: string | null; noindex?: boolean; locale: Locale }): Metadata {
  const alternates = localeAlternates(path, locale);
  return {
    title: { absolute: title },
    description,
    alternates,
    openGraph: { title, description, url: localePath(path, locale), images: image ? [{ url: image }] : undefined },
    twitter: { card: image ? 'summary_large_image' : 'summary', title, description, images: image ? [image] : undefined },
    robots: noindex ? { index: false, follow: false } : undefined,
  };
}

export const NOINDEX: Metadata = { robots: { index: false, follow: false } };
