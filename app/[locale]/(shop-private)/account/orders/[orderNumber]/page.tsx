import type { Metadata } from 'next';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { money } from '@/components/site/money';
import { OrderStatusBadge, OrderSteps } from '@/components/site/OrderCard';
import { BankNotice, CodNotice } from '@/components/site/Payment';
import { waLink } from '@/components/site/wa';
import { BuyAgainButton } from '@/components/store/BuyAgainButton';
import { CancelOrderButton } from '@/components/store/CancelOrderButton';
import { getPathname, Link } from '@/i18n/navigation';
import { pageLocale } from '@/i18n/server';
import { getSettings } from '@/lib/data';
import { formatDate, formatDateTime } from '@/lib/format';
import { productImage } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';
import type { Order, OrderItem } from '@/lib/types';

type Props = { params: Promise<{ locale: string; orderNumber: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('order', { number: (await params).orderNumber }) };
}

export default async function OrderDetailPage({ params }: Props) {
  const locale = await pageLocale(params);
  const { orderNumber } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from('orders').select('*').eq('order_number', orderNumber).maybeSingle();
  if (!data) notFound();
  const o = data as Order;
  const [{ data: items }, { data: payments }, { data: history }, { settings, bankAccounts }, t] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', o.id).order('parent_item_id', { nullsFirst: true }),
    supabase.from('order_payments').select('amount, received_on').eq('order_id', o.id).order('received_on'),
    supabase.from('order_status_history').select('to_status, note, created_at').eq('order_id', o.id).order('created_at'),
    getSettings(),
    getTranslations(),
  ]);
  const all = (items ?? []) as OrderItem[];
  const balance = Math.max(0, Number(o.total) - Number(o.amount_received));
  const canCancel = (o.payment_method === 'bank_transfer' && o.status === 'on_hold') || (o.payment_method === 'cod' && o.status === 'pending');
  const pickup = o.shipping_line1 === 'Collect from the boutique';

  return (
    <div className="ac__grid">
      <div>
        <Link href="/account/orders" className="co__link">{t('account.allOrders')}</Link>
        <article className="ac__order" style={{ marginTop: 18 }}>
          <header className="ac__order-head">
            <div><p className="ac__ref">{o.order_number}</p><p className="ac__date">{t('account.placed', { date: formatDateTime(o.created_at, locale) })}</p></div>
            <OrderStatusBadge o={o} />
          </header>
          <OrderSteps status={o.status} method={o.payment_method} />
          <ul className="ac__items">
            {all.filter((i) => !i.parent_item_id).map((i) => (
              <li key={i.id}>
                <span className="ac__thumb ph-bottle">{productImage(i.image_path) ? <Image src={productImage(i.image_path)!} alt="" fill sizes="44px" /> : null}</span>
                <span>{i.brand_name && i.brand_name !== 'Bundle' ? `${i.brand_name} ` : ''}{i.product_name}
                  <small>{i.size_ml ? `${t('common.ml', { size: i.size_ml })} · ` : ''}{i.quantity} × {money(i.unit_price)}{Number(i.discount_amount) > 0 ? ` ${t('account.was', { price: money(i.original_unit_price) })}` : ''}</small>
                  {i.bundle_id ? <small>{all.filter((c) => c.parent_item_id === i.id).map((c) => `${c.product_name} ${t('common.ml', { size: c.size_ml ?? 0 })}`).join(' + ')}</small> : null}
                </span>
                <b>{money(i.line_total)}</b>
              </li>
            ))}
          </ul>
          <dl className="co__totals">
            <div><dt>{t('common.subtotal')}</dt><dd>{money(o.subtotal)}</dd></div>
            <div><dt>{t('common.delivery')}{o.delivery_method_name ? ` · ${o.delivery_method_name}` : ''}</dt><dd>{Number(o.delivery_fee) ? money(o.delivery_fee) : t('common.free')}</dd></div>
            {Number(o.cod_fee) ? <div><dt>{t('common.cashOnDelivery')}</dt><dd>{money(o.cod_fee)}</dd></div> : null}
            <div className="co__total"><dt>{t('common.total')}</dt><dd>{money(o.total)}</dd></div>
          </dl>
          <div className="ac__actions">
            <BuyAgainButton orderId={o.id} className="btn btn--gold btn--sm" />
            {/* A file download, so a plain link (the PDF route lives under the language prefix like this page) */}
            <a href={getPathname({ href: `/account/orders/${o.order_number}/invoice`, locale })} className="btn btn--ghost btn--sm">{t('account.invoice')}</a>
            <a href={waLink(settings.store_whatsapp, t('wa.orderQuestion', { number: o.order_number }))} className="co__link" target="_blank" rel="noopener noreferrer">{t('account.contactOrder')}</a>
            {canCancel ? <CancelOrderButton orderId={o.id} /> : null}
          </div>
        </article>
        {o.payment_method === 'bank_transfer' && o.status === 'on_hold' && balance > 0 ? (
          <BankNotice instructions={settings.bacs_instructions} accounts={bankAccounts} amountDue={balance} orderNumber={o.order_number} orderId={o.id} dueAt={o.payment_due_at} paymentStatus={o.payment_status} />
        ) : o.payment_method === 'cod' && ['pending', 'processing', 'shipped'].includes(o.status) ? <CodNotice instructions={settings.cod_instructions} amount={balance} status={o.status} /> : null}
      </div>
      <aside className="ac__side">
        <div className="ac__card">
          <h2 className="ac__h2">{t('account.payment')}</h2>
          <dl className="co__bank">
            <div><dt>{t('account.method')}</dt><dd>{t(`status.method_${o.payment_method}`)}</dd></div>
            <div><dt>{t('account.status')}</dt><dd>{t(`status.payment_${o.payment_status}`)}</dd></div>
            <div><dt>{t('account.received')}</dt><dd>{money(o.amount_received)}</dd></div>
            {o.status !== 'cancelled' ? <div><dt>{t('account.balance')}</dt><dd>{money(balance)}</dd></div> : null}
            {(payments ?? []).map((p, i) => <div key={i}><dt>{t('account.paymentN', { n: i + 1 })}</dt><dd>{money(p.amount)} · {formatDate(p.received_on, locale)}</dd></div>)}
            {o.refunded_at ? <div><dt>{t('account.refunded')}</dt><dd>{formatDate(o.refunded_at, locale)}</dd></div> : null}
          </dl>
        </div>
        <div className="ac__card">
          <h2 className="ac__h2">{pickup ? t('account.collection') : t('account.delivery')}</h2>
          <p className="ac__small">{o.shipping_name}{o.shipping_phone ? ` · ${o.shipping_phone}` : ''}<br />
            {pickup ? t('account.collectBoutique') : <>{o.shipping_line1}{o.shipping_line2 ? `, ${o.shipping_line2}` : ''}<br />{o.shipping_city}, {o.shipping_district}</>}</p>
          {o.courier_name ? <p className="ac__small" style={{ marginTop: 10 }}>{t('account.courier', { courier: `${o.courier_name}${o.tracking_number ? ` · ${o.tracking_number}` : ''}` })}</p> : null}
          {o.customer_note ? <p className="ac__small" style={{ marginTop: 10 }}>{t('account.note', { note: o.customer_note })}</p> : null}
        </div>
        <div className="ac__card">
          <h2 className="ac__h2">{t('account.timeline')}</h2>
          {/* History notes are written by the store (English); a bare status is translated */}
          <ul className="co__assure">{(history ?? []).map((h, i) => <li key={i}>{formatDateTime(h.created_at, locale)} — {h.note ?? t(`status.order_${h.to_status}`)}</li>)}</ul>
        </div>
      </aside>
    </div>
  );
}
