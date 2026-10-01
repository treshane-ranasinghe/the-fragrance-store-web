'use client';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { deleteMediaAction, registerMediaAction, updateMediaAltAction } from '@/lib/actions/admin/media';
import { LIBRARY_SLOTS, MEDIA_SLOTS, fitsSlot } from '@/lib/media-sizes';
import { cmsImage } from '@/lib/storage';
import { uploadImage, useMediaDims } from './uploads';

interface Asset { id: string; storage_path: string; file_name: string; alt_text: string | null; width: number | null; height: number | null; size_bytes: number | null; used: string[] }

export function MediaLibrary({ assets }: { assets: Asset[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [q, setQ] = useState('');

  const upload = async (files: FileList | File[]) => {
    setBusy(true); setMsg('');
    const done = [];
    for (const f of Array.from(files)) {
      try { done.push(await uploadImage('cms-media', f, 'content')); } catch (e) { setMsg((e as Error).message); }
    }
    if (done.length) { const r = await registerMediaAction(done); if (r.error) setMsg(r.error); }
    setBusy(false); router.refresh();
  };
  const shown = assets.filter((a) => !q || a.file_name.toLowerCase().includes(q.toLowerCase()) || (a.alt_text ?? '').toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-4">
      <SizeGuide />
      <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-brand-beige bg-white p-8 text-sm text-brand-muted hover:border-brand-gold">
        {busy ? 'Uploading…' : 'Drag and drop images here, or click to choose (multiple allowed · max 5 MB each)'}
        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && upload(e.target.files)} />
      </label>
      {msg ? <p role="alert" className="text-sm text-state-error">{msg}</p> : null}
      <input className="input input-sm max-w-xs" placeholder="Search by name or alt text" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-5">
        {shown.map((a) => <MediaTile key={a.id} a={a} onChange={() => router.refresh()} />)}
      </ul>
    </div>
  );
}

function MediaTile({ a, onChange }: { a: Asset; onChange: () => void }) {
  const [alt, setAlt] = useState(a.alt_text ?? '');
  const [err, setErr] = useState('');
  const { width, height } = useMediaDims(a);
  const fits = LIBRARY_SLOTS.filter((s) => fitsSlot(s, width, height)).map((s) => MEDIA_SLOTS[s].label);
  return (
    <li className="card overflow-hidden text-xs">
      <div className="relative aspect-video bg-brand-cream"><Image src={cmsImage(a.storage_path)!} alt={a.alt_text ?? ''} fill sizes="240px" className="object-cover" /></div>
      <div className="space-y-1 p-2">
        <p className="truncate font-medium" title={a.file_name}>{a.file_name}</p>
        <p className="text-brand-muted">{width && height ? `${width} × ${height} px` : 'Size unknown'}{a.size_bytes ? ` · ${Math.round(a.size_bytes / 1024)} KB` : ''}</p>
        {width && height ? <p className={fits.length ? 'text-state-success' : 'text-state-warning'}>{fits.length ? `Fits: ${fits.join(', ')}` : 'Doesn’t match a recommended size — may crop or look soft'}</p> : null}
        <input className="input input-sm" value={alt} onChange={(e) => setAlt(e.target.value)} onBlur={() => alt !== (a.alt_text ?? '') && updateMediaAltAction(a.id, alt)} placeholder="Alt text" aria-label="Alt text" />
        <p className="text-brand-muted">{a.used.length ? `Used in: ${a.used.join(', ')}` : 'Not used'}</p>
        <button type="button" className="text-state-error underline" onClick={async () => {
          if (!confirm('Delete this image?')) return;
          const r = await deleteMediaAction(a.id);
          if (r.error) setErr(r.error); else onChange();
        }}>Delete</button>
        {err ? <p className="text-state-error">{err}</p> : null}
      </div>
    </li>
  );
}

function SizeGuide() {
  return (
    <details className="card p-4 text-sm" open>
      <summary className="cursor-pointer font-medium">Image size guide</summary>
      <p className="help mt-2">Upload at the “best” size for sharp images on all screens. Smaller than the minimum looks blurry; a different shape gets cropped. JPG/PNG/WebP, max 5 MB each.</p>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="text-brand-muted"><tr><th className="py-1 pr-3">Used for</th><th className="pr-3">Best size</th><th className="pr-3">Minimum</th><th className="pr-3">Shape</th><th>Tip</th></tr></thead>
          <tbody>
            {(Object.keys(MEDIA_SLOTS) as (keyof typeof MEDIA_SLOTS)[]).map((k) => { const s = MEDIA_SLOTS[k]; return (
              <tr key={k} className="border-t border-brand-beige align-top">
                <td className="py-1.5 pr-3 font-medium">{s.label}</td>
                <td className="whitespace-nowrap pr-3">{s.w} × {s.h} px</td>
                <td className="whitespace-nowrap pr-3">{s.minW} × {s.minH} px</td>
                <td className="pr-3">{s.ratio}</td>
                <td className="text-brand-muted">{s.tip}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
    </details>
  );
}
