import type { Metadata } from 'next';
import Image from 'next/image';
import { getTranslations } from 'next-intl/server';
import { money } from '@/components/site/money';
import { OrderCard } from '@/components/site/OrderCard';
import { BankNotice } from '@/components/site/Payment';
import { BuyAgainButton } from '@/components/store/BuyAgainButton';
import { Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/server';
import { getSettings } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { productImage } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';
import type { Order } from '@/lib/types';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('account') };
}

export default async function AccountPage({ params }: Props) {
  const locale = await pageLocale(params);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const [profile, summary, inProgress, recent, { settings, bankAccounts }, t] = await Promise.all([
    supabase.from('profiles').select('created_at').eq('id', user!.id).single(),
    supabase.from('my_order_summary').select('*').maybeSingle(),
    supabase.from('orders').select('*, order_items(product_name, size_ml, quantity, image_path, parent_item_id)').eq('user_id', user!.id).in('status', ['pending', 'on_hold', 'processing', 'shipped']).order('created_at', { ascending: false }).limit(3),
    supabase.from('my_purchased_products').select('*').order('last_bought_at', { ascending: false }).limit(4),
    getSettings(),
    getTranslations(),
  ]);
  const s = summary.data ?? { total_orders: 0, total_spent: 0, in_progress: 0, last_order_at: null };
  return (
    <div className="ac__grid">
      <section aria-labelledby="progress">
        <h2 className="ac__h2" id="progress">{t('account.inProgress')}</h2>
        {!(inProgress.data ?? []).length ? <p className="ac__empty">{t('account.noneInProgress')} <Link href="/shop" className="co__link">{t('common.exploreSignatures')}</Link></p> : (
          (inProgress.data as (Order & { order_items: { product_name: string; size_ml: number | null; quantity: number; image_path: string | null; parent_item_id: string | null }[] })[]).map((o) => (
            <OrderCard key={o.id} o={o} items={o.order_items.filter((i) => !i.parent_item_id).map((i) => ({ name: i.product_name, size_ml: i.size_ml, quantity: i.quantity, image_path: i.image_path }))}>
              {o.payment_method === 'bank_transfer' && o.status === 'on_hold' && o.payment_status !== 'paid' ? (
                <BankNotice instructions={settings.bacs_instructions} accounts={bankAccounts} amountDue={o.total - o.amount_received} orderNumber={o.order_number} orderId={o.id} dueAt={o.payment_due_at} paymentStatus={o.payment_status} />
              ) : null}
            </OrderCard>
          ))
        )}
        {(recent.data ?? []).length ? (
          <>
            <h2 className="ac__h2" style={{ marginTop: 40 }}>{t('account.recent')}</h2>
            <div className="ac__order"><ul className="ac__items ac__purchases" style={{ marginTop: 0 }}>
              {recent.data!.map((p) => (
                <li key={p.variant_id}>
                  <span className="ac__thumb ph-bottle">{productImage(p.image_path) ? <Image src={productImage(p.image_path)!} alt="" fill sizes="56px" /> : null}</span>
                  <span>{p.product_name}<small>{p.brand_name} · {t('common.ml', { size: p.size_ml })}{p.current_price ? ` · ${t('account.today', { price: money(p.current_price) })}` : ''}</small></span>
                  {p.in_stock ? <BuyAgainButton variantId={p.variant_id} /> : <small>{t('common.soldOut')}</small>}
                </li>
              ))}
            </ul></div>
          </>
        ) : null}
      </section>
      <aside className="ac__side">
        <div className="ac__card">
          <h2 className="ac__h2">{t('account.glance')}</h2>
          <dl className="ac__stats">
            <div><dt>{t('account.statOrders')}</dt><dd>{s.total_orders}</dd></div>
            <div><dt>{t('account.statInProgress')}</dt><dd>{s.in_progress}</dd></div>
            <div><dt>{t('account.statSpent')}</dt><dd>{money(s.total_spent)}</dd></div>
            <div><dt>{t('account.statLast')}</dt><dd style={{ fontSize: 18 }}>{formatDate(s.last_order_at, locale)}</dd></div>
          </dl>
          <p className="ac__small" style={{ marginTop: 14 }}>{t('account.memberSince', { date: formatDate(profile.data?.created_at, locale) })}</p>
        </div>
        <div className="ac__card">
          <h2 className="ac__h2">{t('account.quickLinks')}</h2>
          <nav className="ac__links">
            <Link href="/account/orders">{t('account.orderHistory')}</Link><Link href="/account/purchases">{t('account.purchasedProducts')}</Link>
            <Link href="/account/profile">{t('account.profileDetails')}</Link><Link href="/account/addresses">{t('account.addresses')}</Link><Link href="/account/security">{t('account.securityPrivacy')}</Link>
          </nav>
        </div>
      </aside>
    </div>
  );
}
