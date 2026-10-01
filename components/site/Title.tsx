import { Fragment } from 'react';

/** "Find the scent that *speaks for you*" → the starred words become the italic gold <em> */
export function Title({ text }: { text: string | null | undefined }) {
  if (!text) return null;
  const parts = text.split(/(\*[^*]+\*)/g).filter(Boolean);
  return <>{parts.map((p, i) => (p.startsWith('*') && p.endsWith('*') ? <em key={i}>{p.slice(1, -1)}</em> : <Fragment key={i}>{p}</Fragment>))}</>;
}

export const plain = (text: string | null | undefined) => (text ?? '').replace(/\*/g, '');
