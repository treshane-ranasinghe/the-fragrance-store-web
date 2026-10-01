import Image from 'next/image';
import { ContentRowActions } from '@/components/admin/ContentRowActions';
import { HeroForm } from '@/components/admin/HeroForm';
import type { Media } from '@/components/admin/MediaPicker';
import { SortableList } from '@/components/admin/SortableList';
import { Card, ContentStatus, Empty, PageHeader } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin';
import { MAX_LIVE_HEROES } from '@/lib/config';
import { getLinkOptions } from '@/lib/admin-options';
import { formatDateTime } from '@/lib/format';
import { cmsImage } from '@/lib/storage';

export const metadata = { title: 'Hero banners' };

export default async function HeroPage({ searchParams }: { searchParams: Promise<{ edit?: string }> }) {
  const { edit } = await searchParams;
  const { supabase } = await requireAdmin();
  const [{ data: banners }, options, { data: products }] = await Promise.all([supabase.from('hero_banners').select('*').order('sort_order'), getLinkOptions(supabase), supabase.from('products').select('id, name').is('deleted_at', null).order('name')]);
  const ids = (banners ?? []).flatMap((b) => [b.desktop_media_id, b.mobile_media_id]).filter(Boolean);
  const { data: media } = ids.length ? await supabase.from('media_assets').select('*').in('id', ids) : { data: [] };
  const m = (id: string | null) => (media ?? []).find((x) => x.id === id) as Media | undefined;
  const editing = (banners ?? []).find((b) => b.id === edit);
  // Same rule as the homepage: only the first MAX_LIVE_HEROES live banners (in list order) are shown
  const now = Date.now();
  const liveIds = (banners ?? []).filter((b) => b.is_active && (!b.starts_at || new Date(b.starts_at).getTime() <= now) && (!b.ends_at || new Date(b.ends_at).getTime() > now)).map((b) => b.id);
  const cutOff = new Set(liveIds.slice(MAX_LIVE_HEROES));

  // While editing, the editor sits at the top so it's visible straight after clicking Edit
  const editor = (
    <Card title={editing ? `Edit: ${editing.internal_name}` : 'Add a banner'} actions={editing ? <a href="?" className="text-sm">Cancel</a> : null}>
      <HeroForm key={editing?.id ?? 'new'} banner={editing} desktop={editing ? m(editing.desktop_media_id) : null} mobile={editing ? m(editing.mobile_media_id) : null} options={options} products={products ?? []} />
    </Card>
  );

  return (
    <div className="max-w-5xl space-y-6">
      <PageHeader title="Hero banners" subtitle={`The first ${MAX_LIVE_HEROES} live banners in this list rotate every 4 seconds (each gets a thumbnail in the corner). New banners are added at the top. Drag to change the order.`}
        actions={<a href="/api/draft?redirect=/" target="_blank" className="btn-secondary btn-sm no-underline">Preview homepage</a>} />
      {editing ? editor : null}
      <Card title="Banners" actions={<span className="text-xs text-brand-muted">Drag to reorder</span>}>
        {!banners?.length ? <Empty>No banners yet — the default banner from settings is shown.</Empty> : (
          <SortableList table="hero_banners" items={banners.map((b) => ({
            id: b.id, node: (
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative h-16 w-28 overflow-hidden rounded bg-brand-cream">{m(b.desktop_media_id) ? <Image src={cmsImage(m(b.desktop_media_id)!.storage_path)!} alt="" fill sizes="112px" className="object-cover" /> : null}</div>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{b.id === edit ? <span className="mr-2 rounded-full bg-brand-gold/20 px-2 py-0.5 text-xs">Editing</span> : null}{b.internal_name} <ContentStatus is_active={b.is_active} starts_at={b.starts_at} ends_at={b.ends_at} />{cutOff.has(b.id) ? <span className="ml-2 inline-flex rounded-full bg-state-warning/10 px-2.5 py-0.5 text-xs font-medium text-state-warning" title="Drag it higher, or hide another banner">Not on site — only the first {MAX_LIVE_HEROES} live banners show</span> : null}</p>
                  <p className="text-sm text-brand-muted">{b.ghost_word ?? b.headline ?? '—'} <span className="ml-1 inline-block h-3 w-3 rounded-full align-middle" style={{ background: b.tint ?? '#C6A566' }} /></p>
                  <p className="text-xs text-brand-muted">{b.starts_at || b.ends_at ? `${formatDateTime(b.starts_at)} → ${formatDateTime(b.ends_at)}` : 'Always on'}</p>
                </div>
                <a href={`?edit=${b.id}`} className="text-sm underline">Edit</a>
                <ContentRowActions table="hero_banners" id={b.id} active={b.is_active} duplicate />
              </div>
            ),
          }))} />
        )}
      </Card>
      {editing ? null : editor}
    </div>
  );
}
