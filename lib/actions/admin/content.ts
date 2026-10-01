'use server';
import { redirect } from 'next/navigation';
import { refreshStore, requireAdmin } from '@/lib/admin';
import { parseSectionConfig, SECTION_TYPES, type SectionType } from '@/lib/cms-schemas';
import { MAX_LIVE_HEROES } from '@/lib/config';
import { slugify } from '@/lib/format';
import { bool, dt, fail, num, optStr, str, type AdminState } from './result';

const LINK_TYPES = ['promotion', 'bundle', 'product', 'category', 'brand', 'url'];
const linkType = (fd: FormData, k: string) => (LINK_TYPES.includes(str(fd, k)) ? str(fd, k) : null);

function checkDates(starts: string | null, ends: string | null) {
  if (starts && ends && new Date(ends) <= new Date(starts)) return 'The end date must be after the start date';
  return null;
}

// ---------------------------------------------------------------------------
// Hero banners
// ---------------------------------------------------------------------------
export async function saveHeroAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'id');
  const row = {
    internal_name: str(fd, 'internal_name'), desktop_media_id: optStr(fd, 'desktop_media_id'), mobile_media_id: optStr(fd, 'mobile_media_id'),
    alt_text: str(fd, 'alt_text'), eyebrow: optStr(fd, 'eyebrow'), headline: optStr(fd, 'headline'), subheading: optStr(fd, 'subheading'),
    button1_text: optStr(fd, 'button1_text'), button1_link_type: linkType(fd, 'button1_link_type'), button1_link_target: optStr(fd, 'button1_link_target'),
    button2_text: optStr(fd, 'button2_text'), button2_link_type: linkType(fd, 'button2_link_type'), button2_link_target: optStr(fd, 'button2_link_target'),
    text_position: str(fd, 'text_position') || 'left', overlay: str(fd, 'overlay') || 'medium', text_colour: str(fd, 'text_colour') || 'cream',
    starts_at: dt(fd, 'starts_at'), ends_at: dt(fd, 'ends_at'), is_active: bool(fd, 'is_active'),
    ghost_word: optStr(fd, 'ghost_word')?.toUpperCase().slice(0, 12) ?? null,
    tint: /^#[0-9a-f]{6}$/i.test(str(fd, 'tint')) ? str(fd, 'tint') : '#C6A566',
    feature_product_id: optStr(fd, 'feature_product_id'),
  };
  if (!row.internal_name) return { error: 'Enter an internal name' };
  if (!row.desktop_media_id) return { error: 'Choose a desktop image' };
  if (!row.alt_text) return { error: 'Enter the image alt text' };
  const dateErr = checkDates(row.starts_at, row.ends_at);
  if (dateErr) return { error: dateErr };
  // New banners go to the top so they show straight away (only the first 5 live banners are shown)
  if (!id) {
    const { data } = await supabase.from('hero_banners').select('sort_order').order('sort_order', { ascending: true }).limit(1);
    Object.assign(row, { sort_order: (data?.[0]?.sort_order ?? 1) - 1 });
  }
  const res = id ? await supabase.from('hero_banners').update(row).eq('id', id).select('id').single() : await supabase.from('hero_banners').insert(row).select('id').single();
  if (res.error) return fail(res.error);
  refreshStore(['cms'], ['/']);
  const { data: live } = await supabase.from('live_hero_banners').select('id, internal_name').order('sort_order');
  const pos = (live ?? []).findIndex((b) => b.id === res.data.id);
  if (pos >= MAX_LIVE_HEROES) return { ok: `Banner saved, but it is NOT on the homepage: only the first ${MAX_LIVE_HEROES} live banners are shown and this one is number ${pos + 1}. Drag it higher in the list, or hide another banner.`, id: res.data.id };
  const dropped = (live ?? []).slice(MAX_LIVE_HEROES).map((b) => `“${b.internal_name}”`);
  return { ok: `Banner saved — the homepage updates within seconds.${dropped.length ? ` Only ${MAX_LIVE_HEROES} banners are shown, so ${dropped.join(', ')} ${dropped.length > 1 ? 'are' : 'is'} no longer on the homepage.` : ''}`, id: res.data.id };
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
export async function saveAnnouncementAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'id');
  const row = {
    text: str(fd, 'text'), link_url: optStr(fd, 'link_url'), background: str(fd, 'background') || 'gold',
    starts_at: dt(fd, 'starts_at'), ends_at: dt(fd, 'ends_at'), is_active: bool(fd, 'is_active'),
  };
  if (!row.text) return { error: 'Enter the announcement text' };
  if (row.text.length > 120) return { error: 'Keep it under ~90 characters so it fits on phones' };
  const dateErr = checkDates(row.starts_at, row.ends_at);
  if (dateErr) return { error: dateErr };
  const { error } = id ? await supabase.from('announcements').update(row).eq('id', id) : await supabase.from('announcements').insert(row);
  if (error) return fail(error);
  refreshStore(['cms'], ['/']);
  return { ok: 'Announcement saved.' };
}

// ---------------------------------------------------------------------------
// Homepage sections
// ---------------------------------------------------------------------------
function sectionConfigFromForm(type: SectionType, fd: FormData) {
  const list = (k: string) => fd.getAll(k).map(String).filter(Boolean);
  switch (type) {
    case 'product_row': return {
      source: str(fd, 'source') || 'new', product_ids: list('product_ids'), category_slug: optStr(fd, 'category_slug') ?? undefined,
      brand_slug: optStr(fd, 'brand_slug') ?? undefined, promotion_id: optStr(fd, 'promotion_id') ?? undefined,
      limit: num(fd, 'limit') ?? 8, layout: str(fd, 'layout') || 'grid', view_all: optStr(fd, 'view_all') ?? undefined,
      filters: bool(fd, 'filters'),
    };
    case 'promo_banner': return {
      promotion_id: str(fd, 'promotion_id'), countdown: bool(fd, 'countdown'), button_text: str(fd, 'button_text') || 'Shop the sale',
      media_id: optStr(fd, 'media_id') ?? undefined, image_fit: str(fd, 'image_fit') === 'contain' ? 'contain' : 'cover',
    };
    case 'bundle_showcase': return { source: str(fd, 'source') || 'all', bundle_ids: list('bundle_ids') };
    case 'category_tiles': return { category_ids: list('category_ids') };
    case 'brand_strip': return { brand_ids: list('brand_ids') };
    case 'image_text': return {
      media_id: optStr(fd, 'media_id') ?? undefined, image_side: str(fd, 'image_side') || 'left', heading: str(fd, 'heading'), body: str(fd, 'body'),
      button_text: optStr(fd, 'button_text') ?? undefined, button_link: optStr(fd, 'button_link') ?? undefined,
      badge_number: num(fd, 'badge_number') ?? undefined, badge_text: optStr(fd, 'badge_text')?.replace(/\r\n?/g, '\n') ?? undefined,
      pillars: [0, 1, 2, 3].map((i) => ({ icon: str(fd, `pillar_icon_${i}`) || 'star', title: str(fd, `pillar_title_${i}`), text: str(fd, `pillar_text_${i}`) })).filter((x) => x.title),
    };
    case 'text': return { heading: str(fd, 'heading'), body: str(fd, 'body') };
    case 'marquee': return { words: str(fd, 'words').split(/\n|,/).map((w) => w.trim()).filter(Boolean) };
    case 'notes': return { items: [0, 1, 2].map((i) => ({ title: str(fd, `note_title_${i}`), time: str(fd, `note_time_${i}`), text: str(fd, `note_text_${i}`) })) };
    case 'testimonials': return { quotes: [0, 1, 2, 3, 4].map((i) => ({ text: str(fd, `quote_text_${i}`), author: str(fd, `quote_author_${i}`) })).filter((q) => q.text) };
    case 'gallery': return { media_ids: [0, 1, 2, 3, 4].map((i) => str(fd, `gallery_${i}`)).filter(Boolean) };
    case 'visit': return { body: str(fd, 'body'), media_id: optStr(fd, 'media_id') ?? undefined };
    case 'trust_badges': return {
      badges: [0, 1, 2, 3].map((i) => ({ icon: str(fd, `badge_icon_${i}`) || 'shield', text: str(fd, `badge_text_${i}`) })).filter((b) => b.text),
    };
    default: return {};
  }
}

export async function saveSectionAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'id');
  const type = str(fd, 'type') as SectionType;
  if (!(type in SECTION_TYPES)) return { error: 'Unknown section type' };
  const parsed = parseSectionConfig(type, sectionConfigFromForm(type, fd));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: `Check the section settings: ${issue.path.join('.') || 'config'} — ${issue.message}` };
  }
  const row = {
    type, title: optStr(fd, 'title'), subtitle: optStr(fd, 'subtitle'), config: parsed.data,
    background: str(fd, 'background') || 'cream', spacing: str(fd, 'spacing') || 'medium',
    starts_at: dt(fd, 'starts_at'), ends_at: dt(fd, 'ends_at'), is_active: bool(fd, 'is_active'),
  };
  const dateErr = checkDates(row.starts_at, row.ends_at);
  if (dateErr) return { error: dateErr };
  if (!id) {
    if (type === 'hero') {
      const { count } = await supabase.from('home_sections').select('id', { count: 'exact', head: true }).eq('type', 'hero');
      if (count) return { error: 'There is already a hero slideshow section (only one allowed).' };
    }
    const { data } = await supabase.from('home_sections').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    Object.assign(row, { sort_order: type === 'hero' ? 0 : (data?.[0]?.sort_order ?? 0) + 1 });
  }
  const res = id ? await supabase.from('home_sections').update(row).eq('id', id).select('id').single() : await supabase.from('home_sections').insert(row).select('id').single();
  if (res.error) return fail(res.error);
  refreshStore(['cms'], ['/']);
  return { ok: 'Section saved.', id: res.data.id };
}

export async function duplicateSectionAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('home_sections').select('*').eq('id', str(fd, 'id')).single();
  if (data && data.type !== 'hero') {
    const { id: _id, created_at: _c, updated_at: _u, ...copy } = data;
    await supabase.from('home_sections').insert({ ...copy, title: copy.title ? `${copy.title} (copy)` : null, is_active: false, sort_order: copy.sort_order + 1 });
  }
  refreshStore(['cms'], ['/']);
}

/** Copies a hero banner or announcement as a hidden draft, so it can be edited before going live */
export async function duplicateContentAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  const table = str(fd, 'table');
  if (table !== 'hero_banners' && table !== 'announcements') return;
  const { data } = await supabase.from(table).select('*').eq('id', str(fd, 'id')).single();
  if (!data) return;
  const { id: _id, created_at: _c, updated_at: _u, ...copy } = data;
  if (table === 'hero_banners') {
    const { data: last } = await supabase.from('hero_banners').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    Object.assign(copy, { internal_name: `${copy.internal_name} (copy)`, sort_order: (last?.[0]?.sort_order ?? 0) + 1 });
  }
  await supabase.from(table).insert({ ...copy, is_active: false });
  refreshStore(['cms'], ['/']);
}

// ---------------------------------------------------------------------------
// Shared: toggle active / delete for content tables
// ---------------------------------------------------------------------------
const CONTENT_TABLES = ['hero_banners', 'announcements', 'home_sections', 'promotions', 'bundles'] as const;
type ContentTable = (typeof CONTENT_TABLES)[number];

export async function toggleActiveAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  const table = str(fd, 'table') as ContentTable;
  if (!CONTENT_TABLES.includes(table)) return;
  await supabase.from(table).update({ is_active: str(fd, 'active') === 'true' }).eq('id', str(fd, 'id'));
  refreshStore(table === 'promotions' || table === 'bundles' ? ['catalog', 'cms', 'bundles'] : ['cms'], ['/', '/bundles']);
}

export async function deleteContentAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  const table = str(fd, 'table') as ContentTable;
  if (!CONTENT_TABLES.includes(table)) return;
  const { error } = await supabase.from(table).delete().eq('id', str(fd, 'id'));
  // Referenced by orders (promotions / bundles) → deactivate instead
  if (error) await supabase.from(table).update({ is_active: false }).eq('id', str(fd, 'id'));
  refreshStore(['catalog', 'cms', 'bundles'], ['/', '/bundles']);
  const back = str(fd, 'back');
  if (back.startsWith('/admin')) redirect(back);
}

// ---------------------------------------------------------------------------
// Promotions
// ---------------------------------------------------------------------------
export async function savePromotionAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'id');
  const row = {
    name: str(fd, 'name'), slug: slugify(str(fd, 'slug') || str(fd, 'name')), description: optStr(fd, 'description'),
    desktop_media_id: optStr(fd, 'desktop_media_id'), mobile_media_id: optStr(fd, 'mobile_media_id'),
    discount_type: str(fd, 'discount_type') === 'amount' ? 'amount' : 'percent', discount_value: num(fd, 'discount_value') ?? 0,
    badge_text: optStr(fd, 'badge_text'), show_countdown: bool(fd, 'show_countdown'), include_bundles: bool(fd, 'include_bundles'),
    seo_title: optStr(fd, 'seo_title'), seo_description: optStr(fd, 'seo_description'),
    starts_at: dt(fd, 'starts_at'), ends_at: dt(fd, 'ends_at'), is_active: bool(fd, 'is_active'),
  };
  if (!row.name) return { error: 'Enter a name' };
  if (!row.starts_at || !row.ends_at) return { error: 'Start and end date-time are required' };
  const dateErr = checkDates(row.starts_at, row.ends_at);
  if (dateErr) return { error: dateErr };
  if (row.discount_value <= 0) return { error: 'Enter the discount' };
  if (row.discount_type === 'percent' && row.discount_value > 100) return { error: 'A percentage discount cannot be more than 100%' };

  const targets: { target_type: string; target_id: string | null; is_exclusion: boolean }[] = [];
  if (bool(fd, 'target_all')) targets.push({ target_type: 'all', target_id: null, is_exclusion: false });
  for (const t of ['category', 'brand', 'product', 'variant']) {
    for (const v of fd.getAll(`target_${t}`).map(String).filter(Boolean)) targets.push({ target_type: t, target_id: v, is_exclusion: false });
  }
  for (const t of ['product', 'brand']) {
    for (const v of fd.getAll(`exclude_${t}`).map(String).filter(Boolean)) targets.push({ target_type: t, target_id: v, is_exclusion: true });
  }
  if (!targets.some((t) => !t.is_exclusion)) return { error: 'Choose what the promotion applies to' };

  const res = id ? await supabase.from('promotions').update(row).eq('id', id).select('id').single() : await supabase.from('promotions').insert(row).select('id').single();
  if (res.error) return fail(res.error);
  const pid = res.data.id as string;
  await supabase.from('promotion_targets').delete().eq('promotion_id', pid);
  const { error: tErr } = await supabase.from('promotion_targets').insert(targets.map((t) => ({ ...t, promotion_id: pid })));
  if (tErr) return fail(tErr);

  // Prices are never lower than zero: block fixed discounts larger than a targeted price
  if (row.discount_type === 'amount') {
    const { data: minPrice } = await supabase.rpc('promotion_min_target_price', { p_promotion_id: pid });
    if (minPrice != null && row.discount_value > Number(minPrice)) {
      await supabase.from('promotions').update({ is_active: false }).eq('id', pid);
      refreshStore(['catalog', 'cms']);
      return { error: `The fixed discount (Rs. ${row.discount_value}) is larger than the cheapest product it applies to (Rs. ${minPrice}). Saved as Draft — lower the discount or change the products.`, id: pid };
    }
  }
  refreshStore(['catalog', 'cms', 'bundles'], [`/promotions/${row.slug}`, '/', '/shop']);
  return { ok: 'Promotion saved — prices update on the site within seconds.', id: pid };
}

// ---------------------------------------------------------------------------
// Bundles
// ---------------------------------------------------------------------------
export async function saveBundleAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'id');
  const row = {
    name: str(fd, 'name'), slug: slugify(str(fd, 'slug') || str(fd, 'name')), description: optStr(fd, 'description'),
    category_id: optStr(fd, 'category_id'), price: num(fd, 'price') ?? 0, max_per_order: num(fd, 'max_per_order') || null,
    seo_title: optStr(fd, 'seo_title'), seo_description: optStr(fd, 'seo_description'),
    starts_at: dt(fd, 'starts_at'), ends_at: dt(fd, 'ends_at'), is_active: bool(fd, 'is_active'),
  };
  if (!row.name) return { error: 'Enter a name' };
  if (row.price <= 0) return { error: 'Enter the bundle price' };
  const dateErr = checkDates(row.starts_at, row.ends_at);
  if (dateErr) return { error: dateErr };

  let items: { variant_id: string; quantity: number }[];
  try { items = JSON.parse(str(fd, 'items') || '[]'); } catch { return { error: 'Invalid items' }; }
  items = items.filter((i) => i.variant_id && i.quantity > 0);
  if (items.length < 1) return { error: 'Add at least one item' };
  if (new Set(items.map((i) => i.variant_id)).size !== items.length) return { error: 'Each product size can only be added once (increase the quantity instead)' };

  // Bundle price must not be higher than buying the items separately
  const { data: prices } = await supabase.from('product_variants').select('id, price').in('id', items.map((i) => i.variant_id));
  const itemsValue = items.reduce((s, i) => s + Number(prices?.find((p) => p.id === i.variant_id)?.price ?? 0) * i.quantity, 0);
  if (row.price > itemsValue) return { error: `The bundle price is higher than buying the items separately (Rs. ${itemsValue.toLocaleString('en-LK')}).` };

  const res = id ? await supabase.from('bundles').update(row).eq('id', id).select('id').single() : await supabase.from('bundles').insert(row).select('id').single();
  if (res.error) return fail(res.error);
  const bid = res.data.id as string;
  await supabase.from('bundle_items').delete().eq('bundle_id', bid);
  const { error: iErr } = await supabase.from('bundle_items').insert(items.map((i) => ({ ...i, bundle_id: bid })));
  if (iErr) return fail(iErr);
  refreshStore(['catalog', 'bundles', 'cms'], [`/bundle/${row.slug}`, '/bundles', '/']);
  const saving = itemsValue - row.price;
  return {
    ok: saving < itemsValue * 0.05 ? `Bundle saved. Warning: the saving (Rs. ${saving.toLocaleString('en-LK')}) is under 5%.` : 'Bundle saved.',
    id: bid,
  };
}

export async function saveBundleImagesAction(bundleId: string, images: { storage_path: string; alt_text: string }[], removed: string[]) {
  const { supabase } = await requireAdmin();
  if (removed.length) {
    const { data } = await supabase.from('bundle_images').select('storage_path').in('id', removed);
    await supabase.from('bundle_images').delete().in('id', removed);
    if (data?.length) await supabase.storage.from('product-images').remove(data.map((d) => d.storage_path));
  }
  if (images.length) {
    const { data: last } = await supabase.from('bundle_images').select('sort_order').eq('bundle_id', bundleId).order('sort_order', { ascending: false }).limit(1);
    let n = (last?.[0]?.sort_order ?? -1) + 1;
    await supabase.from('bundle_images').insert(images.map((i) => ({ ...i, bundle_id: bundleId, sort_order: n++ })));
  }
  refreshStore(['bundles', 'catalog']);
  return { ok: true };
}
