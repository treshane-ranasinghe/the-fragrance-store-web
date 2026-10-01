'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ProductImage } from '@/components/ui/ProductImage';
import { addProductImagesAction, updateProductImagesAction } from '@/lib/actions/admin/catalog';
import { uploadImage } from './uploads';

interface Img { id: string; storage_path: string; alt_text: string | null }

/** Upload (drag and drop, multiple), reorder, alt text, delete */
export function ProductImages({ productId, productName, images: initial }: { productId: string; productName: string; images: Img[] }) {
  const router = useRouter();
  const [images, setImages] = useState(initial);
  const [removed, setRemoved] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [drag, setDrag] = useState<number | null>(null);
  const dirty = removed.length > 0 || images.some((img, i) => img.alt_text !== initial.find((x) => x.id === img.id)?.alt_text || initial[i]?.id !== img.id);

  const upload = async (files: FileList | File[]) => {
    setBusy(true); setMsg('');
    try {
      const done = [];
      for (const f of Array.from(files)) {
        const up = await uploadImage('product-images', f, productId);
        done.push({ storage_path: up.path, alt_text: productName });
      }
      const r = await addProductImagesAction(productId, done);
      if (r && 'error' in r && r.error) throw new Error(r.error);
      router.refresh();
      setMsg(`${done.length} image(s) uploaded`);
    } catch (e) { setMsg((e as Error).message); }
    setBusy(false);
  };

  // Keep local state in sync after a refresh (new uploads)
  useEffect(() => { setImages(initial); setRemoved([]); }, [initial]);

  return (
    <section id="photos" className="card scroll-mt-6 p-5">
      <h2 className="mb-3 font-serif text-xl font-semibold text-brand-green">Photos</h2>
      {!images.length ? <p className="mb-3 rounded-btn bg-state-warning/10 p-3 text-sm text-state-warning">No photos yet — add at least one. The first photo is the main image shown in the shop.</p> : null}
      <label onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files.length) upload(e.dataTransfer.files); }}
        className="flex cursor-pointer flex-col items-center justify-center rounded-card border-2 border-dashed border-brand-beige p-6 text-sm text-brand-muted hover:border-brand-gold">
        {busy ? 'Uploading…' : 'Drop images here or click to upload (JPG, PNG, WebP · max 5 MB) — best 1600 × 2000 px (4:5 portrait), min 1000 × 1250 px'}
        <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => e.target.files && upload(e.target.files)} />
      </label>
      {msg ? <p className="mt-2 text-sm">{msg}</p> : null}
      <ul className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((img, i) => (
          <li key={img.id} draggable onDragStart={() => setDrag(i)} onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (drag == null || drag === i) return; setImages((cur) => { const n = [...cur]; const [m] = n.splice(drag, 1); n.splice(i, 0, m); return n; }); setDrag(null); }}
            className="rounded-btn border border-brand-beige bg-white p-2">
            <div className="relative aspect-square cursor-move overflow-hidden rounded-btn bg-brand-cream"><ProductImage path={img.storage_path} alt={img.alt_text ?? ''} sizes="200px" /></div>
            {i === 0 ? <p className="mt-1 text-xs font-medium text-brand-gold-dark">Main image</p> : null}
            <input className="input input-sm mt-2" value={img.alt_text ?? ''} placeholder="Alt text" aria-label="Alt text"
              onChange={(e) => setImages((cur) => cur.map((x) => (x.id === img.id ? { ...x, alt_text: e.target.value } : x)))} />
            <div className="mt-1 flex justify-between text-xs">
              <span className="flex gap-2">
                <button type="button" disabled={i === 0} onClick={() => setImages((c) => { const n = [...c]; [n[i - 1], n[i]] = [n[i], n[i - 1]]; return n; })} aria-label="Move left">←</button>
                <button type="button" disabled={i === images.length - 1} onClick={() => setImages((c) => { const n = [...c]; [n[i + 1], n[i]] = [n[i], n[i + 1]]; return n; })} aria-label="Move right">→</button>
              </span>
              <button type="button" className="text-state-error underline" onClick={() => { setRemoved((r) => [...r, img.id]); setImages((c) => c.filter((x) => x.id !== img.id)); }}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {dirty ? (
        <button type="button" className="btn-primary btn-sm mt-4" disabled={busy} onClick={async () => {
          setBusy(true);
          await updateProductImagesAction(productId, images.map((x) => ({ id: x.id, alt_text: x.alt_text ?? '' })), removed);
          setRemoved([]); setBusy(false); setMsg('Images saved'); router.refresh();
        }}>Save image order &amp; alt text</button>
      ) : null}
    </section>
  );
}
