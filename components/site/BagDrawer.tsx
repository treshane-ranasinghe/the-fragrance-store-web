'use client';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import { useCart } from '@/components/store/CartProvider';
import { Link, usePathname } from '@/i18n/navigation';
import { productImage } from '@/lib/storage';
import { money } from './money';
import { useSite } from './SiteContext';

/** Slide-out bag (original .bag markup): free-delivery meter, steppers, subtotal, checkout */
export function BagDrawer() {
  const { cart, drawerOpen, setDrawerOpen, setQuantity, remove, toast } = useCart();
  const t = useTranslations();
  const site = useSite();
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<Element | null>(null);

  useEffect(() => setDrawerOpen(false), [pathname, setDrawerOpen]);
  useEffect(() => {
    if (!drawerOpen) return;
    lastFocus.current = document.activeElement;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => closeRef.current?.focus({ preventScroll: true }), 50);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    document.addEventListener('keydown', onKey);
    return () => {
      clearTimeout(t); document.body.style.overflow = ''; document.removeEventListener('keydown', onKey);
      (lastFocus.current as HTMLElement | null)?.focus?.({ preventScroll: true });
    };
  }, [drawerOpen, setDrawerOpen]);

  const n = cart.count;
  const sub = Number(cart.subtotal);
  const free = site.freeOver && site.freeOver > 0 ? site.freeOver : null;
  const empty = cart.items.length === 0;

  return (
    <>
      <div className={`bag${drawerOpen ? ' is-open' : ''}${empty ? ' is-empty' : ''}`} id="bag" aria-hidden={!drawerOpen}>
        <div className="bag__backdrop" onClick={() => setDrawerOpen(false)} />
        <aside className="bag__panel" role="dialog" aria-modal="true" aria-labelledby="bagTitle">
          <header className="bag__head">
            <h2 id="bagTitle">{t('bag.title')} <span className="bag__n">{n ? `(${n})` : ''}</span></h2>
            <button ref={closeRef} type="button" className="bag__close" onClick={() => setDrawerOpen(false)} aria-label={t('bag.close')}>&times;</button>
          </header>
          {!empty && free ? (
            <div className="bag__ship" aria-live="polite">
              <p>{sub >= free ? t.rich('bag.unlocked', { b: (c) => <b>{c}</b> }) : t.rich('bag.addMore', { amount: money(free - sub), b: (c) => <b>{c}</b> })}</p>
              <span className="bag__meter"><i style={{ transform: `scaleX(${Math.min(1, sub / free).toFixed(3)})` }} /></span>
            </div>
          ) : null}
          <ul className="bag__items">
            {cart.items.map((l) => {
              const src = productImage(l.image_path);
              return (
                <li key={l.id} className="bag__item">
                  <div className="bag__img ph-bottle">{src ? <Image src={src} alt="" width={76} height={95} /> : null}</div>
                  <div className="bag__info">
                    <p className="bag__house">{l.kind === 'bundle' ? t('common.giftSet') : l.brand}</p>
                    <p className="bag__name"><Link href={l.kind === 'bundle' ? `/bundle/${l.slug}` : `/product/${l.slug}`}>{l.name}</Link></p>
                    <p className="bag__meta">
                      {l.kind === 'bundle' ? l.items.map((i) => `${i.name} ${t('common.ml', { size: i.size_ml })}`).join(' + ') : t('common.ml', { size: l.size_ml ?? 0 })}
                      {l.badge_text ? ` · ${l.badge_text}` : ''}
                    </p>
                    {!l.available || l.quantity > l.stock ? <p className="bag__meta" style={{ color: '#E59A7E' }}>{l.stock <= 0 ? t('common.outOfStock') : t('common.onlyLeft', { count: l.stock })}</p> : null}
                    <div className="bag__controls">
                      <div className="qty" role="group" aria-label={t('common.quantity')}>
                        <button type="button" onClick={() => setQuantity(l.id, l.quantity - 1)} aria-label={t('common.decrease')}>&minus;</button>
                        <span aria-live="polite">{l.quantity}</span>
                        <button type="button" onClick={() => setQuantity(l.id, l.quantity + 1)} aria-label={t('common.increase')}
                          disabled={l.quantity >= Math.min(l.stock, l.max_per_order ?? 99)}>+</button>
                      </div>
                      <button type="button" className="bag__remove" onClick={() => remove(l.id)}>{t('common.remove')}</button>
                    </div>
                  </div>
                  <p className="bag__price">{money(l.unit_price * l.quantity)}</p>
                </li>
              );
            })}
          </ul>
          <div className="bag__empty">
            <p className="bag__empty-title">{t('bag.empty')}</p>
            <p>{t('bag.emptyLead')}</p>
            <Link href="/shop" className="btn btn--ghost" onClick={() => setDrawerOpen(false)}>{t('common.exploreSignatures')}</Link>
            {cart.orders.length ? <Link href="/cart" className="bag__continue">{t('bag.viewOrdered')}</Link> : null}
          </div>
          <footer className="bag__foot">
            <div className="bag__row"><span>{t('common.subtotal')}</span><strong>{money(sub)}</strong></div>
            <p className="bag__hint">
              {t('bag.hint')}
              {cart.orders.length ? <> · <Link href="/cart" className="co__link">{t('bag.placedOrders', { count: cart.orders.length })}</Link></> : null}
            </p>
            <Link href="/checkout" className="btn btn--gold btn--block">{t('common.checkout')}</Link>
            <button type="button" className="bag__continue" onClick={() => setDrawerOpen(false)}>{t('common.continueShopping')}</button>
          </footer>
        </aside>
      </div>
      <div className={`ac__toast${toast ? ' is-on' : ''}`} role="status" aria-live="polite">{toast?.text}</div>
    </>
  );
}
