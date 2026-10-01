import { useLocale, useTranslations } from 'next-intl';
import { getPathname, Link } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { SITE_URL } from '@/lib/config';
import { JsonLd } from '@/lib/seo/jsonld';
import { Title } from './Title';

/** Top of inner pages: breadcrumb (with BreadcrumbList JSON-LD), eyebrow, serif title with gold italic, intro */
export function PageHead({ crumbs, eyebrow, title, intro, children, center = false }: {
  crumbs: { name: string; href?: string }[]; eyebrow?: string | null; title: string; intro?: string | null; children?: React.ReactNode; center?: boolean;
}) {
  const t = useTranslations('common');
  const locale = useLocale() as Locale;
  const all = [{ name: t('home'), href: '/' }, ...crumbs];
  return (
    <header className={`page-head${center ? ' page-head--center' : ''}`}>
      <nav aria-label={t('breadcrumb')} className="crumbs">
        <ol>{all.map((c, i) => <li key={i}>{c.href && i < all.length - 1 ? <Link href={c.href}>{c.name}</Link> : <span aria-current="page">{c.name}</span>}</li>)}</ol>
      </nav>
      <JsonLd data={{ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: all.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, ...(c.href ? { item: `${SITE_URL}${getPathname({ href: c.href, locale })}` } : {}) })) }} />
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      {title ? <h1 className="section__title"><Title text={title} /></h1> : null}
      {intro ? <p className="page-head__intro">{intro}</p> : null}
      {children}
    </header>
  );
}
