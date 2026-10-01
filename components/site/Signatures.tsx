'use client';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import type { StoreProduct } from '@/lib/types';
import { ProductCard } from './ProductCard';
import { useSite, waLink } from './SiteContext';
import { Title } from './Title';

export const TABS = [['all', 'tabAll'], ['him', 'tabHim'], ['her', 'tabHer'], ['arabian', 'tabArabian']] as const;
export type Tab = (typeof TABS)[number][0];

export function matchesTab(p: Pick<StoreProduct, 'gender' | 'category_slug'>, tab: Tab) {
  if (tab === 'all') return true;
  if (tab === 'him') return p.gender === 'men' || p.gender === 'unisex';
  if (tab === 'her') return p.gender === 'women' || p.gender === 'unisex';
  return p.category_slug === 'arabian';
}

/** Homepage "Signatures": filter tabs + search / count / sort, filtered instantly in the browser */
export function Signatures({ products, eyebrow, title, filters, viewAll }: { products: StoreProduct[]; eyebrow?: string | null; title?: string | null; filters: boolean; viewAll?: string }) {
  const site = useSite();
  const t = useTranslations();
  const tl = useTranslations('listing');
  const [tab, setTab] = useState<Tab>('all');
  const [q, setQ] = useState('');
  const [sort, setSort] = useState('featured');
  const shown = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = products.filter((p) => {
      const text = [p.brand_name, p.name, p.concentration, ...(p.top_notes ?? []), ...(p.middle_notes ?? []), ...(p.base_notes ?? [])].join(' ').toLowerCase();
      return matchesTab(p, tab) && words.every((w) => text.includes(w));
    });
    if (sort === 'price-asc') list.sort((a, b) => a.min_price - b.min_price);
    if (sort === 'price-desc') list.sort((a, b) => b.min_price - a.min_price);
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, tab, q, sort]);

  return (
    <section className="section section--dark" id="signatures">
      <div className="container">
        <header className="section__head section__head--row reveal">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            {title ? <h2 className="section__title"><Title text={title} /></h2> : null}
          </div>
          {filters ? (
            <div className="filters" role="tablist" aria-label={tl('filterLabel')}>
              {TABS.map(([k, l]) => (
                <button key={k} className={`filter${tab === k ? ' is-active' : ''}`} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{tl(l)}</button>
              ))}
            </div>
          ) : null}
        </header>
        {filters ? (
          <div className="shopbar reveal">
            <label className="shopbar__search">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
              <span className="sr-only">{tl('search')}</span>
              <input type="search" placeholder={tl('searchPlaceholder')} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <p className="shopbar__count" aria-live="polite">{t('common.fragrances', { count: shown.length })}</p>
            <label className="shopbar__sort">
              <span>{tl('sort')}</span>
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="featured">{tl('featured')}</option><option value="price-asc">{tl('priceAsc')}</option>
                <option value="price-desc">{tl('priceDesc')}</option><option value="name">{tl('nameAz')}</option>
              </select>
            </label>
          </div>
        ) : null}
        <div className="products">
          {shown.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 2} />)}
          {!shown.length ? (
            <div className="products__empty">
              <h3>{tl('nothing')}</h3>
              <p>{tl.rich('sourceOnRequest', { link: (c) => <a href={waLink(site.whatsapp, t('wa.lookingFor'))} target="_blank" rel="noopener noreferrer">{c}</a> })}</p>
            </div>
          ) : null}
        </div>
        <p className="products__note reveal">
          {viewAll ? <><Link href={viewAll}>{tl('seeFull')}</Link> · </> : null}
          {tl.rich('cantFind', { link: (c) => <a href={waLink(site.whatsapp, t('wa.lookingForSpecific'))} target="_blank" rel="noopener noreferrer">{c}</a> })}
        </p>
      </div>
    </section>
  );
}
