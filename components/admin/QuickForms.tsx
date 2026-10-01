'use client';
import { useMemo, useState } from 'react';
import { ActionForm } from './ActionForm';
import { flash } from './Flash';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { codRemittanceAction, confirmOrderAction, recordBankPaymentAction } from '@/lib/actions/admin/orders';
import { formatDate, formatRs } from '@/lib/format';
import type { AdminState } from '@/lib/actions/admin/result';
import Link from 'next/link';

/** Pops up the result as soon as the action returns — the row (and its form) is gone once the page refreshes */
const withFlash = (action: (s: AdminState, fd: FormData) => Promise<AdminState>, label: string) =>
  async (s: AdminState, fd: FormData) => {
    const r = await action(s, fd);
    if (r?.ok) flash(`${label}: ${r.ok}`);
    return r;
  };

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

export function QuickBankPayment({ orderId, orderNumber, balance }: { orderId: string; orderNumber: string; balance: number }) {
  return (
    <ActionForm action={withFlash(recordBankPaymentAction, orderNumber)} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="order_id" value={orderId} />
      <input name="amount" type="number" step="0.01" min="0.01" defaultValue={balance.toFixed(2)} className="input input-sm w-28" aria-label="Amount" required />
      <input name="received_on" type="date" defaultValue={today()} className="input input-sm w-36" aria-label="Date received" required />
      <input name="reference" placeholder="Bank ref" className="input input-sm w-28" aria-label="Bank reference" />
      <SubmitButton className="btn-primary btn-sm" pendingText="…">Mark paid</SubmitButton>
    </ActionForm>
  );
}

export function QuickConfirm({ orderId, orderNumber, disabled }: { orderId: string; orderNumber: string; disabled?: boolean }) {
  return (
    <ActionForm action={withFlash(confirmOrderAction, orderNumber)}>
      <input type="hidden" name="order_id" value={orderId} />
      <SubmitButton className="btn-primary btn-sm" disabled={disabled} pendingText="…">Confirm</SubmitButton>
    </ActionForm>
  );
}

interface CashRow { id: string; order_number: string; courier_name: string | null; delivered_at: string | null; balance_due: number; days_since_delivery: number | null; cod_remit_overdue: boolean }

/** Tick several delivered COD orders and record one courier payment against all of them */
export function CodCashTable({ rows, alertDays }: { rows: CashRow[]; alertDays: number }) {
  const [sel, setSel] = useState<Set<string>>(new Set());
  const due = useMemo(() => rows.filter((r) => sel.has(r.id)).reduce((s, r) => s + Number(r.balance_due), 0), [rows, sel]);
  const couriers = [...new Set(rows.filter((r) => sel.has(r.id)).map((r) => r.courier_name).filter(Boolean))];
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  return (
    <ActionForm action={codRemittanceAction} onSuccess={(s) => { setSel(new Set()); flash(s.ok ?? 'Saved.'); }}>
      {[...sel].map((id) => <input key={id} type="hidden" name="order_ids" value={id} />)}
      <div className="card overflow-x-auto">
        <table className="table-admin">
          <thead><tr><th><input type="checkbox" aria-label="Select all" className="h-4 w-4 accent-brand-green" checked={sel.size === rows.length && rows.length > 0} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th><th>Order</th><th>Courier</th><th>Delivered</th><th className="text-right">Amount</th><th className="text-right">Days waiting</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><input type="checkbox" checked={sel.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 accent-brand-green" aria-label={`Select ${r.order_number}`} /></td>
                <td><Link href={`/admin/orders/${r.id}`}>{r.order_number}</Link></td><td>{r.courier_name ?? '—'}</td><td>{formatDate(r.delivered_at)}</td>
                <td className="text-right">{formatRs(r.balance_due)}</td>
                <td className={`text-right ${(r.days_since_delivery ?? 0) >= alertDays ? 'font-medium text-state-error' : ''}`}>{r.days_since_delivery ?? 0}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sel.size ? (
        <div className="card mt-4 grid gap-3 p-4 md:grid-cols-5">
          <p className="md:col-span-5 text-sm">Selected {sel.size} order(s), total due <strong>{formatRs(due)}</strong></p>
          <label><span className="label">Courier</span><input name="courier" defaultValue={couriers.length === 1 ? couriers[0]! : ''} className="input input-sm" /></label>
          <label><span className="label">Reference</span><input name="reference" className="input input-sm" placeholder="Courier payment report no." /></label>
          <label><span className="label">Amount received</span><input key={due} name="amount" type="number" step="0.01" defaultValue={due.toFixed(2)} className="input input-sm" required /></label>
          <label><span className="label">Date</span><input name="date" type="date" defaultValue={today()} className="input input-sm" /></label>
          <label><span className="label">Note (if amount differs)</span><input name="note" className="input input-sm" placeholder="e.g. courier fee Rs. 350" /></label>
          <div className="md:col-span-5"><SubmitButton className="btn-primary btn-sm">Record courier payment → Completed</SubmitButton></div>
        </div>
      ) : null}
    </ActionForm>
  );
}
