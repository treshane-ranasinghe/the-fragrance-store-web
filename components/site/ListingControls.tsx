'use client';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { concentrationLabel } from './labels';

const TABS = [
  ['all', 'tabAll', {}], ['him', 'tabHim', { gender: ['men', 'unisex'] }], ['her', 'tabHer', { gender: ['women', 'unisex'] }], ['arabian', 'tabArabian', { category: ['arabian'] }],
] as const;

/** Filter tabs + pill search / count / sort + refine selects, all kept in the URL (server-filtered, shareable) */
export function ListingControls({ total, brands, sizes, hide = [], showTabs = true }: {
  total: number; brands: { slug: string; name: string }[]; sizes: number[]; hide?: ('category' | 'brand')[]; showTabs?: boolean;
}) {
  const t = useTranslations();
  const tl = useTranslations('listing');
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [q, setQ] = useState(params.get('q') ?? '');
  useEffect(() => setQ(params.get('q') ?? ''), [params]);

  const push = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(params.toString());
    next.delete('page');
    mut(next);
    router.push(`${pathname}${next.toString() ? `?${next}` : ''}`, { scroll: false });
  };
  const genders = params.getAll('gender').sort().join(',');
  const active = params.get('category') === 'arabian' ? 'arabian' : genders === 'men,unisex' ? 'him' : genders === 'unisex,women' ? 'her' : genders || params.get('category') ? '' : 'all';

  return (
    <>
      {showTabs ? (
        <div className="filters listing__tabs" role="tablist" aria-label={tl('filterLabel')}>
          {TABS.filter(([k]) => !(k === 'arabian' && hide.includes('category'))).map(([k, l, set]) => (
            <button key={k} className={`filter${active === k ? ' is-active' : ''}`} role="tab" aria-selected={active === k}
              onClick={() => push((p) => {
                p.delete('gender'); if (!hide.includes('category')) p.delete('category');
                Object.entries(set).forEach(([key, vals]) => (vals as readonly string[]).forEach((v) => p.append(key, v)));
              })}>{tl(l)}</button>
          ))}
        </div>
      ) : null}
      <div className="shopbar">
        <form className="shopbar__search" role="search" onSubmit={(e) => { e.preventDefault(); push((p) => { if (q.trim()) p.set('q', q.trim()); else p.delete('q'); }); }}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
          <label htmlFor="listing-q" className="sr-only">{tl('search')}</label>
          <input id="listing-q" type="search" placeholder={tl('searchPlaceholder')} autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} />
        </form>
        <p className="shopbar__count" aria-live="polite">{t('common.fragrances', { count: total })}</p>
        <label className="shopbar__sort">
          <span>{tl('sort')}</span>
          <select value={params.get('sort') ?? 'newest'} onChange={(e) => push((p) => p.set('sort', e.target.value))}>
            <option value="newest">{tl('newest')}</option><option value="best">{tl('best')}</option>
            <option value="price_asc">{tl('priceAsc')}</option><option value="price_desc">{tl('priceDesc')}</option>
          </select>
        </label>
      </div>
      <div className="refine">
        {!hide.includes('brand') && brands.length ? (
          <label className="shopbar__sort"><span>{tl('house')}</span>
            <select value={params.get('brand') ?? ''} onChange={(e) => push((p) => { if (e.target.value) p.set('brand', e.target.value); else p.delete('brand'); })}>
              <option value="">{tl('allHouses')}</option>{brands.map((b) => <option key={b.slug} value={b.slug}>{b.name}</option>)}
            </select></label>
        ) : null}
        <label className="shopbar__sort"><span>{tl('type')}</span>
          <select value={params.get('concentration') ?? ''} onChange={(e) => push((p) => { p.delete('concentration'); if (e.target.value) p.set('concentration', e.target.value); })}>
            <option value="">{tl('allTypes')}</option>{['Parfum', 'EDP', 'EDT', 'Body Mist'].map((c) => <option key={c} value={c}>{concentrationLabel(c, t)}</option>)}
          </select></label>
        {sizes.length ? (
          <label className="shopbar__sort"><span>{t('common.size')}</span>
            <select value={params.get('size') ?? ''} onChange={(e) => push((p) => { if (e.target.value) p.set('size', e.target.value); else p.delete('size'); })}>
              <option value="">{tl('anySize')}</option>{sizes.map((s) => <option key={s} value={s}>{t('common.ml', { size: s })}</option>)}
            </select></label>
        ) : null}
        <label className="shopbar__sort"><span>{tl('price')}</span>
          <select value={`${params.get('min') ?? ''}-${params.get('max') ?? ''}`} onChange={(e) => push((p) => {
            const [mn, mx] = e.target.value.split('-'); p.delete('min'); p.delete('max'); if (mn) p.set('min', mn); if (mx) p.set('max', mx);
          })}>
            <option value="-">{tl('anyPrice')}</option><option value="-20000">{tl('under')}</option><option value="20000-40000">{tl('between')}</option>
            <option value="40000-">{tl('over')}</option>
          </select></label>
        {['brand', 'concentration', 'size', 'min', 'max', 'gender', 'q'].some((k) => params.has(k)) || (params.has('category') && !hide.includes('category')) ? (
          <button type="button" className="co__link refine__clear" onClick={() => router.push(pathname, { scroll: false })}>{tl('clearAll')}</button>
        ) : null}
      </div>
    </>
  );
}
