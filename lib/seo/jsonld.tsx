import { localePath, type Locale } from '@/i18n/routing';
import { SITE_URL, STORE_NAME } from '@/lib/config';
import { productImage } from '@/lib/storage';
import type { StoreProduct, StoreVariant } from '@/lib/types';

export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }} />;
}

/** Product structured data: name, brand, image, price in LKR, availability; sale price valid until promotion end */
export function productJsonLd(p: StoreProduct, variants: StoreVariant[], images: { storage_path: string }[], locale: Locale) {
  const url = `${SITE_URL}${localePath(`/product/${p.slug}`, locale)}`;
  const imgs = images.map((i) => productImage(i.storage_path)).filter(Boolean);
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${p.brand_name ? p.brand_name + ' ' : ''}${p.name}`,
    description: p.seo_description || p.description || undefined,
    image: imgs.length ? imgs : undefined,
    sku: variants[0]?.sku,
    brand: p.brand_name ? { '@type': 'Brand', name: p.brand_name } : undefined,
    category: p.category_name || undefined,
    url,
    offers: variants.map((v) => ({
      '@type': 'Offer',
      sku: v.sku,
      name: `${p.name} ${v.size_ml} ml`,
      price: Number(v.effective_price).toFixed(2),
      priceCurrency: 'LKR',
      availability: v.stock_qty > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
      url,
      ...(v.promo_ends_at ? { priceValidUntil: v.promo_ends_at.slice(0, 10) } : {}),
      seller: { '@type': 'Organization', name: STORE_NAME },
    })),
  };
}

export function organizationJsonLd(settings: { store_phone: string | null; store_email: string | null } | null) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: STORE_NAME,
    url: SITE_URL,
    ...(settings?.store_phone || settings?.store_email
      ? { contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: settings.store_phone ?? undefined, email: settings.store_email ?? undefined, areaServed: 'LK' } }
      : {}),
  };
}
