import { MediaLibrary } from '@/components/admin/MediaLibrary';
import { PageHeader } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin';

export const metadata = { title: 'Media library' };

export default async function MediaPage() {
  const { supabase } = await requireAdmin();
  const [{ data: assets }, { data: usage }, { data: cats }, { data: brands }] = await Promise.all([
    supabase.from('media_assets').select('*').order('created_at', { ascending: false }).order('file_name'),
    supabase.from('admin_media_usage').select('*'),
    supabase.from('categories').select('name, image_url'),
    supabase.from('brands').select('name, logo_url'),
  ]);
  const rows = (assets ?? []).map((a) => ({
    ...a,
    used: [
      ...(usage ?? []).filter((u) => u.media_id === a.id).map((u) => `${u.kind} “${u.label}”`),
      ...(cats ?? []).filter((c) => c.image_url === a.storage_path).map((c) => `Category “${c.name}”`),
      ...(brands ?? []).filter((b) => b.logo_url === a.storage_path).map((b) => `Brand “${b.name}”`),
    ],
  }));
  return (
    <div>
      <PageHeader title="Media library" subtitle="All banner and content images. Reuse them in hero banners, sections, promotions, categories and brands." />
      <MediaLibrary assets={rows} />
    </div>
  );
}
