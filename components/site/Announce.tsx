'use client';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { useEffect, useState } from 'react';

const KEY = 'fs-announcement-closed';

/** Gold strip at the top; long text on desktop, short on phones. Visitors can close it for 24 hours. */
export function Announce({ id, text, short, link, background = 'gold' }: { id: string; text: string; short?: string | null; link?: string | null; background?: 'green' | 'gold' | 'beige' }) {
  const t = useTranslations('shell');
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem(KEY) || 'null') as { id: string; at: number } | null;
      if (v && v.id === id && Date.now() - v.at < 86_400_000) setHidden(true);
    } catch { /* storage unavailable */ }
  }, [id]);
  if (hidden) return null;
  const body = <><span className="announce__long">{text}</span><span className="announce__short">{short || text}</span></>;
  return (
    <div className={`announce announce--${background}`}>
      <p>{link ? <Link href={link}>{body}</Link> : body}</p>
      <button type="button" className="announce__close" aria-label={t('closeAnnouncement')}
        onClick={() => { setHidden(true); try { localStorage.setItem(KEY, JSON.stringify({ id, at: Date.now() })); } catch { /* ignore */ } }}>&times;</button>
    </div>
  );
}
