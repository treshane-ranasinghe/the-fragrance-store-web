import 'server-only';
import { getTranslations } from 'next-intl/server';
import { getCms, getMediaByIds, type HomeSection } from '@/lib/data';

type Defaults = Record<PageKey, Omit<HomeSection, 'id' | 'sort_order' | 'starts_at' | 'ends_at' | 'is_active'>>;

/** Default content for the sub pages, in the page language; if the homepage has a section of the same type, its (CMS-edited) content wins */
async function defaults(): Promise<Defaults> {
  const t = await getTranslations('defaults');
  return {
    story: {
      type: 'image_text', title: t('storyTitle'), subtitle: t('storyEyebrow'), background: 'cream', spacing: 'large',
      config: {
        media_id: '00000000-0000-4000-9000-000000000002', image_side: 'left', heading: t('storyTitle'),
        body: t('storyBody'),
        badge_number: 100, badge_text: t('storyBadge'),
        pillars: [
          { icon: 'star', title: t('pillar1Title'), text: t('pillar1Text') },
          { icon: 'truck', title: t('pillar2Title'), text: t('pillar2Text') },
          { icon: 'chat', title: t('pillar3Title'), text: t('pillar3Text') },
        ],
      },
    },
    notes: { type: 'notes', title: t('notesTitle'), subtitle: t('notesEyebrow'), background: 'green', spacing: 'large', config: {} },
    marquee: { type: 'marquee', title: null, subtitle: null, background: 'green', spacing: 'medium', config: { words: ['Oud', 'Amber', 'Rose de Mai', 'Sandalwood', 'Bergamot', 'Vetiver', 'Iris', 'Musk', 'Leather', 'Saffron'] } },
    testimonials: {
      type: 'testimonials', title: t('testimonialsTitle'), subtitle: t('testimonialsEyebrow'), background: 'beige', spacing: 'large',
      config: { quotes: [1, 2, 3].map((n) => ({ text: t(`quote${n}`), author: t(`quote${n}Author`) })) },
    },
    gallery: { type: 'gallery', title: null, subtitle: t('galleryEyebrow'), background: 'green', spacing: 'medium', config: {} },
  };
}

export type PageKey = 'story' | 'notes' | 'marquee' | 'testimonials' | 'gallery';

export async function getPageSections(keys: PageKey[]) {
  const [{ sections }, byKey] = await Promise.all([getCms().catch(() => ({ sections: [] as HomeSection[] })), defaults()]);
  const out = keys.map((k, i) => {
    const d = byKey[k];
    // The story page always shows the full story (the homepage one is a short teaser linking here)
    const fromCms = k === 'story' ? null : sections.find((s) => s.type === d.type);
    return { ...d, ...(fromCms ?? {}), id: `${k}-${i}`, sort_order: i, starts_at: null, ends_at: null, is_active: true } as HomeSection;
  });
  const ids = new Set<string>();
  for (const s of out) {
    const c = s.config as Record<string, unknown>;
    if (typeof c.media_id === 'string') ids.add(c.media_id);
    if (Array.isArray(c.media_ids)) (c.media_ids as string[]).forEach((id) => ids.add(id));
  }
  const media = ids.size ? await getMediaByIds([...ids]).catch(() => ({})) : {};
  return { sections: out, media };
}
