import { z } from 'zod';

/** Per-section-type config, checked on save (admin) and on render */
export const SECTION_TYPES = {
  hero: 'Hero slideshow',
  product_row: 'Product row / grid',
  promo_banner: 'Promotion banner',
  bundle_showcase: 'Bundle showcase',
  category_tiles: 'Category tiles',
  brand_strip: 'Brand strip',
  image_text: 'Image + text',
  text: 'Text block',
  trust_badges: 'Trust badges',
  marquee: 'Scent-notes marquee',
  notes: 'Art of Scent (notes pyramid)',
  testimonials: 'Testimonials',
  gallery: 'Gallery strip',
  visit: 'Visit the boutique',
} as const;
export type SectionType = keyof typeof SECTION_TYPES;

const uuid = z.string().uuid();

export const PRODUCT_SOURCES = {
  manual: 'Hand-picked products', category: 'A category', brand: 'A brand', promotion: 'A promotion',
  new: 'New arrivals', best: 'Best sellers', sale: 'On sale', featured: 'Featured',
} as const;

export const sectionConfigSchemas = {
  hero: z.object({}).passthrough(),
  product_row: z.object({
    source: z.enum(Object.keys(PRODUCT_SOURCES) as [keyof typeof PRODUCT_SOURCES, ...(keyof typeof PRODUCT_SOURCES)[]]),
    product_ids: z.array(uuid).optional(),
    category_slug: z.string().optional(),
    brand_slug: z.string().optional(),
    promotion_id: uuid.optional(),
    limit: z.coerce.number().int().min(4).max(12).default(8),
    layout: z.enum(['slider', 'grid']).default('grid'),
    view_all: z.string().optional(),
    filters: z.boolean().default(false),
  }),
  promo_banner: z.object({
    promotion_id: uuid,
    countdown: z.boolean().default(true),
    button_text: z.string().default('Shop the sale'),
    media_id: uuid.optional(),
    image_fit: z.enum(['cover', 'contain']).default('cover'),
  }),
  bundle_showcase: z.object({
    source: z.enum(['all', 'manual']).default('all'),
    bundle_ids: z.array(uuid).optional(),
  }),
  category_tiles: z.object({ category_ids: z.array(uuid).min(1) }),
  brand_strip: z.object({ brand_ids: z.array(uuid).min(1) }),
  image_text: z.object({
    media_id: uuid.optional(),
    image_side: z.enum(['left', 'right']).default('left'),
    heading: z.string().default(''),
    body: z.string().default(''),
    button_text: z.string().optional(),
    button_link: z.string().optional(),
    badge_number: z.coerce.number().int().min(0).max(100000).optional(),
    badge_text: z.string().optional(),
    pillars: z.array(z.object({ icon: z.string(), title: z.string().min(1), text: z.string().default('') })).max(4).optional(),
  }),
  text: z.object({ heading: z.string().default(''), body: z.string().default('') }),
  trust_badges: z.object({
    badges: z.array(z.object({ icon: z.string(), text: z.string().min(1) })).max(4),
  }),
  marquee: z.object({ words: z.array(z.string().min(1)).min(1).default(['Oud', 'Amber', 'Rose de Mai', 'Sandalwood', 'Bergamot', 'Vetiver', 'Iris', 'Musk', 'Leather', 'Saffron']) }),
  notes: z.object({
    items: z.array(z.object({ title: z.string(), time: z.string(), text: z.string() })).length(3).default([
      { title: 'Top Notes', time: 'The first 15 minutes', text: 'The opening overture — bright, fleeting and vivid. Citrus, bergamot, pink pepper and aromatic herbs that draw you in.' },
      { title: 'Heart Notes', time: 'Up to 4 hours', text: 'The soul of the perfume. Rose, jasmine, iris and spice unfold as the top notes fade, revealing its true character.' },
      { title: 'Base Notes', time: 'Lingers all day', text: "The lasting memory. Oud, amber, vanilla, musk and precious woods that stay on skin long after you've left the room." },
    ]),
  }),
  testimonials: z.object({ quotes: z.array(z.object({ text: z.string().min(1), author: z.string().default('') })).min(1) }),
  gallery: z.object({ media_ids: z.array(uuid).max(5).default([]) }),
  visit: z.object({ body: z.string().default(''), media_id: uuid.optional() }),
} satisfies Record<SectionType, z.ZodTypeAny>;

export const TRUST_ICONS = ['star', 'truck', 'chat', 'shield', 'cash', 'gift', 'heart', 'leaf', 'phone'];

type Schemas = typeof sectionConfigSchemas;
export type SectionConfig<T extends SectionType> = z.infer<Schemas[T]>;

export function parseSectionConfig<T extends SectionType>(type: T, config: unknown) {
  const schema = sectionConfigSchemas[type] as z.ZodType<SectionConfig<T>, z.ZodTypeDef, unknown>;
  return schema.safeParse(config ?? {});
}

/** Resolve a hero / section link picker value to a URL */
export function resolveLink(type: string | null, target: string | null) {
  if (!type || !target) return null;
  switch (type) {
    case 'promotion': return `/promotions/${target}`;
    case 'bundle': return `/bundle/${target}`;
    case 'product': return `/product/${target}`;
    case 'category': return `/category/${target}`;
    case 'brand': return `/brand/${target}`;
    default: return target;
  }
}
