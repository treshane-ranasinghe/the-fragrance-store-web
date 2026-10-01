'use client';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { money } from '@/components/site/money';
import { Title } from '@/components/site/Title';
import { BankNotice } from '@/components/site/Payment';
import { Link } from '@/i18n/navigation';
import { OrderCard } from '@/components/site/OrderCard';
import { createClient } from '@/lib/supabase/client';
import { productImage } from '@/lib/storage';
import type { BankAccount } from '@/lib/types';
import { useCart } from './CartProvider';

export function CartView({ bankAccounts, bacsInstructions }: { bankAccounts: BankAccount[]; bacsInstructions: string }) {
  const t = useTranslations();
  const { cart, loading, setQuantity, remove, refresh } = useCart();
  const changed = cart.items.filter((l) => l.available && l.price_at_add != null && Number(l.price_at_add) !== Number(l.unit_price));
  const unavailable = cart.items.filter((l) => !l.available || l.quantity > l.stock);
  if (loading) return <p className="ac__loading">{t('cart.loading')}</p>;

  return (
    <>
      {cart.items.length === 0 ? (
        <section className="co__empty">
          <p className="eyebrow">{t('cart.eyebrow')}</p>
          <h1 className="section__title"><Title text={t('cart.emptyTitle')} /></h1>
          <p>{t('bag.emptyLead')}</p>
          <Link href="/shop" className="btn btn--gold">{t('common.exploreSignatures')}</Link>
        </section>
      ) : (
        <div className="co__grid">
          <div>
            <header className="co__intro"><p className="eyebrow">{t('cart.eyebrow')}</p><h1 className="co__title"><Title text={t('cart.readyTitle')} /></h1></header>
            {changed.length ? (
              <p className="co__error" role="alert">
                {t(changed.some((c) => Number(c.unit_price) > Number(c.price_at_add)) ? 'cart.priceUpdatedEnded' : 'cart.priceUpdated', { what: changed.length === 1 ? changed[0].name : t('cart.nItems', { count: changed.length }) })}{' '}
                <button type="button" className="co__link" onClick={async () => { await createClient().rpc('acknowledge_cart_prices'); refresh(); }}>{t('cart.ok')}</button>
              </p>
            ) : null}
            {unavailable.length ? <p className="co__error" role="alert">{t('cart.unavailable')}</p> : null}
            <ul className="bag__items cart__items">
              {cart.items.map((l) => {
                const href = l.kind === 'bundle' ? `/bundle/${l.slug}` : `/product/${l.slug}`;
                const max = Math.min(l.stock, l.max_per_order ?? 99, 10);
                return (
                  <li key={l.id} className="bag__item">
                    <Link href={href} className="bag__img ph-bottle">{productImage(l.image_path) ? <Image src={productImage(l.image_path)!} alt="" fill sizes="96px" /> : null}</Link>
                    <div className="bag__info">
                      <p className="bag__house">{l.kind === 'bundle' ? t('common.giftSet') : l.brand}</p>
                      <p className="bag__name"><Link href={href}>{l.name}</Link></p>
                      <p className="bag__meta">{l.kind === 'bundle' ? l.items.map((i) => `${i.name} ${t('common.ml', { size: i.size_ml })}`).join(' + ') : t('common.ml', { size: l.size_ml ?? 0 })}{l.badge_text ? ` · ${l.badge_text}` : ''}</p>
                      {!l.available ? <p className="bag__meta cart__warn">{l.stock <= 0 ? t('common.outOfStock') : t('common.noLongerAvailable')}</p> : l.quantity > l.stock ? <p className="bag__meta cart__warn">{t('common.onlyLeft', { count: l.stock })}</p> : null}
                      <div className="bag__controls">
                        {l.available ? (
                          <div className="qty" role="group" aria-label={t('cart.quantityOf', { name: l.name })}>
                            <button type="button" onClick={() => setQuantity(l.id, l.quantity - 1)} aria-label={t('common.decrease')}>&minus;</button>
                            <span aria-live="polite">{l.quantity}</span>
                            <button type="button" onClick={() => setQuantity(l.id, l.quantity + 1)} disabled={l.quantity >= max} aria-label={t('common.increase')}>+</button>
                          </div>
                        ) : null}
                        <button type="button" className="bag__remove" onClick={() => remove(l.id)}>{t('common.remove')}</button>
                      </div>
                    </div>
                    <p className="bag__price">{money(l.unit_price * l.quantity)}{Number(l.base_price) > Number(l.unit_price) ? <><br /><s className="cart__was">{money(l.base_price * l.quantity)}</s></> : null}</p>
                  </li>
                );
              })}
            </ul>
          </div>
          <aside className="co__summary">
            <div className="co__summary-inner">
              <h2>{t('cart.summary')}</h2>
              <dl className="co__totals">
                <div><dt>{t('common.subtotal')}</dt><dd>{money(cart.subtotal)}</dd></div>
                <div><dt>{t('common.delivery')}</dt><dd>{t('cart.chosenAtCheckout')}</dd></div>
                <div className="co__total"><dt>{t('common.total')}</dt><dd>{money(cart.subtotal)}</dd></div>
              </dl>
              {unavailable.length ? <button className="btn btn--gold btn--block" disabled>{t('common.checkout')}</button> : <Link href="/checkout" className="btn btn--gold btn--block">{t('common.checkout')}</Link>}
              <ul className="co__assure"><li>{t('cart.payBy')}</li><li>{t('common.authentic')}</li></ul>
            </div>
          </aside>
        </div>
      )}

      {cart.orders.length ? (
        <section className="cart__ordered" aria-labelledby="ordered">
          <header className="section__head"><p className="eyebrow">{t('cart.orderedEyebrow')}</p><h2 className="section__title" id="ordered"><Title text={t('cart.orderedTitle')} /></h2>
            <p className="ac__lead">{t('cart.orderedLead')}</p></header>
          {cart.orders.map((o) => (
            <OrderCard key={o.order_id} o={o} items={(o.items ?? []).map((i) => ({ name: i.name, size_ml: i.size_ml, quantity: i.quantity }))}>
              {o.payment_method === 'bank_transfer' && o.status === 'on_hold' && o.payment_status !== 'paid' ? (
                <BankNotice instructions={bacsInstructions} accounts={bankAccounts} amountDue={o.total - o.amount_received}
                  orderNumber={o.order_number} orderId={o.order_id} dueAt={o.payment_due_at} paymentStatus={o.payment_status} />
              ) : null}
            </OrderCard>
          ))}
        </section>
      ) : null}
    </>
  );
}
