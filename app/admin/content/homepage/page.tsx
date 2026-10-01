import { ContentRowActions } from '@/components/admin/ContentRowActions';
import type { Media } from '@/components/admin/MediaPicker';
import { PreviewFrame } from '@/components/admin/PreviewFrame';
import { SectionForm } from '@/components/admin/SectionForm';
import { SortableList } from '@/components/admin/SortableList';
import { Card, ContentStatus, PageHeader } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin';
import { duplicateSectionAction } from '@/lib/actions/admin/content';
import { SECTION_TYPES, type SectionType } from '@/lib/cms-schemas';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Homepage' };

export default async function HomepageBuilder({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: sections }, products, categories, brands, promotions, bundles] = await Promise.all([
    supabase.from('home_sections').select('*').order('sort_order'),
    supabase.from('products').select('id, name').is('deleted_at', null).order('name'),
    supabase.from('categories').select('id, name, slug').order('sort_order'),
    supabase.from('brands').select('id, name, slug').order('name'),
    supabase.from('promotions').select('id, name').order('starts_at', { ascending: false }),
    supabase.from('bundles').select('id, name').order('name'),
  ]);
  const options = { products: products.data ?? [], categories: categories.data ?? [], brands: brands.data ?? [], promotions: promotions.data ?? [], bundles: bundles.data ?? [] };
  const editing = (sections ?? []).find((s) => s.id === edit);
  const mediaId = editing?.config?.media_id as string | undefined;
  const galleryIds = (Array.isArray(editing?.config?.media_ids) ? editing!.config.media_ids : []) as string[];
  const [{ data: media }, { data: gallery }] = await Promise.all([
    mediaId ? supabase.from('media_assets').select('*').eq('id', mediaId).maybeSingle() : Promise.resolve({ data: null }),
    galleryIds.length ? supabase.from('media_assets').select('*').in('id', galleryIds) : Promise.resolve({ data: [] }),
  ]);

  // While editing, the editor sits at the top so it's visible straight after clicking Edit
  const editor = (
    <Card title={editing ? `Edit: ${SECTION_TYPES[editing.type as SectionType]}${editing.title ? ` — ${editing.title}` : ''}` : 'Add a section'} actions={editing ? <a href="?" className="text-sm">Cancel</a> : null}>
      <SectionForm key={editing?.id ?? 'new'} section={editing} options={options} media={media as Media | null} galleryMedia={galleryIds.map((id) => ((gallery ?? []) as Media[]).find((m) => m.id === id) ?? null)} />
    </Card>
  );

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Homepage" subtitle="Build the homepage from sections. Drag to reorder; the hero slideshow is always at the top." actions={<PreviewFrame />} />
      {editing ? editor : null}
      <Card title="Sections">
        <SortableList table="home_sections" items={(sections ?? []).map((s) => ({
          id: s.id, node: (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{s.id === edit ? <span className="mr-2 rounded-full bg-brand-gold/20 px-2 py-0.5 text-xs">Editing</span> : null}{SECTION_TYPES[s.type as SectionType]}{s.title ? ` — ${s.title}` : ''} <ContentStatus is_active={s.is_active} starts_at={s.starts_at} ends_at={s.ends_at} /></p>
                <p className="text-xs text-brand-muted">{s.background} · {s.spacing}{s.starts_at || s.ends_at ? ` · ${formatDateTime(s.starts_at)} → ${formatDateTime(s.ends_at)}` : ''}</p>
              </div>
              <a href={`?edit=${s.id}`} className="text-sm underline">Edit</a>
              {s.type !== 'hero' ? <form action={duplicateSectionAction}><input type="hidden" name="id" value={s.id} /><button className="text-sm underline">Duplicate</button></form> : null}
              <ContentRowActions table="home_sections" id={s.id} active={s.is_active} />
            </div>
          ),
        }))} />
      </Card>
      {editing ? null : editor}
    </div>
  );
}
