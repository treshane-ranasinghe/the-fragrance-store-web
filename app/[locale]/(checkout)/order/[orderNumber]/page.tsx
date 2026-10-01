import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BankNotice, CodNotice } from '@/components/site/Payment';
import { Title } from '@/components/site/Title';
import { money } from '@/components/site/money';
import { Link, redirect } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/server';
import { getSettings } from '@/lib/data';
import { formatDate } from '@/lib/format';
import { createClient } from '@/lib/supabase/server';
import type { Order, OrderItem } from '@/lib/types';

type Props = { params: Promise<{ locale: string; orderNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('orderReceived') };
}

/** Order Received page — the original confirmation screen with the animated gold tick */
export default async function OrderReceivedPage({ params }: Props) {
  const locale = await pageLocale(params);
  const { orderNumber } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return redirect({ href: `/login?next=/order/${orderNumber}`, locale });
  const { data: order } = await supabase.from('orders').select('*').eq('order_number', orderNumber).maybeSingle();
  if (!order) notFound();
  const o = order as Order;
  const [{ data: items }, { settings, bankAccounts }, t] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', o.id).is('parent_item_id', null),
    getSettings(),
    getTranslations(),
  ]);
  const due = Math.max(0, Number(o.total) - Number(o.amount_received));
  const pickup = o.shipping_line1 === 'Collect from the boutique';
  const firstName = (o.shipping_name ?? '').split(' ')[0];
  const b = (c: React.ReactNode) => <b>{c}</b>;

  return (
    <section className="co__done" tabIndex={-1}>
      <div className="co__done-inner">
        <span className="co__tick" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg></span>
        <p className="eyebrow">{t('checkout.receivedEyebrow')}</p>
        <h1 className="section__title">{firstName ? <Title text={t('checkout.thanksName', { name: firstName })} /> : t('checkout.thanks')}</h1>
        <p>{user.email ? t.rich('checkout.receivedEmail', { number: o.order_number, email: user.email, b }) : t.rich('checkout.received', { number: o.order_number, b })}</p>

        {o.payment_method === 'bank_transfer'
          ? (o.status === 'on_hold' && due > 0
              ? <BankNotice instructions={settings.bacs_instructions} accounts={bankAccounts} amountDue={due} orderNumber={o.order_number} orderId={o.id} dueAt={o.payment_due_at} paymentStatus={o.payment_status} />
              : <div className="co__notice"><h3>{o.status === 'cancelled' ? t('checkout.cancelledTitle') : t('checkout.paidTitle')}</h3><p>{o.status === 'cancelled' ? t('checkout.cancelledText') : t('checkout.paidText')}</p></div>)
          : <CodNotice instructions={settings.cod_instructions} amount={due} status={o.status} />}

        <div className="co__recap">
          <ul>
            {(items as OrderItem[] ?? []).map((i) => (
              <li key={i.id}><span>{i.product_name}{i.size_ml ? ` · ${t('common.ml', { size: i.size_ml })}` : ''} <small>× {i.quantity}</small></span><span>{money(i.line_total)}</span></li>
            ))}
          </ul>
          <dl className="co__totals">
            <div><dt>{t('common.subtotal')}</dt><dd>{money(o.subtotal)}</dd></div>
            <div><dt>{t('common.delivery')}</dt><dd>{Number(o.delivery_fee) ? money(o.delivery_fee) : t('common.free')}</dd></div>
            {Number(o.cod_fee) ? <div><dt>{t('common.cashOnDelivery')}</dt><dd>{money(o.cod_fee)}</dd></div> : null}
            <div className="co__total"><dt>{t('common.total')}</dt><dd>{money(o.total)}</dd></div>
          </dl>
          <p className="co__recap-meta">
            <b>{t('checkout.recapOrder')}</b> {o.order_number} · {formatDate(o.created_at, locale)}<br />
            <b>{t('checkout.recapPayment')}</b> {o.payment_method === 'bank_transfer' ? settings.bacs_title : settings.cod_title}<br />
            <b>{pickup ? t('checkout.collection') : t('checkout.deliveringTo')}</b> {pickup ? t('checkout.collectBoutique') : `${o.shipping_name}, ${o.shipping_line1}${o.shipping_line2 ? `, ${o.shipping_line2}` : ''}, ${o.shipping_city}, ${o.shipping_district}`}
          </p>
        </div>

        <div className="co__done-cta">
          <Link href={`/account/orders/${o.order_number}`} className="btn btn--gold">{t('checkout.viewYourOrder')}</Link>
          <Link href="/shop" className="btn btn--ghost">{t('common.continueShopping')}</Link>
        </div>
      </div>
    </section>
  );
}
