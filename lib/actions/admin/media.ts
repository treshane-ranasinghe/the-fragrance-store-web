'use server';
import { requireAdmin, refreshStore } from '@/lib/admin';
import { fail } from './result';

export async function registerMediaAction(files: { path: string; name: string; width: number; height: number; size: number; alt?: string }[]) {
  const { supabase, user } = await requireAdmin();
  const { data, error } = await supabase.from('media_assets').insert(files.map((f) => ({
    storage_path: f.path, file_name: f.name, width: f.width || null, height: f.height || null, size_bytes: f.size, alt_text: f.alt ?? null, uploaded_by: user.id,
  }))).select('*');
  if (error) return { error: fail(error)?.error };
  return { assets: data };
}

export async function listMediaAction(search = '') {
  const { supabase } = await requireAdmin();
  let q = supabase.from('media_assets').select('*').order('created_at', { ascending: false }).order('file_name').limit(120);
  if (search) q = q.or(`file_name.ilike.%${search.replace(/[%,()]/g, '')}%,alt_text.ilike.%${search.replace(/[%,()]/g, '')}%`);
  const { data } = await q;
  return data ?? [];
}

export async function updateMediaAltAction(id: string, alt: string) {
  const { supabase } = await requireAdmin();
  await supabase.from('media_assets').update({ alt_text: alt || null }).eq('id', id);
  refreshStore(['cms']);
  return { ok: true };
}

/** Deleting an image that is in use is blocked, with a list of where it's used */
export async function deleteMediaAction(id: string) {
  const { supabase } = await requireAdmin();
  const { data: usage } = await supabase.from('admin_media_usage').select('kind, label').eq('media_id', id);
  const { data: asset } = await supabase.from('media_assets').select('storage_path').eq('id', id).single();
  // Category / brand images store the path directly
  const [{ count: c1 }, { count: c2 }] = await Promise.all([
    supabase.from('categories').select('id', { count: 'exact', head: true }).eq('image_url', asset?.storage_path ?? ''),
    supabase.from('brands').select('id', { count: 'exact', head: true }).eq('logo_url', asset?.storage_path ?? ''),
  ]);
  const used = [...(usage ?? []).map((u) => `${u.kind}: ${u.label}`), ...(c1 ? ['A category image'] : []), ...(c2 ? ['A brand logo'] : [])];
  if (used.length) return { error: `This image is in use — ${used.join('; ')}` };
  const { error } = await supabase.from('media_assets').delete().eq('id', id);
  if (error) return { error: fail(error)?.error };
  if (asset) await supabase.storage.from('cms-media').remove([asset.storage_path]);
  return { ok: true };
}

/** Older uploads have no size stored — the admin measures them in the browser and saves it here */
export async function saveMediaDimensionsAction(id: string, width: number, height: number) {
  const { supabase } = await requireAdmin();
  if (!(width > 0 && height > 0)) return { ok: false };
  await supabase.from('media_assets').update({ width: Math.round(width), height: Math.round(height) }).eq('id', id).is('width', null);
  return { ok: true };
}
