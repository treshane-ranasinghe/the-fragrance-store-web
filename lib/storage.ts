import { SUPABASE_URL } from '@/lib/config';

/** Public URL for a file in a public Supabase Storage bucket */
export function publicUrl(bucket: 'product-images' | 'cms-media', path: string | null | undefined) {
  if (!path) return null;
  if (/^https?:\/\//.test(path) || path.startsWith('/')) return path; // full URL or a file shipped in /public
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`;
}

export const productImage = (path: string | null | undefined) => publicUrl('product-images', path);
export const cmsImage = (path: string | null | undefined) => publicUrl('cms-media', path);
