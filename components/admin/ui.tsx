import Link from 'next/link';

export function PageHeader({ title, subtitle, actions, back }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        {back ? <Link href={back.href} className="text-sm">← {back.label}</Link> : null}
        <h1 className="text-[28px] md:text-[36px]">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-brand-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ title, children, className = '', actions }: { title?: string; children: React.ReactNode; className?: string; actions?: React.ReactNode }) {
  return (
    <section className={`card p-5 ${className}`}>
      {title || actions ? <div className="mb-4 flex items-center justify-between gap-3">{title ? <h2 className="font-serif text-xl font-semibold text-brand-green md:text-2xl">{title}</h2> : <span />}{actions}</div> : null}
      {children}
    </section>
  );
}

export function StatCard({ label, value, href, tone }: { label: string; value: React.ReactNode; href?: string; tone?: 'warning' | 'error' }) {
  const inner = (
    <>
      <p className="text-xs uppercase tracking-wider text-brand-muted">{label}</p>
      <p className={`mt-1 font-serif text-3xl font-semibold ${tone === 'error' ? 'text-state-error' : tone === 'warning' ? 'text-state-warning' : 'text-brand-green'}`}>{value}</p>
    </>
  );
  return href ? <Link href={href} className="card block p-4 no-underline hover:shadow-card">{inner}</Link> : <div className="card p-4">{inner}</div>;
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-card border border-dashed border-brand-beige p-6 text-center text-sm text-brand-muted">{children}</p>;
}

export function ContentStatus({ is_active, starts_at, ends_at, draftLabel = 'Hidden' }: { is_active: boolean; starts_at: string | null; ends_at: string | null; draftLabel?: string }) {
  const now = Date.now();
  let label = 'Live', cls = 'bg-state-success/10 text-state-success';
  if (!is_active) { label = draftLabel; cls = 'bg-brand-muted/10 text-brand-muted'; }
  else if (ends_at && new Date(ends_at).getTime() <= now) { label = 'Ended'; cls = 'bg-state-error/10 text-state-error'; }
  else if (starts_at && new Date(starts_at).getTime() > now) { label = 'Scheduled'; cls = 'bg-state-warning/10 text-state-warning'; }
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

/** datetime-local value in Sri Lanka time */
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return '';
  const d = new Date(new Date(iso).getTime() + 5.5 * 3600_000);
  return d.toISOString().slice(0, 16);
}
