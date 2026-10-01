/**
 * Recommended image sizes for every image slot, worked out from how the storefront
 * actually crops each image (see app/styles.css / app/store.css). Shown in the admin
 * next to every image field and in the media library.
 */
export type MediaSlot =
  | 'hero_desktop' | 'hero_mobile' | 'promo_desktop' | 'promo_mobile' | 'promo_side' | 'image_text' | 'visit'
  | 'gallery' | 'category' | 'brand_logo' | 'product' | 'bundle';

export interface SlotSpec {
  label: string;
  /** Ideal upload size */
  w: number; h: number;
  /** Smallest size that still looks sharp */
  minW: number; minH: number;
  ratio: string;
  tip: string;
}

export const MEDIA_SLOTS: Record<MediaSlot, SlotSpec> = {
  hero_desktop: { label: 'Hero banner — desktop', w: 1800, h: 1500, minW: 1400, minH: 1150, ratio: '6:5',
    tip: 'Fills the right two-thirds of the screen at full height; the left edge fades into the headline. Keep the bottle in the centre-right.' },
  hero_mobile: { label: 'Hero banner — mobile', w: 1080, h: 1920, minW: 750, minH: 1334, ratio: '9:16',
    tip: 'Full-screen portrait; the bottom ~40% sits under the headline. Keep the bottle in the top half.' },
  promo_desktop: { label: 'Promotion banner', w: 2400, h: 900, minW: 1600, minH: 600, ratio: '8:3',
    tip: 'Wide strip, dimmed with text on the left. Put the subject on the right.' },
  promo_mobile: { label: 'Promotion banner — mobile', w: 1080, h: 1350, minW: 750, minH: 940, ratio: '4:5',
    tip: 'Not shown on the storefront yet — the desktop banner is used on phones too.' },
  promo_side: { label: 'Promotion banner — right-side photo', w: 1200, h: 900, minW: 800, minH: 600, ratio: '4:3',
    tip: 'Sits on the right of the homepage promotion banner; its left edge fades into the text. A bottle on a dark background, or a transparent PNG (choose “Show the whole image”), works best.' },
  image_text: { label: 'Image + text section', w: 1200, h: 1500, minW: 800, minH: 1000, ratio: '4:5', tip: 'Portrait frame beside the text.' },
  visit: { label: 'Visit / boutique photo', w: 1200, h: 1500, minW: 800, minH: 1000, ratio: '4:5',
    tip: 'Portrait on desktop, cropped wider on phones — keep the subject centred.' },
  gallery: { label: 'Gallery tile', w: 1000, h: 1000, minW: 600, minH: 600, ratio: '1:1', tip: 'Square tiles.' },
  category: { label: 'Category tile', w: 900, h: 1200, minW: 600, minH: 800, ratio: '3:4',
    tip: 'Portrait tile; the tall tile crops a little more off the sides — keep the subject centred.' },
  brand_logo: { label: 'Brand logo', w: 600, h: 300, minW: 300, minH: 150, ratio: '2:1', tip: 'PNG or WebP with a transparent background.' },
  product: { label: 'Product photo', w: 1600, h: 2000, minW: 1000, minH: 1250, ratio: '4:5',
    tip: 'Product cards crop slightly to 5:6 — leave space around the bottle. First photo is the main one.' },
  bundle: { label: 'Bundle photo', w: 1600, h: 2000, minW: 1000, minH: 1250, ratio: '4:5', tip: 'Same as product photos.' },
};

/** Slots that live in the media library (product/bundle photos are uploaded on their own pages) */
export const LIBRARY_SLOTS: MediaSlot[] = ['hero_desktop', 'hero_mobile', 'promo_desktop', 'promo_side', 'image_text', 'visit', 'gallery', 'category', 'brand_logo'];

export const slotHint = (slot: MediaSlot) => {
  const s = MEDIA_SLOTS[slot];
  return `Best: ${s.w} × ${s.h} px (${s.ratio}) · min ${s.minW} × ${s.minH} px · JPG/PNG/WebP, max 5 MB. ${s.tip}`;
};

const ratioOf = (s: SlotSpec) => s.w / s.h;

/** Problems with an image for a slot (empty = good fit). Unknown dimensions → no verdict. */
export function slotIssues(slot: MediaSlot, width: number | null | undefined, height: number | null | undefined): string[] {
  if (!width || !height) return [];
  const s = MEDIA_SLOTS[slot];
  const out: string[] = [];
  if (width < s.minW || height < s.minH) out.push(`Too small (${width} × ${height} px) — may look blurry; use at least ${s.minW} × ${s.minH} px`);
  const off = (width / height) / ratioOf(s);
  if (off > 1.2 || off < 1 / 1.2) out.push(`Shape is ${width > height ? 'wider' : 'taller'} than ${s.ratio} — parts will be cropped off`);
  return out;
}

export const fitsSlot = (slot: MediaSlot, w: number | null | undefined, h: number | null | undefined) => !!w && !!h && slotIssues(slot, w, h).length === 0;
