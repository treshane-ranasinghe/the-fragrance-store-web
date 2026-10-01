import { Link } from '@/i18n/navigation';
import { Fragment } from 'react';

/**
 * Tiny, safe formatter for admin-written text blocks: paragraphs, **bold**, *italic*,
 * [links](/path) and "- " bullet lists. No raw HTML is ever rendered.
 */
function inline(text: string, keyBase: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)\s]+\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const t = m[0];
    const key = `${keyBase}-${i++}`;
    if (t.startsWith('**')) out.push(<strong key={key}>{t.slice(2, -2)}</strong>);
    else if (t.startsWith('[')) {
      const [, label, href] = /\[([^\]]+)\]\(([^)]+)\)/.exec(t)!;
      const safe = /^(\/|https?:\/\/|mailto:|tel:)/.test(href) ? href : '#';
      out.push(safe.startsWith('/') ? <Link key={key} href={safe} className="underline">{label}</Link>
        : <a key={key} href={safe} className="underline" rel="noopener noreferrer">{label}</a>);
    } else out.push(<em key={key}>{t.slice(1, -1)}</em>);
    last = m.index + t.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function RichText({ text, className = '' }: { text: string | null | undefined; className?: string }) {
  if (!text) return null;
  const blocks = text.replace(/\r/g, '').split(/\n{2,}/);
  return (
    <div className={`space-y-4 ${className}`}>
      {blocks.map((b, bi) => {
        const lines = b.split('\n');
        if (lines.every((l) => /^\s*[-*]\s+/.test(l))) {
          return <ul key={bi} className="list-disc space-y-1 pl-5">{lines.map((l, li) => <li key={li}>{inline(l.replace(/^\s*[-*]\s+/, ''), `${bi}-${li}`)}</li>)}</ul>;
        }
        return <p key={bi}>{lines.map((l, li) => <Fragment key={li}>{li > 0 ? <br /> : null}{inline(l, `${bi}-${li}`)}</Fragment>)}</p>;
      })}
    </div>
  );
}
