'use client';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import { listMediaAction, registerMediaAction } from '@/lib/actions/admin/media';
import { cmsImage } from '@/lib/storage';
import { MEDIA_SLOTS, slotHint, slotIssues, type MediaSlot } from '@/lib/media-sizes';
import { uploadImage, useMediaDims } from './uploads';

export interface Media { id: string; storage_path: string; file_name: string; alt_text: string | null; width: number | null; height: number | null }

/** Any image field: upload new, or choose from the media library. Submits the media id (or storage path) as a hidden input. */
export function MediaPicker({ name, initial, valueKind = 'id', label, hint, slot }: { name: string; initial?: Media | null; valueKind?: 'id' | 'path'; label: string; hint?: string; slot?: MediaSlot }) {
  const [media, setMedia] = useState<Media | null>(initial ?? null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const dims = useMediaDims(media);
  const issues = slot && media ? slotIssues(slot, dims.width, dims.height) : [];

  const upload = async (file: File) => {
    setBusy(true); setError('');
    try {
      const up = await uploadImage('cms-media', file, 'content');
      const res = await registerMediaAction([up]);
      if (res.error || !res.assets) throw new Error(res.error ?? 'Upload failed');
      setMedia(res.assets[0] as Media);
    } catch (e) { setError((e as Error).message); }
    setBusy(false);
  };

  return (
    <div>
      <span className="label">{label}</span>
      <input type="hidden" name={name} value={media ? (valueKind === 'id' ? media.id : media.storage_path) : ''} />
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative h-20 w-32 overflow-hidden rounded-btn border border-brand-beige bg-brand-cream">
          {media ? <Image src={cmsImage(media.storage_path)!} alt={media.alt_text ?? ''} fill sizes="128px" className="object-cover" /> : <span className="flex h-full items-center justify-center text-xs text-brand-muted">No image</span>}
        </div>
        <div className="flex flex-col gap-1 text-sm">
          <label className="btn-secondary btn-sm cursor-pointer">{busy ? 'Uploading…' : 'Upload new'}
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} /></label>
          <button type="button" className="underline" onClick={() => setOpen(true)}>Choose from library</button>
          {media ? <button type="button" className="text-left text-state-error underline" onClick={() => setMedia(null)}>Remove</button> : null}
        </div>
      </div>
      {media && dims.width && dims.height ? <p className="help mt-1">This image: {dims.width} × {dims.height} px{slot && !issues.length ? ' ✓ good fit' : ''}</p> : null}
      {issues.map((x) => <p key={x} className="mt-1 text-xs text-state-warning">⚠ {x}</p>)}
      {slot ? <p className="help mt-1">{slotHint(slot)}</p> : null}
      {hint ? <p className="help mt-1">{hint}</p> : null}
      {error ? <p className="error-text">{error}</p> : null}
      {open ? <LibraryDialog slot={slot} onClose={() => setOpen(false)} onPick={(m) => { setMedia(m); setOpen(false); }} /> : null}
    </div>
  );
}

function LibraryDialog({ slot, onClose, onPick }: { slot?: MediaSlot; onClose: () => void; onPick: (m: Media) => void }) {
  const [items, setItems] = useState<Media[]>([]);
  const [q, setQ] = useState('');
  useEffect(() => { const t = setTimeout(() => listMediaAction(q).then((d) => setItems(d as Media[])), 250); return () => clearTimeout(t); }, [q]);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Media library">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-card bg-white p-5">
        <div className="mb-4 flex items-center gap-3">
          <input className="input input-sm" placeholder="Search by name or alt text" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          <button type="button" className="btn-secondary btn-sm" onClick={onClose}>Close</button>
        </div>
        {slot ? <p className="help mb-3">{MEDIA_SLOTS[slot].label}: best {MEDIA_SLOTS[slot].w} × {MEDIA_SLOTS[slot].h} px ({MEDIA_SLOTS[slot].ratio}). ✓ marks images that fit.</p> : null}
        <ul className="grid grid-cols-3 gap-3 md:grid-cols-5">
          {items.map((m) => <LibraryItem key={m.id} m={m} slot={slot} onPick={onPick} />)}
        </ul>
        {!items.length ? <p className="text-sm text-brand-muted">No images yet.</p> : null}
      </div>
    </div>
  );
}

function LibraryItem({ m, slot, onPick }: { m: Media; slot?: MediaSlot; onPick: (m: Media) => void }) {
  const dims = useMediaDims(m);
  const issues = slot ? slotIssues(slot, dims.width, dims.height) : [];
  return (
    <li><button type="button" onClick={() => onPick({ ...m, ...dims })} className="block w-full text-left">
      <span className="relative block aspect-square overflow-hidden rounded-btn bg-brand-cream"><Image src={cmsImage(m.storage_path)!} alt={m.alt_text ?? ''} fill sizes="150px" className="object-cover" /></span>
      <span className="mt-1 block truncate text-xs">{m.file_name}</span>
      <span className={`block text-xs ${issues.length ? 'text-state-warning' : 'text-brand-muted'}`} title={issues.join('\n')}>
        {dims.width && dims.height ? `${dims.width} × ${dims.height}` : 'Size unknown'}{slot && dims.width ? (issues.length ? ' ⚠' : ' ✓') : ''}
      </span>
    </button></li>
  );
}
