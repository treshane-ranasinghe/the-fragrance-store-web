'use client';
import { useState } from 'react';

/** Preview on desktop and phone (Draft Mode shows scheduled / hidden content) */
export function PreviewFrame({ path = '/' }: { path?: string }) {
  const [open, setOpen] = useState(false);
  const [width, setWidth] = useState<'desktop' | 'phone'>('desktop');
  const [key, setKey] = useState(0);
  if (!open) return <button type="button" className="btn-secondary btn-sm" onClick={() => setOpen(true)}>Preview</button>;
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-forest/80 p-4" role="dialog" aria-modal="true" aria-label="Preview">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" className={`btn-sm rounded-btn ${width === 'desktop' ? 'bg-brand-gold text-brand-ink' : 'bg-white'}`} onClick={() => setWidth('desktop')}>Desktop</button>
        <button type="button" className={`btn-sm rounded-btn ${width === 'phone' ? 'bg-brand-gold text-brand-ink' : 'bg-white'}`} onClick={() => setWidth('phone')}>Phone</button>
        <button type="button" className="btn-sm rounded-btn bg-white" onClick={() => setKey((k) => k + 1)}>Reload</button>
        <a href={`/api/draft?redirect=${encodeURIComponent(path)}`} target="_blank" className="btn-sm rounded-btn bg-white no-underline">Open in new tab</a>
        <button type="button" className="btn-sm ml-auto rounded-btn bg-white" onClick={() => setOpen(false)}>Close</button>
      </div>
      <div className="flex flex-1 justify-center overflow-hidden">
        <iframe key={key} title="Store preview" src={`/api/draft?redirect=${encodeURIComponent(path)}`}
          className="h-full rounded-card bg-white" style={{ width: width === 'desktop' ? '100%' : 390 }} />
      </div>
    </div>
  );
}
