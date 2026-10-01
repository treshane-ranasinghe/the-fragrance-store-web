import 'server-only';
import { unstable_cache } from 'next/cache';
import { draftMode } from 'next/headers';
import { createPublicClient } from '@/lib/supabase/public';
import { createClient } from '@/lib/supabase/server';
import { CMS_REVALIDATE_SECONDS, DEMO_MODE, MAX_LIVE_HEROES } from '@/lib/config';
import { demo } from '@/lib/demo';
import { localized } from '@/lib/i18n-content';
import type { BankAccount, PublicSettings, StoreBundle, StoreProduct, StoreVariant } from '@/lib/types';

/**
 * Public data is read with a cookie-less client and cached (tags: catalog, cms, bundles, settings).
 * Admin saves call revalidateTag; scheduled content is refreshed by pg_cron → /api/revalidate,
 * and everything also expires every 5 minutes as a safety net.
 * In Draft Mode (admins only) the cache is skipped and scheduled / hidden content is included.
 * The cache holds every language; `localized` lays the Sinhala text (i18n column) over the rows after reading.
 */
// Bump when the shape of cached data changes, so old entries in the Next data cache are never reused
const CACHE_VERSION = 'v4';
const cached = <A extends unknown[], R>(fn: (...args: A) => Promise<R>, key: string, tags: string[]) =>
  unstable_cache(fn, [CACHE_VERSION, key], { tags, revalidate: CMS_REVALIDATE_SECONDS });

export async function isPreview() {
  if (DEMO_MODE) return false;
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Settings & navigation
// ---------------------------------------------------------------------------
const getSettingsLive = cached(async () => {
  const db = createPublicClient();
  const [settings, banks, methods] = await Promise.all([
    db.from('public_store_settings').select('*').maybeSingle(),
    db.from('bank_accounts').select('*').order('sort_order'),
    db.from('delivery_methods').select('*').order('sort_order'),
  ]);
  if (settings.error) throw settings.error;
  return {
    settings: settings.data as PublicSettings,
    bankAccounts: (banks.data ?? []) as BankAccount[],
    deliveryMethods: (methods.data ?? []) as {
      id: string; name: string; description: string | null; fee: number; free_over: number | null; cod_allowed: boolean; requires_address?: boolean;
    }[],
  };
}, 'settings', ['settings']);
export const getSettings = localized((DEMO_MODE ? demo.settings : getSettingsLive) as typeof getSettingsLive);

const getNavLive = cached(async () => {
  const db = createPublicClient();
  const [cats, brands] = await Promise.all([
    db.from('categories').select('id, name, slug, image_url, subtitle, i18n').order('sort_order'),
    db.from('brands').select('id, name, slug, logo_url').order('sort_order').order('name'),
  ]);
  return {
    categories: (cats.data ?? []) as { id: string; name: string; slug: string; image_url: string | null; subtitle?: string | null }[],
    brands: (brands.data ?? []) as { id: string; name: string; slug: string; logo_url: string | null }[],
  };
}, 'nav', ['catalog']);
export const getNav = localized((DEMO_MODE ? demo.nav : getNavLive) as typeof getNavLive);

// ---------------------------------------------------------------------------
// Product listing
// ---------------------------------------------------------------------------
export interface ProductFilters {
  q?: string;
  category?: string;
  brand?: string;
  gender?: string[];
  concentration?: string[];
  size?: number;
  min?: number;
  max?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'best';
  page?: number;
  perPage?: number;
  promotionId?: string;
  ids?: string[];
  featured?: boolean;
  onSale?: boolean;
}

export const PRODUCT_COLUMNS =
  'id, name, slug, gender, concentration, description, top_notes, middle_notes, base_notes, badge, brand_name, brand_slug, category_name, category_slug, image_path, image_alt, default_variant_id, default_size_ml, price, regular_price, compare_at_price, badge_text, promotion_id, promo_ends_at, show_countdown, min_price, max_price, sizes, variant_count, in_stock, on_sale, sales_count, created_at, updated_at, is_featured, i18n, category_i18n';

async function queryProducts(f: ProductFilters) {
  const db = createPublicClient();
  const perPage = f.perPage ?? 24;
  const page = Math.max(1, f.page ?? 1);
  let q = db.from('store_products').select(PRODUCT_COLUMNS, { count: 'exact' });

  if (f.q) {
    const terms = f.q.toLowerCase().replace(/[%_,()]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 6);
    for (const t of terms) q = q.ilike('search_text', `%${t}%`);
  }
  if (f.category) q = q.eq('category_slug', f.category);
  if (f.brand) q = q.eq('brand_slug', f.brand);
  if (f.gender?.length) q = q.in('gender', f.gender);
  if (f.concentration?.length) q = q.in('concentration', f.concentration);
  if (f.size) q = q.contains('sizes', [f.size]);
  if (f.min != null) q = q.gte('min_price', f.min);
  if (f.max != null) q = q.lte('min_price', f.max);
  if (f.featured) q = q.eq('is_featured', true);
  if (f.onSale) q = q.eq('on_sale', true);
  if (f.ids) q = q.in('id', f.ids.length ? f.ids : ['00000000-0000-0000-0000-000000000000']);
  if (f.promotionId) {
    const { data } = await db.from('store_variants').select('product_id').eq('promotion_id', f.promotionId);
    const ids = [...new Set((data ?? []).map((r) => r.product_id as string))];
    q = q.in('id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000']);
  }

  switch (f.sort) {
    case 'price_asc': q = q.order('min_price', { ascending: true }); break;
    case 'price_desc': q = q.order('min_price', { ascending: false }); break;
    case 'best': q = q.order('sales_count', { ascending: false }).order('created_at', { ascending: false }); break;
    default: q = q.order('created_at', { ascending: false });
  }
  q = q.range((page - 1) * perPage, page * perPage - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  return { products: (data ?? []) as unknown as StoreProduct[], total: count ?? 0, page, perPage };
}

const listProductsLive = cached(queryProducts, 'products', ['catalog']);
export const listProducts = localized((DEMO_MODE ? demo.products : listProductsLive) as typeof listProductsLive);

const getFilterFacetsLive = cached(async () => {
  const db = createPublicClient();
  const { data } = await db.from('store_variants').select('size_ml, effective_price');
  const sizes = [...new Set((data ?? []).map((v) => v.size_ml as number))].sort((a, b) => a - b);
  const prices = (data ?? []).map((v) => Number(v.effective_price));
  return { sizes, maxPrice: prices.length ? Math.ceil(Math.max(...prices) / 1000) * 1000 : 0 };
}, 'facets', ['catalog']);
export const getFilterFacets = (DEMO_MODE ? demo.facets : getFilterFacetsLive) as typeof getFilterFacetsLive;

// ---------------------------------------------------------------------------
// Product details
// ---------------------------------------------------------------------------
const getProductLive = cached(async (slug: string) => {
  const db = createPublicClient();
  const { data: product } = await db.from('store_products').select('*').eq('slug', slug).maybeSingle();
  if (!product) {
    const { data: redirect } = await db
      .from('product_slug_redirects').select('products(slug)').eq('old_slug', slug).maybeSingle();
    const target = (redirect as unknown as { products: { slug: string } | null } | null)?.products?.slug;
    return { product: null, redirectTo: target ?? null };
  }
  const p = product as StoreProduct;
  const [variants, images, related, bundleItems] = await Promise.all([
    db.from('store_variants').select('*').eq('product_id', p.id).order('size_ml'),
    db.from('product_images').select('id, storage_path, alt_text').eq('product_id', p.id).order('sort_order'),
    db.from('store_products').select(PRODUCT_COLUMNS).eq('category_slug', p.category_slug ?? '').neq('id', p.id)
      .order('sales_count', { ascending: false }).limit(4),
    db.from('bundle_items').select('bundle_id, product_variants!inner(product_id)').eq('product_variants.product_id', p.id),
  ]);
  const bundleIds = [...new Set((bundleItems.data ?? []).map((b) => b.bundle_id as string))];
  const bundles = bundleIds.length
    ? ((await db.from('store_bundles').select('*').in('id', bundleIds)).data ?? [])
    : [];
  return {
    product: p,
    variants: (variants.data ?? []) as StoreVariant[],
    images: (images.data ?? []) as { id: string; storage_path: string; alt_text: string | null }[],
    related: (related.data ?? []) as unknown as StoreProduct[],
    bundles: bundles as StoreBundle[],
    redirectTo: null,
  };
}, 'product', ['catalog']);
/** Untranslated rows (for callers that pick the language themselves, e.g. the quick-view API) */
export const getProductRows = (DEMO_MODE ? demo.product : getProductLive) as typeof getProductLive;
export const getProduct = localized(getProductRows);

const getCategoryLive = cached(async (slug: string) => {
  const db = createPublicClient();
  const { data } = await db.from('categories').select('*').eq('slug', slug).maybeSingle();
  return data as null | { id: string; name: string; slug: string; intro_text: string | null; seo_title: string | null; seo_description: string | null; image_url: string | null; updated_at: string };
}, 'category', ['catalog']);
export const getCategory = localized((DEMO_MODE ? demo.category : getCategoryLive) as typeof getCategoryLive);

const getBrandLive = cached(async (slug: string) => {
  const db = createPublicClient();
  const { data } = await db.from('brands').select('*').eq('slug', slug).maybeSingle();
  return data as null | { id: string; name: string; slug: string; intro_text: string | null; seo_title: string | null; seo_description: string | null; logo_url: string | null; updated_at: string };
}, 'brand', ['catalog']);
export const getBrand = localized((DEMO_MODE ? demo.brand : getBrandLive) as typeof getBrandLive);

// ---------------------------------------------------------------------------
// Bundles
// ---------------------------------------------------------------------------
const listBundlesLive = cached(async (opts: { categoryId?: string; ids?: string[] } = {}) => {
  const db = createPublicClient();
  let q = db.from('store_bundles').select('*').order('updated_at', { ascending: false });
  if (opts.categoryId) q = q.eq('category_id', opts.categoryId);
  if (opts.ids) q = q.in('id', opts.ids.length ? opts.ids : ['00000000-0000-0000-0000-000000000000']);
  const { data } = await q;
  return (data ?? []) as StoreBundle[];
}, 'bundles', ['catalog', 'bundles']);
export const listBundles = localized((DEMO_MODE ? demo.bundles : listBundlesLive) as typeof listBundlesLive);

const getBundleLive = cached(async (slug: string) => {
  const db = createPublicClient();
  const { data: bundle } = await db.from('store_bundles').select('*').eq('slug', slug).maybeSingle();
  if (!bundle) return null;
  const [items, images] = await Promise.all([
    db.from('bundle_items')
      .select('quantity, variant_id, product_variants(size_ml, product_id, products(name, slug, brands(name)))')
      .eq('bundle_id', bundle.id),
    db.from('bundle_images').select('storage_path, alt_text').eq('bundle_id', bundle.id).order('sort_order'),
  ]);
  const variantIds = (items.data ?? []).map((i) => i.variant_id as string);
  const { data: prices } = variantIds.length
    ? await db.from('store_variants').select('id, effective_price, stock_qty').in('id', variantIds)
    : { data: [] };
  const { data: productImgs } = variantIds.length
    ? await db.from('store_products').select('id, image_path').in('id',
        (items.data ?? []).map((i) => (i.product_variants as unknown as { product_id: string }).product_id))
    : { data: [] };
  return {
    bundle: bundle as StoreBundle,
    images: (images.data ?? []) as { storage_path: string; alt_text: string | null }[],
    items: (items.data ?? []).map((i) => {
      const v = i.product_variants as unknown as { size_ml: number; product_id: string; products: { name: string; slug: string; brands: { name: string } | null } };
      const pr = (prices ?? []).find((x) => x.id === i.variant_id);
      return {
        quantity: i.quantity as number,
        size_ml: v.size_ml,
        name: v.products.name,
        slug: v.products.slug,
        brand: v.products.brands?.name ?? null,
        price: pr ? Number(pr.effective_price) : null,
        image_path: (productImgs ?? []).find((x) => x.id === v.product_id)?.image_path ?? null,
      };
    }),
  };
}, 'bundle', ['catalog', 'bundles']);
export const getBundle = localized((DEMO_MODE ? demo.bundle : getBundleLive) as typeof getBundleLive);

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------
export interface PromotionRow {
  id: string; name: string; slug: string; description: string | null; discount_type: 'percent' | 'amount';
  discount_value: number; badge_text: string | null; show_countdown: boolean; starts_at: string; ends_at: string;
  is_active: boolean; seo_title: string | null; seo_description: string | null;
  desktop_media_id: string | null; mobile_media_id: string | null;
}

async function fetchPromotion(slug: string, preview: boolean) {
  const db = preview ? await createClient() : createPublicClient();
  const { data } = await db.from('promotions').select('*').eq('slug', slug).maybeSingle();
  return data as PromotionRow | null;
}
const getPromotionCached = cached((slug: string) => fetchPromotion(slug, false), 'promotion', ['catalog', 'cms']);
export const getPromotion = localized(async (slug: string) => {
  if (DEMO_MODE) return demo.promotion(slug);
  return (await isPreview()) ? fetchPromotion(slug, true) : getPromotionCached(slug);
});

const listLivePromotionsLive = cached(async () => {
  const db = createPublicClient();
  const { data } = await db.from('live_promotions').select('id, name, slug, badge_text, ends_at, updated_at, i18n').order('ends_at');
  return (data ?? []) as { id: string; name: string; slug: string; badge_text: string | null; ends_at: string; updated_at: string }[];
}, 'live-promotions', ['catalog', 'cms']);
export const listLivePromotions = localized((DEMO_MODE ? demo.livePromotions : listLivePromotionsLive) as typeof listLivePromotionsLive);

// ---------------------------------------------------------------------------
// CMS: hero, announcement, homepage sections, media
// ---------------------------------------------------------------------------
export interface HeroBanner {
  id: string; internal_name: string; desktop_media_id: string; mobile_media_id: string | null; alt_text: string;
  eyebrow: string | null; headline: string | null; subheading: string | null;
  ghost_word?: string | null; tint?: string | null; feature_product_id?: string | null;
  button1_text: string | null; button1_link_type: string | null; button1_link_target: string | null;
  button2_text: string | null; button2_link_type: string | null; button2_link_target: string | null;
  text_position: 'left' | 'center' | 'right'; overlay: 'none' | 'light' | 'medium' | 'dark'; text_colour: 'cream' | 'dark';
  sort_order: number; starts_at: string | null; ends_at: string | null; is_active: boolean;
}

export interface HomeSection {
  id: string; type: string; title: string | null; subtitle: string | null; config: Record<string, unknown>;
  background: 'cream' | 'beige' | 'green'; spacing: 'small' | 'medium' | 'large'; sort_order: number;
  starts_at: string | null; ends_at: string | null; is_active: boolean;
}

async function fetchCms(preview: boolean) {
  const db = preview ? await createClient() : createPublicClient();
  const notEnded = `ends_at.is.null,ends_at.gt.${new Date().toISOString()}`;
  const [banners, sections, announcement] = await Promise.all([
    preview
      ? db.from('hero_banners').select('*').or(notEnded).order('sort_order')
      : db.from('live_hero_banners').select('*').order('sort_order'),
    preview
      ? db.from('home_sections').select('*').or(notEnded).order('sort_order')
      : db.from('live_home_sections').select('*').order('sort_order'),
    db.from('live_announcement').select('*').maybeSingle(),
  ]);
  const mediaIds = new Set<string>();
  for (const b of (banners.data ?? []) as HeroBanner[]) {
    mediaIds.add(b.desktop_media_id);
    if (b.mobile_media_id) mediaIds.add(b.mobile_media_id);
  }
  for (const s of (sections.data ?? []) as HomeSection[]) {
    const c = s.config as Record<string, unknown>;
    for (const k of ['media_id', 'desktop_media_id', 'mobile_media_id']) if (typeof c[k] === 'string') mediaIds.add(c[k] as string);
    if (Array.isArray(c.media_ids)) (c.media_ids as string[]).forEach((id) => mediaIds.add(id));
  }
  const media = await fetchMedia(db, [...mediaIds]);
  return {
    banners: ((banners.data ?? []) as HeroBanner[]).slice(0, MAX_LIVE_HEROES),
    sections: (sections.data ?? []) as HomeSection[],
    announcement: announcement.data as null | { id: string; text: string; link_url: string | null; background: 'green' | 'gold' | 'beige' },
    media,
  };
}

async function fetchMedia(db: ReturnType<typeof createPublicClient> | Awaited<ReturnType<typeof createClient>>, ids: string[]) {
  if (!ids.length) return {} as Record<string, { storage_path: string; alt_text: string | null; width: number | null; height: number | null }>;
  const { data } = await db.from('media_assets').select('id, storage_path, alt_text, width, height').in('id', ids);
  return Object.fromEntries((data ?? []).map((m) => [m.id, m])) as Record<string, { storage_path: string; alt_text: string | null; width: number | null; height: number | null }>;
}

const getCmsCached = cached(() => fetchCms(false), 'cms', ['cms']);
export const getCms = localized(async () => {
  if (DEMO_MODE) return demo.cms();
  return (await isPreview()) ? fetchCms(true) : getCmsCached();
});

const getMediaByIdsLive = cached(async (ids: string[]) => fetchMedia(createPublicClient(), ids), 'media', ['cms']);
export const getMediaByIds = (DEMO_MODE ? demo.media : getMediaByIdsLive) as typeof getMediaByIdsLive;

const getAnnouncementLive = cached(async () => {
  const { data } = await createPublicClient().from('live_announcement').select('*').maybeSingle();
  return data as null | { id: string; text: string; link_url: string | null; background: 'green' | 'gold' | 'beige' };
}, 'announcement', ['cms']);
export const getAnnouncement = localized((DEMO_MODE ? demo.announcement : getAnnouncementLive) as typeof getAnnouncementLive);

// ---------------------------------------------------------------------------
// Sitemap
// ---------------------------------------------------------------------------
export async function getSitemapData() {
  if (DEMO_MODE) return demo.sitemap();
  const db = createPublicClient();
  const [products, categories, brands, promotions, bundles] = await Promise.all([
    db.from('store_products').select('slug, updated_at'),
    db.from('categories').select('slug, updated_at'),
    db.from('brands').select('slug, updated_at'),
    db.from('live_promotions').select('slug, updated_at'),
    db.from('store_bundles').select('slug, updated_at'),
  ]);
  return {
    products: products.data ?? [], categories: categories.data ?? [], brands: brands.data ?? [],
    promotions: promotions.data ?? [], bundles: bundles.data ?? [],
  };
}

export const getLivePromotionById = localized(async (id: string) => {
  if (DEMO_MODE) return demo.livePromotionById(id);
  const { data } = await createPublicClient().from('live_promotions').select('*').eq('id', id).maybeSingle();
  return data as (PromotionRow & { updated_at: string }) | null;
});
