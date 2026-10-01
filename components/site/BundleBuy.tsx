'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCart } from '@/components/store/CartProvider';

export function BundleBuy({ bundleId, available, maxPerOrder }: { bundleId: string; available: number; maxPerOrder: number | null }) {
  const { add } = useCart();
  const t = useTranslations();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const max = Math.min(available, maxPerOrder ?? available, 10);
  if (available <= 0) return <p className="modal__price">{t('common.soldOut')}</p>;
  return (
    <>
      <div className="modal__buy">
        <div className="qty qty--lg" role="group" aria-label={t('common.quantity')}>
          <button type="button" onClick={() => setQty(Math.max(1, qty - 1))} disabled={qty <= 1} aria-label={t('common.decrease')}>&minus;</button>
          <span aria-live="polite">{qty}</span>
          <button type="button" onClick={() => setQty(Math.min(max, qty + 1))} disabled={qty >= max} aria-label={t('common.increase')}>+</button>
        </div>
        <button type="button" className="btn btn--gold" disabled={busy} onClick={async () => { setBusy(true); await add({ bundleId, quantity: qty }); setBusy(false); }}>{busy ? t('common.adding') : t('common.addToBag')}</button>
      </div>
      {maxPerOrder ? <p className="modal__meta">{t('product.limitPerOrder', { count: maxPerOrder })}</p> : null}
    </>
  );
}
