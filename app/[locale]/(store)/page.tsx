import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { Hero, type HeroCopy, type HeroSlideData } from '@/components/site/Hero';
import { HomeSectionView } from '@/components/site/Sections';
import { getCms, getMediaByIds, getSettings, listProducts } from '@/lib/data';
import { getSiteInfo } from '@/lib/site';
import { JsonLd, organizationJsonLd } from '@/lib/seo/jsonld';
import { resolveLink } from '@/lib/cms-schemas';
import { cmsImage, productImage } from '@/lib/storage';
import { STORE_NAME } from '@/lib/config';
import { localeAlternates, pageLocale } from '@/i18n/server';

export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: { absolute: t('defaultTitle') }, description: t('homeDescription'), alternates: localeAlternates('/', locale) };
}

export default async function HomePage({ params }: Props) {
  await pageLocale(params);
  const [{ banners, sections, media }, { settings }, site, t] = await Promise.all([getCms(), getSettings(), getSiteInfo(), getTranslations('hero')]);
  const COPY: HeroCopy = {
    eyebrow: t('eyebrow'),
    lines: [t('line1'), t('line2'), t('line3')],
    lead: t('lead'),
    cta: { text: t('cta'), href: '/shop' },
  };

  // Products shown in the "Now Featuring" card
  const featureIds = banners.map((b) => b.feature_product_id).filter(Boolean) as string[];
  const { products: featured } = featureIds.length ? await listProducts({ ids: featureIds, perPage: 10 }) : { products: [] };

  let slides: HeroSlideData[] = banners.filter((b) => media[b.desktop_media_id]).map((b) => {
    const p = featured.find((x) => x.id === b.feature_product_id);
    return {
      id: b.id,
      desktop: cmsImage(media[b.desktop_media_id].storage_path)!,
      mobile: b.mobile_media_id && media[b.mobile_media_id] ? cmsImage(media[b.mobile_media_id].storage_path) : null,
      alt: b.alt_text,
      ghost: (b.ghost_word || b.headline || '').toUpperCase().slice(0, 10),
      tint: b.tint || '#C6A566',
      product: p ? { slug: p.slug, house: p.brand_name ?? '', name: p.name, notes: [...(p.top_notes ?? []), ...(p.middle_notes ?? []), ...(p.base_notes ?? [])] } : null,
      href: resolveLink(b.button1_link_type, b.button1_link_target),
    };
  });

  // No live banner → default image from settings, then the featured products, so the hero is never empty
  if (!slides.length && settings?.default_hero_media_id) {
    const m = (await getMediaByIds([settings.default_hero_media_id]))[settings.default_hero_media_id];
    if (m) slides = [{ id: 'default', desktop: cmsImage(m.storage_path)!, mobile: null, alt: m.alt_text || STORE_NAME, ghost: 'PARFUM', tint: '#C6A566', product: null, href: null }];
  }
  if (!slides.length) {
    const { products } = await listProducts({ featured: true, perPage: 5 }).catch(() => ({ products: [] }));
    slides = products.filter((p) => p.image_path).map((p) => ({
      id: p.id, desktop: productImage(p.image_path)!, mobile: null, alt: `${p.brand_name ?? ''} ${p.name}`, ghost: p.name.split(' ').pop()!.toUpperCase().slice(0, 10),
      tint: '#C6A566', product: { slug: p.slug, house: p.brand_name ?? '', name: p.name, notes: [...(p.top_notes ?? []), ...(p.middle_notes ?? []), ...(p.base_notes ?? [])] }, href: null,
    }));
  }

  const first = banners[0];
  const copy: HeroCopy = first?.headline ? { ...COPY, eyebrow: first.eyebrow || COPY.eyebrow, lead: first.subheading || COPY.lead } : COPY;

  return (
    <>
      <JsonLd data={organizationJsonLd(settings)} />
      {slides.length ? <Hero slides={slides} copy={copy} /> : null}
      {sections.filter((s) => s.type !== 'hero').map((s) => <HomeSectionView key={s.id} s={s} media={media} site={site} />)}
    </>
  );
}
