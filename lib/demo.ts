import 'server-only';
import type { BankAccount, Cart, CartLine, PublicSettings, StoreBundle, StoreProduct, StoreVariant } from '@/lib/types';
import type { HomeSection, ProductFilters, PromotionRow } from '@/lib/data';

/**
 * Demo mode: used when NEXT_PUBLIC_SUPABASE_URL is not set, so the storefront can be
 * browsed without a backend. Mirrors supabase/seed.sql. Prices here are computed in JS;
 * in production they always come from the database (effective_price).
 */

const now = Date.now();
const iso = (offsetDays: number) => new Date(now + offsetDays * 86400_000).toISOString();

const A = (n: number) => `00000000-0000-4000-a000-00000000000${n}`;
const B = (n: number) => `00000000-0000-4000-b000-00000000000${n}`;
const P = (n: number) => `00000000-0000-4000-c000-00000000000${n}`;
const V = (n: string) => `00000000-0000-4000-d000-0000000000${n}`;
const M = (n: number) => `00000000-0000-4000-9000-00000000000${n}`;

const categories = [
  { id: A(1), name: 'Pour Homme', slug: 'men', subtitle: 'Woods, leather & spice', image_url: '/images/products/montblanc-explorer.jpg', intro_text: "Men's perfumes in Sri Lanka — authentic designer fragrances built on woods, leather and spice.", seo_title: null, seo_description: null, updated_at: iso(-10) },
  { id: A(2), name: 'Pour Femme', slug: 'women', subtitle: 'Florals, musks & gourmands', image_url: '/images/products/lattafa-khamrah.jpg', intro_text: "Women's perfumes in Sri Lanka — florals, musks and gourmands, every bottle 100% original.", seo_title: null, seo_description: null, updated_at: iso(-10) },
  { id: A(3), name: 'Arabian & Oud', slug: 'arabian', subtitle: 'Rare, opulent, unforgettable', image_url: '/images/products/lattafa-asad-bourbon.jpg', intro_text: 'Arabian and oud fragrances — rare, opulent and unforgettable.', seo_title: null, seo_description: null, updated_at: iso(-10) },
  { id: A(4), name: 'Gift Sets', slug: 'gift-sets', subtitle: 'Two scents, one special price', image_url: '/images/azzaro-gold.jpg', intro_text: 'Gift sets and bundles — the easiest way to give something memorable.', seo_title: null, seo_description: null, updated_at: iso(-10) },
];

const brands = [
  { id: B(1), name: 'Hugo Boss', slug: 'hugo-boss', logo_url: null, intro_text: null, seo_title: null, seo_description: null, updated_at: iso(-10) },
  { id: B(2), name: 'Azzaro', slug: 'azzaro', logo_url: null, intro_text: null, seo_title: null, seo_description: null, updated_at: iso(-10) },
  { id: B(3), name: 'Jean Paul Gaultier', slug: 'jean-paul-gaultier', logo_url: null, intro_text: null, seo_title: null, seo_description: null, updated_at: iso(-10) },
  { id: B(4), name: 'Lattafa', slug: 'lattafa', logo_url: null, intro_text: null, seo_title: null, seo_description: null, updated_at: iso(-10) },
  { id: B(5), name: 'Montblanc', slug: 'montblanc', logo_url: null, intro_text: null, seo_title: null, seo_description: null, updated_at: iso(-10) },
];

const promotion: PromotionRow & { updated_at: string } = {
  id: '00000000-0000-4000-f000-000000000001', name: 'Arabian Nights', slug: 'arabian-nights', description: 'Ten percent off every Lattafa fragrance, for a limited time.',
  discount_type: 'percent', discount_value: 10, badge_text: 'Lattafa −10%', show_countdown: true,
  starts_at: iso(-1), ends_at: iso(30), is_active: true, seo_title: null, seo_description: null,
  desktop_media_id: M(4), mobile_media_id: null, updated_at: iso(-1),
};
const PROMO_BRAND = B(4);

type BaseProduct = {
  id: string; name: string; slug: string; brand: string; category: string; gender: 'men' | 'women' | 'unisex'; concentration: string;
  badge: string | null; image: string; description: string; top: string[]; middle: string[]; base: string[]; featured: boolean; ageDays: number; sales: number;
  variants: { id: string; size: number; sku: string; price: number; compare?: number; stock: number }[];
};

const base: BaseProduct[] = [
  { id: P(1), name: 'Boss Bottled Elixir', slug: 'hugo-boss-bottled-elixir', brand: B(1), category: A(1), gender: 'men', concentration: 'Parfum', badge: 'Bestseller', image: '/images/products/boss-bottled-elixir.jpg',
    description: 'A richer, deeper take on an icon — warm spice and smooth vanilla wrapped in precious woods. Made for evenings that matter.',
    top: ['Apple', 'Cinnamon'], middle: ['Cloves'], base: ['Vanilla', 'Woody Notes', 'Rum'], featured: true, ageDays: 40, sales: 42,
    variants: [{ id: V('11'), size: 50, sku: 'BOSS-ELX-50', price: 38500, stock: 6 }, { id: V('12'), size: 100, sku: 'BOSS-ELX-100', price: 52500, stock: 4 }] },
  { id: P(2), name: 'The Most Wanted Parfum', slug: 'azzaro-the-most-wanted-parfum', brand: B(2), category: A(1), gender: 'men', concentration: 'Parfum', badge: 'Signature', image: '/images/products/azzaro-most-wanted-parfum.jpg',
    description: 'Magnetic and daring. A fiery ginger opening melts into a sensual trail of bourbon vanilla and woods.',
    top: ['Ginger'], middle: ['Woodsy Notes'], base: ['Bourbon Vanilla'], featured: true, ageDays: 35, sales: 30,
    variants: [{ id: V('21'), size: 50, sku: 'AZZ-TMW-50', price: 34500, stock: 5 }, { id: V('22'), size: 100, sku: 'AZZ-TMW-100', price: 46000, stock: 3 }] },
  { id: P(3), name: 'Le Male Elixir', slug: 'jean-paul-gaultier-le-male-elixir', brand: B(3), category: A(1), gender: 'men', concentration: 'Parfum', badge: 'Icon', image: '/images/products/jpg-le-male-elixir.jpg',
    description: 'The legendary sailor, dipped in gold. Fresh lavender and mint over a glowing heart of honey, tonka and tobacco.',
    top: ['Mint', 'Lavender'], middle: ['Vanilla', 'Benzoin'], base: ['Tonka Bean', 'Honey', 'Tobacco'], featured: true, ageDays: 30, sales: 28,
    variants: [{ id: V('31'), size: 75, sku: 'JPG-LME-75', price: 41000, stock: 4 }, { id: V('32'), size: 125, sku: 'JPG-LME-125', price: 54500, stock: 2 }] },
  { id: P(4), name: 'Khamrah', slug: 'lattafa-khamrah', brand: B(4), category: A(3), gender: 'unisex', concentration: 'EDP', badge: 'Arabian', image: '/images/products/lattafa-khamrah.jpg',
    description: 'An opulent Arabian gourmand — spiced dates and praline glowing over amberwood and vanilla. Unisex and unforgettable.',
    top: ['Cinnamon', 'Nutmeg', 'Bergamot'], middle: ['Dates', 'Praline', 'Tuberose'], base: ['Vanilla', 'Tonka Bean', 'Amberwood', 'Myrrh'], featured: true, ageDays: 20, sales: 50,
    variants: [{ id: V('41'), size: 100, sku: 'LAT-KHM-100', price: 14500, stock: 12 }] },
  { id: P(5), name: 'Asad Bourbon', slug: 'lattafa-asad-bourbon', brand: B(4), category: A(3), gender: 'men', concentration: 'EDP', badge: 'New', image: '/images/products/lattafa-asad-bourbon.jpg',
    description: 'A bold, bourbon-warm Arabian — smooth spice and sweet amber poured over deep, resinous woods.',
    top: ['Pink Pepper', 'Lavender'], middle: ['Bourbon Vanilla', 'Coffee'], base: ['Amber', 'Vetiver', 'Patchouli'], featured: true, ageDays: 5, sales: 22,
    variants: [{ id: V('51'), size: 100, sku: 'LAT-ASB-100', price: 12900, stock: 9 }] },
  { id: P(6), name: 'Explorer', slug: 'montblanc-explorer', brand: B(5), category: A(1), gender: 'men', concentration: 'EDP', badge: null, image: '/images/products/montblanc-explorer.jpg',
    description: 'An invitation to adventure — bergamot and pink pepper over vetiver, leather and a warm woody trail.',
    top: ['Bergamot', 'Pink Pepper', 'Clary Sage'], middle: ['Vetiver', 'Leather'], base: ['Patchouli', 'Ambroxan', 'Akigalawood'], featured: true, ageDays: 60, sales: 15,
    variants: [{ id: V('61'), size: 60, sku: 'MB-EXP-60', price: 24500, stock: 5 }, { id: V('62'), size: 100, sku: 'MB-EXP-100', price: 32000, stock: 3 }] },
];

function variantsOf(p: BaseProduct): StoreVariant[] {
  const promo = p.brand === PROMO_BRAND;
  return p.variants.map((v) => {
    const eff = promo ? Math.round(v.price * 0.9 * 100) / 100 : v.price;
    return {
      id: v.id, product_id: p.id, size_ml: v.size, sku: v.sku, stock_qty: v.stock, compare_at_price: v.compare ?? null,
      price: v.price, effective_price: eff, discount_amount: v.price - eff,
      promotion_id: promo ? promotion.id : null, promotion_slug: promo ? promotion.slug : null,
      badge_text: promo ? promotion.badge_text : null, promo_ends_at: promo ? promotion.ends_at : null, show_countdown: promo,
    };
  });
}

const allVariants = base.flatMap(variantsOf);

function toStore(p: BaseProduct): StoreProduct {
  const vs = variantsOf(p);
  const d = [...vs].sort((a, b) => Number(b.stock_qty > 0) - Number(a.stock_qty > 0) || a.effective_price - b.effective_price)[0];
  const b = brands.find((x) => x.id === p.brand)!;
  const c = categories.find((x) => x.id === p.category)!;
  return {
    id: p.id, name: p.name, slug: p.slug, gender: p.gender, concentration: p.concentration, description: p.description,
    top_notes: p.top, middle_notes: p.middle, base_notes: p.base, is_featured: p.featured,
    created_at: iso(-p.ageDays), updated_at: iso(-1), seo_title: null, seo_description: null,
    brand_id: b.id, brand_name: b.name, brand_slug: b.slug, category_id: c.id, category_name: c.name, category_slug: c.slug,
    image_path: p.image, image_alt: `${b.name} ${p.name}`, default_variant_id: d.id, default_size_ml: d.size_ml,
    price: d.effective_price, regular_price: d.price, compare_at_price: d.compare_at_price,
    badge_text: d.badge_text, promotion_id: d.promotion_id, promo_ends_at: d.promo_ends_at, show_countdown: d.show_countdown,
    min_price: Math.min(...vs.map((v) => v.effective_price)), max_price: Math.max(...vs.map((v) => v.effective_price)),
    sizes: vs.map((v) => v.size_ml).sort((a, b2) => a - b2), variant_count: vs.length,
    in_stock: vs.some((v) => v.stock_qty > 0), on_sale: vs.some((v) => v.promotion_id), sales_count: p.sales, badge: p.badge,
  };
}

const products = base.map(toStore);
const searchText = (p: StoreProduct) =>
  [p.name, p.brand_name, p.category_name, p.concentration, ...p.top_notes, ...p.middle_notes, ...p.base_notes].join(' ').toLowerCase();

const bundleItems = [{ variant_id: V('12'), quantity: 1 }, { variant_id: V('22'), quantity: 1 }];
const bundleValue = bundleItems.reduce((s, i) => s + allVariants.find((v) => v.id === i.variant_id)!.effective_price * i.quantity, 0);
const bundle: StoreBundle = {
  id: '00000000-0000-4000-e000-000000000001', name: 'The Evening Duo', slug: 'the-evening-duo',
  description: 'Two after-dark icons, together: Boss Bottled Elixir 100 ml and Azzaro The Most Wanted Parfum 100 ml. Gift-wrapped at no extra cost.',
  category_id: A(4), category_slug: 'gift-sets', max_per_order: 2, seo_title: null, seo_description: null, starts_at: null, ends_at: null,
  updated_at: iso(-2), price: 89000, effective_price: 89000, badge_text: null, promo_ends_at: null, items_value: bundleValue,
  you_save: bundleValue - 89000,
  available: Math.min(...bundleItems.map((i) => Math.floor(allVariants.find((v) => v.id === i.variant_id)!.stock_qty / i.quantity))),
  image_path: null, item_images: ['/images/products/boss-bottled-elixir.jpg', '/images/products/azzaro-most-wanted-parfum.jpg'],
};

const settings: PublicSettings = {
  store_name: 'The Fragrance Store', bacs_enabled: true, bacs_title: 'Bank transfer',
  bacs_description: 'We dispatch once your transfer is confirmed. Please use your order number as the payment reference.',
  bacs_instructions: 'Please transfer the full amount to the account below and use your order number as the payment reference. We will start preparing your order as soon as the money reaches our account.',
  bank_payment_hours: 48, cod_enabled: true, cod_title: 'Cash on delivery', cod_description: 'Pay in cash when your order arrives',
  cod_instructions: 'Pay with cash upon delivery.', cod_fee: 0, cod_max_order_value: 150000,
  store_phone: '+94 XX XXX XXXX', store_whatsapp: '94XXXXXXXXX', store_email: 'hello@thefragrancestore.lk', store_address: 'No. 00, Your Street,\nColombo 00, Sri Lanka', default_hero_media_id: null,
  store_hours: 'Mon – Sat   10:00 – 20:00\nSunday   11:00 – 18:00', instagram_url: 'https://www.instagram.com/', instagram_handle: '@thefragrancestore.lk',
  facebook_url: 'https://www.facebook.com/', tiktok_url: 'https://www.tiktok.com/', maps_url: 'https://maps.google.com/?q=The+Fragrance+Store+Colombo',
  announcement_short: 'Authentic only  ·  Island-wide delivery',
};

const bankAccounts: BankAccount[] = [{ id: 'bank-1', account_name: 'The Fragrance Store (Pvt) Ltd', account_number: '0000000000 (demo)', bank_name: 'Commercial Bank', branch: 'Colombo', branch_code: null, swift: null, sort_order: 1, is_active: true }];

const deliveryMethods = [
  { id: 'dm-1', name: 'Island-wide delivery', description: '2 – 4 working days, carefully packed', fee: 450, free_over: 25000, cod_allowed: true, requires_address: true },
  { id: 'dm-2', name: 'Collect from the boutique', description: 'Ready within 24 hours — Colombo', fee: 0, free_over: null, cod_allowed: true, requires_address: false },
];

const mediaList = [
  { id: M(1), storage_path: '/images/hero.jpg', alt_text: 'Hugo Boss Bottled Elixir', width: null, height: null },
  { id: M(2), storage_path: '/images/azzaro-gold.jpg', alt_text: 'Azzaro The Most Wanted', width: null, height: null },
  { id: M(3), storage_path: '/images/products/lattafa-asad-bourbon.jpg', alt_text: 'Lattafa Asad Bourbon', width: null, height: null },
  { id: M(4), storage_path: '/images/products/lattafa-khamrah.jpg', alt_text: 'Lattafa Khamrah', width: null, height: null },
  { id: M(5), storage_path: '/images/products/montblanc-explorer.jpg', alt_text: 'Montblanc Explorer', width: null, height: null },
];
const mediaMap = Object.fromEntries(mediaList.map((m) => [m.id, m]));

const banner = (i: number, name: string, ghost: string, tint: string, product: string, media: string) => ({
  id: `hero-${i}`, internal_name: name, desktop_media_id: media, mobile_media_id: null, alt_text: mediaMap[media].alt_text,
  eyebrow: null, headline: null, subheading: null, button1_text: null, button1_link_type: null, button1_link_target: null,
  button2_text: null, button2_link_type: null, button2_link_target: null, text_position: 'left' as const, overlay: 'medium' as const, text_colour: 'cream' as const,
  sort_order: i, starts_at: null, ends_at: null, is_active: true, ghost_word: ghost, tint, feature_product_id: product,
});
const banners = [
  banner(1, 'Boss Elixir', 'ELIXIR', '#C6A566', P(1), M(1)),
  banner(2, 'Most Wanted', 'WANTED', '#E8D5A8', P(2), M(2)),
  banner(3, 'Asad Bourbon', 'ASAD', '#B8913F', P(5), M(3)),
  banner(4, 'Khamrah', 'KHAMRAH', '#DCCFB8', P(4), M(4)),
  banner(5, 'Explorer', 'EXPLORER', '#E8D5A8', P(6), M(5)),
];

const section = (id: string, type: string, sort: number, background: HomeSection['background'], config: Record<string, unknown>, title: string | null = null, subtitle: string | null = null): HomeSection =>
  ({ id, type, title, subtitle, config, background, spacing: 'medium', sort_order: sort, starts_at: null, ends_at: null, is_active: true });

const sections: HomeSection[] = [
  section('s1', 'hero', 1, 'green', {}),
  section('s2', 'marquee', 2, 'green', { words: ['Oud', 'Amber', 'Rose de Mai', 'Sandalwood', 'Bergamot', 'Vetiver', 'Iris', 'Musk', 'Leather', 'Saffron'] }),
  section('s3', 'category_tiles', 3, 'cream', { category_ids: [A(1), A(2), A(3)] }, 'Find the scent that *speaks for you*', 'Curated Collections'),
  section('s4', 'product_row', 4, 'green', { source: 'featured', limit: 6, layout: 'grid', filters: true, view_all: '/shop' }, 'Our most *coveted* bottles', 'The Signatures'),
  section('s5', 'image_text', 5, 'cream', { media_id: M(2), image_side: 'left', heading: 'A house built on *trust & taste*',
    body: 'The Fragrance Store was founded on a simple belief: that everyone in Sri Lanka deserves access to genuine, world-class perfumery — without compromise. Every bottle we offer is sourced from trusted distributors and inspected by hand.',
    badge_number: 100, badge_text: 'Authentic\nGuaranteed', button_text: 'Read our story', button_link: '/our-story',
    pillars: [{ icon: 'star', title: 'Authentic Only', text: 'Sealed, original bottles from verified sources.' }, { icon: 'truck', title: 'Island-wide Delivery', text: 'Carefully packed and delivered to your door.' }, { icon: 'chat', title: 'Personal Consultation', text: 'Expert guidance to find your signature.' }] }, 'A house built on *trust & taste*', 'Our Story'),
  section('s7', 'promo_banner', 7, 'green', { promotion_id: promotion.id, countdown: true, button_text: 'Shop the offer' }),
  section('s8', 'bundle_showcase', 8, 'green', { source: 'all' }, 'Two icons, *one gift*', 'Gift Sets'),
  section('s9', 'testimonials', 9, 'beige', { quotes: [
    { text: "The only place in Colombo I trust for genuine perfumes. The consultation helped me find a scent I now can't live without.", author: 'Customer name, Colombo' },
    { text: 'Beautifully packaged, delivered to Kandy within two days, and completely authentic. A truly premium experience.', author: 'Customer name, Kandy' },
    { text: 'They sourced a rare niche fragrance I had been searching for for months. Exceptional service from start to finish.', author: 'Customer name, Galle' },
  ] }, 'Loved by our *clientele*', 'Kind Words'),
  section('s10', 'gallery', 10, 'green', { media_ids: [M(1), M(4), M(2), M(5), M(3)] }, null, 'Follow the House'),
];

const demoAnnouncement = { id: 'a-1', text: 'Authentic fragrances only  ·  Island-wide delivery across Sri Lanka  ·  Enquire on WhatsApp  ·  Demo mode', link_url: null, background: 'gold' as const };

// ---------------------------------------------------------------------------
// Same signatures as lib/data.ts
// ---------------------------------------------------------------------------
export const demo = {
  settings: async () => ({ settings, bankAccounts, deliveryMethods }),
  nav: async () => ({
    categories: categories.map(({ id, name, slug, image_url, subtitle }) => ({ id, name, slug, image_url, subtitle })),
    brands: brands.map(({ id, name, slug, logo_url }) => ({ id, name, slug, logo_url })),
  }),
  products: async (f: ProductFilters) => {
    let list = [...products];
    if (f.q) for (const t of f.q.toLowerCase().split(/\s+/).filter(Boolean)) list = list.filter((p) => searchText(p).includes(t));
    if (f.category) list = list.filter((p) => p.category_slug === f.category);
    if (f.brand) list = list.filter((p) => p.brand_slug === f.brand);
    if (f.gender?.length) list = list.filter((p) => f.gender!.includes(p.gender));
    if (f.concentration?.length) list = list.filter((p) => f.concentration!.includes(p.concentration));
    if (f.size) list = list.filter((p) => p.sizes.includes(f.size!));
    if (f.min != null) list = list.filter((p) => p.min_price >= f.min!);
    if (f.max != null) list = list.filter((p) => p.min_price <= f.max!);
    if (f.featured) list = list.filter((p) => p.is_featured);
    if (f.onSale) list = list.filter((p) => p.on_sale);
    if (f.ids) list = list.filter((p) => f.ids!.includes(p.id));
    if (f.promotionId) list = list.filter((p) => p.promotion_id === f.promotionId);
    const sorters: Record<string, (a: StoreProduct, b: StoreProduct) => number> = {
      price_asc: (a, b) => a.min_price - b.min_price, price_desc: (a, b) => b.min_price - a.min_price,
      best: (a, b) => b.sales_count - a.sales_count, newest: (a, b) => b.created_at.localeCompare(a.created_at),
    };
    list.sort(sorters[f.sort ?? 'newest'] ?? sorters.newest);
    const perPage = f.perPage ?? 24;
    const page = Math.max(1, f.page ?? 1);
    return { products: list.slice((page - 1) * perPage, page * perPage), total: list.length, page, perPage };
  },
  facets: async () => ({ sizes: [...new Set(allVariants.map((v) => v.size_ml))].sort((a, b) => a - b), maxPrice: 55000 }),
  product: async (slug: string) => {
    const p = products.find((x) => x.slug === slug);
    if (!p) return { product: null, redirectTo: null };
    const inBundle = bundleItems.some((i) => allVariants.find((v) => v.id === i.variant_id)?.product_id === p.id);
    return {
      product: p,
      variants: allVariants.filter((v) => v.product_id === p.id).sort((a, b) => a.size_ml - b.size_ml),
      images: [{ id: `${p.id}-img`, storage_path: p.image_path!, alt_text: p.image_alt }],
      related: products.filter((x) => x.category_slug === p.category_slug && x.id !== p.id).slice(0, 4),
      bundles: inBundle ? [bundle] : [],
      redirectTo: null,
    };
  },
  category: async (slug: string) => categories.find((c) => c.slug === slug) ?? null,
  brand: async (slug: string) => brands.find((b) => b.slug === slug) ?? null,
  bundles: async (opts: { categoryId?: string; ids?: string[] } = {}) =>
    [bundle].filter((b) => (!opts.categoryId || b.category_id === opts.categoryId) && (!opts.ids || opts.ids.includes(b.id))),
  bundle: async (slug: string) => {
    if (slug !== bundle.slug) return null;
    return {
      bundle,
      images: [] as { storage_path: string; alt_text: string | null }[],
      items: bundleItems.map((i) => {
        const v = allVariants.find((x) => x.id === i.variant_id)!;
        const p = products.find((x) => x.id === v.product_id)!;
        return { quantity: i.quantity, size_ml: v.size_ml, name: p.name, slug: p.slug, brand: p.brand_name, price: v.effective_price, image_path: p.image_path };
      }),
    };
  },
  promotion: async (slug: string) => (slug === promotion.slug ? promotion : null),
  livePromotions: async () => [{ id: promotion.id, name: promotion.name, slug: promotion.slug, badge_text: promotion.badge_text, ends_at: promotion.ends_at, updated_at: promotion.updated_at }],
  livePromotionById: async (id: string) => (id === promotion.id ? promotion : null),
  cms: async () => ({ banners, sections, announcement: demoAnnouncement, media: mediaMap as Record<string, { storage_path: string; alt_text: string | null; width: number | null; height: number | null }> }),
  media: async (ids: string[]) => Object.fromEntries(ids.filter((id) => mediaMap[id]).map((id) => [id, mediaMap[id]])) as Record<string, { storage_path: string; alt_text: string | null; width: number | null; height: number | null }>,
  announcement: async () => demoAnnouncement,
  sitemap: async () => ({
    products: products.map((p) => ({ slug: p.slug, updated_at: p.updated_at })),
    categories: categories.map((c) => ({ slug: c.slug, updated_at: c.updated_at })),
    brands: brands.map((b) => ({ slug: b.slug, updated_at: b.updated_at })),
    promotions: [{ slug: promotion.slug, updated_at: promotion.updated_at }],
    bundles: [{ slug: bundle.slug, updated_at: bundle.updated_at }],
  }),
};

/** Builds a cart (same shape as the get_cart RPC) from demo cart lines kept in browser storage */
export function demoCart(lines: { variantId?: string; bundleId?: string; quantity: number }[]) {
  const items = lines.flatMap((l, i): CartLine[] => {
    if (l.variantId) {
      const v = allVariants.find((x) => x.id === l.variantId);
      if (!v) return [];
      const p = products.find((x) => x.id === v.product_id)!;
      return [{ id: `demo-${i}`, kind: 'variant' as const, variant_id: v.id, quantity: l.quantity, added_at: iso(0), price_at_add: v.effective_price,
        name: p.name, slug: p.slug, brand: p.brand_name, size_ml: v.size_ml, image_path: p.image_path, unit_price: v.effective_price, base_price: v.price,
        badge_text: v.badge_text, stock: v.stock_qty, available: v.stock_qty > 0, items: [] }];
    }
    if (l.bundleId === bundle.id) {
      return [{ id: `demo-${i}`, kind: 'bundle' as const, bundle_id: bundle.id, quantity: l.quantity, added_at: iso(0), price_at_add: bundle.effective_price,
        name: bundle.name, slug: bundle.slug, brand: 'Bundle', size_ml: null, image_path: bundle.item_images?.[0] ?? null, unit_price: bundle.effective_price, base_price: bundle.price,
        badge_text: null, stock: bundle.available, max_per_order: bundle.max_per_order, available: bundle.available > 0,
        items: bundleItems.map((bi) => { const v = allVariants.find((x) => x.id === bi.variant_id)!; return { name: products.find((p) => p.id === v.product_id)!.name, size_ml: v.size_ml, quantity: bi.quantity }; }) }];
    }
    return [];
  });
  return <Cart>{
    items, orders: [],
    subtotal: items.reduce((s2, l) => s2 + l.unit_price * l.quantity, 0),
    count: items.reduce((s2, l) => s2 + l.quantity, 0),
  };
}

export function demoStock(variantId?: string, bundleId?: string) {
  if (variantId) { const v = allVariants.find((x) => x.id === variantId); return v ? { stock: v.stock_qty, max: null as number | null, name: `${products.find((p) => p.id === v.product_id)!.name} ${v.size_ml}ml` } : null; }
  if (bundleId === bundle.id) return { stock: bundle.available, max: bundle.max_per_order, name: bundle.name };
  return null;
}
