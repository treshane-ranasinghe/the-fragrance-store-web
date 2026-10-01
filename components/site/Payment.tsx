'use client';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import { useCart } from '@/components/store/CartProvider';
import { CopyButton } from '@/components/ui/CopyButton';
import { formatDeadline } from '@/lib/format';
import { translateDbError } from '@/lib/db-errors';
import { createClient } from '@/lib/supabase/client';
import type { BankAccount } from '@/lib/types';
import { money } from './money';

/** "Complete your bank transfer" panel (co__notice + co__bank from the original confirmation screen) */
export function BankNotice({ instructions, accounts, amountDue, orderNumber, orderId, dueAt, paymentStatus, title }: {
  instructions: string; accounts: BankAccount[]; amountDue: number; orderNumber: string; orderId: string; dueAt: string | null; paymentStatus: string; title?: string;
}) {
  const t = useTranslations('payment');
  const locale = useLocale();
  const b = (c: React.ReactNode) => <b>{c}</b>;
  return (
    <div className="co__notice">
      <h3>{title ?? t('bankTitle')}</h3>
      <p>{instructions}</p>
      <p>{dueAt
        ? t.rich('transferBy', { amount: money(amountDue), reference: orderNumber, deadline: formatDeadline(dueAt, locale), b })
        : t.rich('transfer', { amount: money(amountDue), reference: orderNumber, b })} <CopyButton value={orderNumber} label={t('copyReference')} /></p>
      {accounts.map((a) => (
        <dl key={a.id} className="co__bank">
          <div><dt>{t('bank')}</dt><dd>{a.bank_name}{a.branch ? ` — ${a.branch}` : ''}</dd></div>
          <div><dt>{t('accountName')}</dt><dd>{a.account_name}</dd></div>
          <div><dt>{t('accountNumber')}</dt><dd>{a.account_number} <CopyButton value={a.account_number} /></dd></div>
          {a.branch_code ? <div><dt>{t('branchCode')}</dt><dd>{a.branch_code}</dd></div> : null}
          {a.swift ? <div><dt>{t('swift')}</dt><dd>{a.swift}</dd></div> : null}
          <div><dt>{t('reference')}</dt><dd>{orderNumber}</dd></div>
        </dl>
      ))}
      <NotifyPayment orderId={orderId} paymentStatus={paymentStatus} />
    </div>
  );
}

export function CodNotice({ instructions, amount, status }: { instructions: string; amount: number; status: string }) {
  const t = useTranslations('payment');
  return (
    <div className="co__notice">
      <h3>{t('codTitle')}</h3>
      <p>{instructions}</p>
      <p>{t.rich('keepReady', { amount: money(amount), b: (c) => <b>{c}</b> })}</p>
      {status === 'pending' ? <p>{t('confirmShortly')}</p> : null}
    </div>
  );
}

/** Optional "I've made the payment" — no slip needed; it just alerts the admin */
export function NotifyPayment({ orderId, paymentStatus }: { orderId: string; paymentStatus: string }) {
  const t = useTranslations();
  const router = useRouter();
  const { refresh } = useCart();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'error'>(paymentStatus === 'payment_notified' ? 'done' : 'idle');
  const [error, setError] = useState('');
  if (!['unpaid', 'partially_paid', 'payment_notified'].includes(paymentStatus)) return null;
  if (state === 'done') return <p className="notify__done" role="status">{t('payment.notifyDone')}</p>;
  if (!open) return <button type="button" className="btn btn--ghost btn--sm notify__btn" onClick={() => setOpen(true)}>{t('payment.madePayment')}</button>;
  return (
    <form className="notify" onSubmit={async (e) => {
      e.preventDefault(); setState('busy');
      const { error } = await createClient().rpc('notify_payment', { p_order_id: orderId, p_note: note || null });
      if (error) { setError(translateDbError(error.message, t)); setState('error'); return; }
      setState('done'); refresh(); router.refresh();
    }}>
      <div className="field">
        <label htmlFor={`n-${orderId}`}>{t('payment.anything')} <small>{t('common.optional')}</small></label>
        <input id={`n-${orderId}`} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('payment.notePlaceholder')} maxLength={200} />
      </div>
      {state === 'error' ? <p className="co__error">{error}</p> : null}
      <div className="notify__row">
        <button className="btn btn--gold btn--sm" disabled={state === 'busy'}>{state === 'busy' ? t('common.sending') : t('payment.letKnow')}</button>
        <button type="button" className="co__link" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
