'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

export function Quotes({ quotes }: { quotes: { text: string; author: string }[] }) {
  const t = useTranslations('sections');
  const [i, setI] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    if (quotes.length < 2) return;
    const t = setInterval(() => setI((x) => (x + 1) % quotes.length), 6000);
    return () => clearInterval(t);
  }, [quotes.length, tick]);
  return (
    <>
      <div className="quotes">
        {quotes.map((q, k) => (
          <figure key={k} className={`quote${k === i ? ' is-active' : ''}`} aria-hidden={k !== i}>
            <blockquote>“{q.text.replace(/^[“"]|[”"]$/g, '')}”</blockquote>
            {q.author ? <figcaption>— {q.author}</figcaption> : null}
          </figure>
        ))}
      </div>
      {quotes.length > 1 ? (
        <div className="quotes__dots" role="tablist" aria-label={t('testimonials')}>
          {quotes.map((_, k) => <button key={k} role="tab" aria-label={t('testimonial', { n: k + 1 })} aria-selected={k === i} onClick={() => { setI(k); setTick((t) => t + 1); }} />)}
        </div>
      ) : null}
    </>
  );
}
