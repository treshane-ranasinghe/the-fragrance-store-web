import type { MetadataRoute } from 'next';
import { getSitemapData } from '@/lib/data';
import { localePath, routing } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';

export const revalidate = 300;

/** Active products, categories, brands, live promotions and live bundles — each in English and Sinhala (/si/…) */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const d = await getSitemapData();
  const u = (path: string, lastModified?: string, priority = 0.6) => ({
    url: `${SITE_URL}${path}`, lastModified: lastModified ? new Date(lastModified) : undefined, priority,
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}${localePath(path, l)}`])) },
  });
  const english = [
    u('/', undefined, 1), u('/shop', undefined, 0.9), u('/bundles', undefined, 0.7),
    ...d.categories.map((c) => u(`/category/${c.slug}`, c.updated_at, 0.8)),
    ...d.brands.map((b) => u(`/brand/${b.slug}`, b.updated_at, 0.7)),
    ...d.products.map((p) => u(`/product/${p.slug}`, p.updated_at, 0.8)),
    ...d.promotions.map((p) => u(`/promotions/${p.slug}`, p.updated_at, 0.7)),
    ...d.bundles.map((b) => u(`/bundle/${b.slug}`, b.updated_at, 0.6)),
    u('/collections', undefined, 0.8), u('/our-story', undefined, 0.5), u('/art-of-scent', undefined, 0.5),
    ...['/delivery-policy', '/returns-policy', '/terms', '/privacy'].map((p) => u(p, undefined, 0.3)),
  ];
  const sinhala = english.map((e) => ({ ...e, url: `${SITE_URL}${localePath(e.url.slice(SITE_URL.length), 'si')}` }));
  return [...english, ...sinhala];
}
