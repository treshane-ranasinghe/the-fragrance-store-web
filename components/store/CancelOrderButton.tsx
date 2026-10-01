'use client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { cancelMyOrderAction } from '@/lib/actions/account';
import { translateDbError } from '@/lib/db-errors';
import { useCart } from './CartProvider';

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<{ error?: string; ok?: string }>();
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  const { refresh } = useCart();
  if (msg?.ok) return <p className="ac__small" role="status">{msg.ok}</p>;
  if (!open) return <button type="button" className="co__link" onClick={() => setOpen(true)}>{t('account.cancelOrder')}</button>;
  return (
    <form className="ac__card ac__cancel" onSubmit={async (e) => {
      e.preventDefault(); setBusy(true);
      const r = await cancelMyOrderAction(orderId, reason);
      setBusy(false); setMsg(r);
      if (r?.ok) { refresh(); router.refresh(); }
    }}>
      <div className="field"><label htmlFor="reason">{t('account.whyCancel')}</label>
        <input id="reason" required value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t('account.cancelPlaceholder')} /></div>
      {msg?.error ? <p className="co__error">{translateDbError(msg.error, t)}</p> : null}
      <div className="notify__row">
        <button className="btn btn--ghost btn--sm" disabled={busy}>{busy ? t('account.cancelling') : t('account.confirmCancel')}</button>
        <button type="button" className="co__link" onClick={() => setOpen(false)}>{t('account.keepOrder')}</button>
      </div>
    </form>
  );
}
