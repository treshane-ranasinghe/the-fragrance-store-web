'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export function CopyButton({ value, label }: { value: string; label?: string }) {
  const t = useTranslations('copy');
  label ??= t('copy');
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="copy-btn" aria-label={`${label} ${value}`}
      onClick={async () => { try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } }}>
      {done ? t('copied') : label}
    </button>
  );
}
