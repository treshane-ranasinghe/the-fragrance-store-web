import { getTranslations } from 'next-intl/server';
import { Suspense } from 'react';
import { BundleCard, ProductCard } from '@/components/site/ProductCard';
import { ListingControls } from '@/components/site/ListingControls';
import { Link } from '@/i18n/navigation';
import { getFilterFacets, getNav, listProducts, type ProductFilters } from '@/lib/data';
import type { StoreBundle } from '@/lib/types';

export type SearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const many = (v: string | string[] | undefined) => (v == null ? [] : Array.isArray(v) ? v : [v]);
const num = (v: string | undefined) => (v && !Number.isNaN(Number(v)) ? Number(v) : undefined);

export function filtersFromParams(sp: SearchParams): ProductFilters {
  const sort = one(sp.sort);
  return {
    q: one(sp.q)?.slice(0, 80),
    category: one(sp.category),
    brand: one(sp.brand),
    gender: many(sp.gender).filter((g) => ['men', 'women', 'unisex'].includes(g)),
    concentration: many(sp.concentration),
    size: num(one(sp.size)),
    min: num(one(sp.min)),
    max: num(one(sp.max)),
    sort: (['newest', 'price_asc', 'price_desc', 'best'].includes(sort ?? '') ? sort : 'newest') as ProductFilters['sort'],
    page: num(one(sp.page)) ?? 1,
  };
}

/** Listing in the "Signatures" design, filtered on the server from URL params */
export async function ProductListing({ searchParams, fixed = {}, hide = [], bundles = [], basePath }:
  { searchParams: SearchParams; fixed?: ProductFilters; hide?: ('category' | 'brand')[]; bundles?: StoreBundle[]; basePath: string }) {
  const filters = { ...filtersFromParams(searchParams), ...fixed };
  const [{ products, total, page, perPage }, nav, facets, t] = await Promise.all([listProducts(filters), getNav(), getFilterFacets(), getTranslations()]);
  const pages = Math.max(1, Math.ceil(total / perPage));
  const showBundles = page === 1 && bundles.length > 0 && !filters.q;
  const pageHref = (p: number) => {
    const next = new URLSearchParams();
    for (const [k, v] of Object.entries(searchParams)) many(v).forEach((x) => next.append(k, x));
    next.set('page', String(p));
    return `${basePath}?${next.toString()}`;
  };

  return (
    <>
      <Suspense><ListingControls total={total + (showBundles ? bundles.length : 0)} brands={nav.brands} sizes={facets.sizes} hide={hide} showTabs={!hide.includes('category') || !fixed.gender} /></Suspense>
      <div className="products">
        {showBundles ? bundles.map((b) => <BundleCard key={b.id} b={b} />) : null}
        {products.map((p, i) => <ProductCard key={p.id} p={p} priority={i < 3} />)}
        {!products.length && !showBundles ? (
          <div className="products__empty">
            <h3>{t('listing.nothing')}</h3>
            <p>{t.rich('listing.nothingLead', { link: (c) => <Link href={basePath}>{c}</Link> })}</p>
          </div>
        ) : null}
      </div>
      {pages > 1 ? (
        <nav className="pager" aria-label={t('common.pagination')}>
          {page > 1 ? <Link href={pageHref(page - 1)} className="btn btn--ghost btn--sm" rel="prev">{t('common.previous')}</Link> : <span />}
          <span className="pager__n">{t('common.pageOf', { page, pages })}</span>
          {page < pages ? <Link href={pageHref(page + 1)} className="btn btn--ghost btn--sm" rel="next">{t('common.next')}</Link> : <span />}
        </nav>
      ) : null}
    </>
  );
}
