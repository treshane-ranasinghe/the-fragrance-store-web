'use client';
import { useEffect, useState } from 'react';
import { saveMediaDimensionsAction } from '@/lib/actions/admin/media';
import { createClient } from '@/lib/supabase/client';
import { cmsImage } from '@/lib/storage';

export const MAX_UPLOAD = 5 * 1024 * 1024;
const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

export function readDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { resolve({ width: 0, height: 0 }); URL.revokeObjectURL(url); };
    img.src = url;
  });
}

/** Uploads straight to Supabase Storage (admins only by storage policy) */
export async function uploadImage(bucket: 'product-images' | 'cms-media', file: File, folder: string) {
  if (!TYPES.includes(file.type)) throw new Error(`${file.name}: use JPG, PNG, WebP or AVIF`);
  if (file.size > MAX_UPLOAD) throw new Error(`${file.name} is larger than 5 MB`);
  const safe = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/-+/g, '-');
  const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}-${safe}`;
  const { error } = await createClient().storage.from(bucket).upload(path, file, { cacheControl: '31536000', upsert: false });
  if (error) throw error;
  const dims = await readDimensions(file);
  return { path, ...dims, size: file.size, name: file.name };
}

/** Width/height of a library image; measures (and saves) older uploads that have none stored */
export function useMediaDims(m: { id: string; storage_path: string; width: number | null; height: number | null } | null) {
  const [dims, setDims] = useState<{ width: number | null; height: number | null }>({ width: m?.width ?? null, height: m?.height ?? null });
  useEffect(() => {
    setDims({ width: m?.width ?? null, height: m?.height ?? null });
    if (!m || (m.width && m.height)) return;
    const url = cmsImage(m.storage_path);
    if (!url) return;
    let live = true;
    const img = new window.Image();
    img.onload = () => {
      if (!live || !img.naturalWidth) return;
      setDims({ width: img.naturalWidth, height: img.naturalHeight });
      saveMediaDimensionsAction(m.id, img.naturalWidth, img.naturalHeight).catch(() => {});
    };
    img.src = url;
    return () => { live = false; };
  }, [m?.id, m?.storage_path, m?.width, m?.height]); // eslint-disable-line react-hooks/exhaustive-deps
  return dims;
}
