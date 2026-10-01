'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { buyAgainAction } from '@/lib/actions/account';
import { translateDbError } from '@/lib/db-errors';
import { useCart } from './CartProvider';

/** Adds items at today's price, skipping unavailable ones with a notice */
export function BuyAgainButton({ orderId, variantId, className = 'btn btn--ghost btn--sm', label }:
  { orderId?: string; variantId?: string; className?: string; label?: string }) {
  const t = useTranslations();
  const { add, refresh, setDrawerOpen, showToast } = useCart();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <span className="buyagain">
      <button type="button" className={className} disabled={busy} onClick={async () => {
        setBusy(true); setNotice(null);
        if (variantId) { await add({ variantId }); setBusy(false); return; }
        const res = await buyAgainAction(orderId!);
        setBusy(false);
        if ('error' in res && res.error) return showToast(translateDbError(res.error, t), 'error');
        const r = res as { added: { name: string }[]; skipped: { name: string; reason: string }[] };
        await refresh();
        if (r.skipped.length) setNotice(t('account.notAdded', { items: r.skipped.map((s) => `${s.name} (${s.reason.toLowerCase()})`).join(', ') }));
        if (r.added.length) setDrawerOpen(true); else if (!r.skipped.length) showToast(t('account.nothingToAdd'));
      }}>{busy ? t('common.adding') : label ?? t('account.buyAgain')}</button>
      {notice ? <span className="ac__small" role="status">{notice}</span> : null}
    </span>
  );
}
