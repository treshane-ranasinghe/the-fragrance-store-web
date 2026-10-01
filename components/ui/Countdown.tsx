'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

/** "Ends in 2d 5h" */
export function Countdown({ endsAt, className = '' }: { endsAt: string; className?: string }) {
  const t = useTranslations('countdown');
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className={className}>&nbsp;</span>;
  const left = new Date(endsAt).getTime() - now;
  if (left <= 0) return <span className={className}>{t('ended')}</span>;
  const { d, h, m, s } = parts(left);
  const text = d > 0 ? t('dhm', { d, h, m }) : t('hms', { h, m, s });
  return <span className={className} suppressHydrationWarning>{t('endsIn', { time: text })}</span>;
}
