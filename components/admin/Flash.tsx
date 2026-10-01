'use client';
import { useEffect, useState } from 'react';

const EVENT = 'admin-flash';

/** Shows a short confirmation that outlives the form that sent it (e.g. a table row that disappears after saving) */
export function flash(message: string) {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: message }));
}

export function FlashHost() {
  const [msgs, setMsgs] = useState<{ id: number; text: string }[]>([]);
  useEffect(() => {
    const on = (e: Event) => {
      const id = Date.now() + Math.random();
      setMsgs((m) => [...m, { id, text: (e as CustomEvent<string>).detail }]);
      setTimeout(() => setMsgs((m) => m.filter((x) => x.id !== id)), 6000);
    };
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  if (!msgs.length) return null;
  return (
    <div className="fixed bottom-4 right-4 z-50 flex max-w-sm flex-col gap-2" role="status" aria-live="polite">
      {msgs.map((m) => <p key={m.id} className="rounded-btn bg-brand-green px-4 py-3 text-sm text-white shadow-lg">✓ {m.text}</p>)}
    </div>
  );
}
