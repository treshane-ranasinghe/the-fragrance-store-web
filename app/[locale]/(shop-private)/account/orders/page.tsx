import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { OrderCard } from '@/components/site/OrderCard';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/server';
import { createClient } from '@/lib/supabase/server';
import type { OrderStatus } from '@/lib/types';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ status?: string; year?: string; q?: string; page?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('orders') };
}

const FILTERS = { all: null, progress: ['pending', 'on_hold', 'processing', 'shipped'], completed: ['delivered', 'completed'], cancelled: ['cancelled', 'returned'] } as const;
const LABELS = { all: 'filterAll', progress: 'filterProgress', completed: 'filterCompleted', cancelled: 'filterCancelled' } as const;

export default async function OrdersPage({ params, searchParams }: Props) {
  await pageLocale(params);
  const [sp, t] = await Promise.all([searchParams, getTranslations()]);
  const status = (sp.status && sp.status in FILTERS ? sp.status : 'all') as keyof typeof FILTERS;
  const page = Math.max(1, Number(sp.page) || 1);
  const supabase = await createClient();
  let q = supabase.from('my_order_history').select('*', { count: 'exact' }).order('created_at', { ascending: false });
  if (FILTERS[status]) q = q.in('status', FILTERS[status] as unknown as string[]);
  if (sp.year && /^\d{4}$/.test(sp.year)) q = q.gte('created_at', `${sp.year}-01-01`).lt('created_at', `${Number(sp.year) + 1}-01-01`);
  if (sp.q) { const s = sp.q.replace(/[%,()]/g, ' ').trim(); if (s) q = q.or(`order_number.ilike.%${s}%,product_names.ilike.%${s}%`); }
  const { data: orders, count } = await q.range((page - 1) * 10, page * 10 - 1);
  const ids = (orders ?? []).map((o) => o.id);
  const { data: items } = ids.length ? await supabase.from('order_items').select('order_id, product_name, size_ml, quantity, image_path, line_total').in('order_id', ids).is('parent_item_id', null) : { data: [] };
  const pages = Math.max(1, Math.ceil((count ?? 0) / 10));
  const year = new Date().getFullYear();
  const qs = (p: Record<string, string | undefined>) => '/account/orders?' + new URLSearchParams(Object.entries({ status, year: sp.year, q: sp.q, ...p }).filter(([, v]) => v && v !== 'all') as [string, string][]).toString();

  return (
    <div>
      <div className="ac__filterbar">
        <div className="filters" role="tablist">
          {(Object.keys(FILTERS) as (keyof typeof FILTERS)[]).map((k) => <Link key={k} href={qs({ status: k, page: undefined })} className={`filter${status === k ? ' is-active' : ''}`}>{t(`account.${LABELS[k]}`)}</Link>)}
        </div>
        <form className="shopbar__search" role="search">
          <input type="hidden" name="status" value={status === 'all' ? '' : status} />
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" /></svg>
          <label htmlFor="oq" className="sr-only">{t('account.searchOrders')}</label>
          <input id="oq" name="q" type="search" defaultValue={sp.q} placeholder={t('account.searchPlaceholder')} />
        </form>
        <form className="shopbar__sort"><input type="hidden" name="status" value={status === 'all' ? '' : status} />
          <span>{t('account.year')}</span>
          <select name="year" defaultValue={sp.year ?? ''} aria-label={t('account.year')}>
            <option value="">{t('account.allYears')}</option>{[0, 1, 2, 3].map((k) => <option key={k}>{year - k}</option>)}
          </select>
          <button className="co__link">{t('account.go')}</button>
        </form>
      </div>
      {!orders?.length ? <p className="ac__empty">{t('account.noOrders')}</p> : orders.map((o) => (
        <OrderCard key={o.id} o={{ ...o, status: o.status as OrderStatus, amount_received: 0, tracking_number: null }}
          items={(items ?? []).filter((i) => i.order_id === o.id).map((i) => ({ name: i.product_name, size_ml: i.size_ml, quantity: i.quantity, image_path: i.image_path, price: i.line_total }))} />
      ))}
      {pages > 1 ? (
        <nav className="pager" aria-label={t('common.pagination')}>
          {page > 1 ? <Link className="btn btn--ghost btn--sm" href={qs({ page: String(page - 1) })}>{t('account.newer')}</Link> : <span />}
          <span className="pager__n">{t('common.pageOf', { page, pages })}</span>
          {page < pages ? <Link className="btn btn--ghost btn--sm" href={qs({ page: String(page + 1) })}>{t('account.older')}</Link> : <span />}
        </nav>
      ) : null}
    </div>
  );
}
