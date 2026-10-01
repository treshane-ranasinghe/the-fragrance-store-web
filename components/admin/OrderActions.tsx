'use client';
import { ActionForm } from './ActionForm';
import { SubmitButton } from '@/components/ui/SubmitButton';
import * as A from '@/lib/actions/admin/orders';
import { formatRs } from '@/lib/format';

interface O { id: string; status: string; payment_method: string; payment_status: string; total: number; amount_received: number; courier_name: string | null; tracking_number: string | null; stock_issue: boolean }

const today = () => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);

function Box({ title, children, tone }: { title: string; children: React.ReactNode; tone?: 'danger' }) {
  return <div className={`rounded-card border p-4 ${tone === 'danger' ? 'border-state-error/30' : 'border-brand-beige'} bg-white`}><p className="mb-3 font-medium text-brand-green">{title}</p>{children}</div>;
}

export function OrderActions({ o, stockOk }: { o: O; stockOk: boolean }) {
  const balance = Math.max(0, Number(o.total) - Number(o.amount_received));
  const hid = <input type="hidden" name="order_id" value={o.id} />;
  const bank = o.payment_method === 'bank_transfer';
  return (
    <div className="space-y-4">
      {bank && o.status === 'on_hold' && o.payment_status !== 'paid' ? (
        <Box title="Record bank payment">
          <p className="mb-3 text-sm text-brand-muted">Only continue once the money has cleared in the account — never on the customer&apos;s word alone. Balance due <strong>{formatRs(balance)}</strong>.</p>
          <ActionForm action={A.recordBankPaymentAction} className="grid gap-2 sm:grid-cols-2">
            {hid}
            <label><span className="label">Amount received</span><input name="amount" type="number" step="0.01" min="0.01" required defaultValue={balance.toFixed(2)} className="input input-sm" /></label>
            <label><span className="label">Date received</span><input name="received_on" type="date" required defaultValue={today()} className="input input-sm" /></label>
            <label className="sm:col-span-2"><span className="label">Bank reference</span><input name="reference" className="input input-sm" placeholder="From the bank statement / SMS" /></label>
            <label className="sm:col-span-2"><span className="label">Note (optional)</span><input name="note" className="input input-sm" /></label>
            <div className="sm:col-span-2"><SubmitButton className="btn-primary btn-sm">Record payment</SubmitButton>
              <span className="help ml-2">Full amount → Paid → Processing (stock reduced). Less → Part paid, stays On hold.</span></div>
          </ActionForm>
          {o.payment_status === 'payment_notified' ? (
            <ActionForm action={A.paymentNotFoundAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-brand-beige pt-4">
              {hid}
              <label className="flex-1"><span className="label">Not received yet?</span><input name="note" className="input input-sm" placeholder="Optional note to customer" /></label>
              <SubmitButton className="btn-secondary btn-sm">Mark payment not found</SubmitButton>
            </ActionForm>
          ) : null}
        </Box>
      ) : null}

      {(o.status === 'pending' || (o.status === 'on_hold' && o.payment_status === 'paid')) ? (
        <Box title={o.status === 'pending' ? 'Confirm COD order' : 'Paid — confirm order'}>
          {!stockOk ? <p className="mb-2 text-sm text-state-error">Not enough stock to confirm. Add stock first, or cancel the order.</p> : null}
          <ActionForm action={A.confirmOrderAction}>{hid}<SubmitButton className="btn-primary btn-sm" disabled={!stockOk}>Confirm order (reduce stock)</SubmitButton></ActionForm>
          {o.status === 'pending' ? (
            <ActionForm action={A.logCodCallAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-brand-beige pt-4">
              {hid}
              <label><span className="label">Log a call</span><select name="result" className="input input-sm w-auto">
                <option value="confirmed">Confirmed</option><option value="no_answer">No answer</option><option value="wrong_number">Wrong number</option><option value="cancel_requested">Cancel requested</option></select></label>
              <label className="flex-1"><span className="label">Note</span><input name="note" className="input input-sm" /></label>
              <SubmitButton className="btn-secondary btn-sm">Log call</SubmitButton>
            </ActionForm>
          ) : null}
        </Box>
      ) : null}

      {o.status === 'processing' ? (
        <Box title="Mark as shipped">
          <ActionForm action={A.markShippedAction} className="grid gap-2 sm:grid-cols-2">
            {hid}
            <label><span className="label">Courier</span><input name="courier" required defaultValue={o.courier_name ?? ''} className="input input-sm" placeholder="e.g. Domex, Koombiyo" /></label>
            <label><span className="label">Tracking number</span><input name="tracking" defaultValue={o.tracking_number ?? ''} className="input input-sm" /></label>
            <div className="sm:col-span-2"><SubmitButton className="btn-primary btn-sm">Mark as shipped</SubmitButton>
              {o.payment_method === 'cod' ? <span className="help ml-2">Cash to collect will be set to {formatRs(balance)}.</span> : null}</div>
          </ActionForm>
        </Box>
      ) : null}

      {o.status === 'shipped' ? (
        <Box title="Delivery">
          <ActionForm action={A.markDeliveredAction}>{hid}<SubmitButton className="btn-primary btn-sm">Mark as delivered</SubmitButton>
            <span className="help ml-2">{bank ? 'Already paid → moves to Completed.' : 'Stays Delivered / unpaid until courier cash is recorded.'}</span></ActionForm>
          <ActionForm action={A.deliveryFailedAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-brand-beige pt-4">
            {hid}
            <label className="flex-1"><span className="label">Delivery failed / refused</span><input name="reason" required className="input input-sm" placeholder="Reason" /></label>
            <SubmitButton className="btn-danger btn-sm">Mark delivery failed</SubmitButton>
          </ActionForm>
          <ActionForm action={A.updateTrackingAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-brand-beige pt-4">
            {hid}
            <label><span className="label">Courier</span><input name="courier" defaultValue={o.courier_name ?? ''} className="input input-sm" /></label>
            <label><span className="label">Tracking</span><input name="tracking" defaultValue={o.tracking_number ?? ''} className="input input-sm" /></label>
            <SubmitButton className="btn-secondary btn-sm">Update</SubmitButton>
          </ActionForm>
        </Box>
      ) : null}

      {o.status === 'delivered' && o.payment_method === 'cod' && o.payment_status === 'unpaid' ? (
        <Box title="Record COD cash received">
          <ActionForm action={A.codRemittanceAction} className="grid gap-2 sm:grid-cols-2">
            <input type="hidden" name="order_ids" value={o.id} />
            <label><span className="label">Courier</span><input name="courier" defaultValue={o.courier_name ?? ''} className="input input-sm" /></label>
            <label><span className="label">Remittance reference</span><input name="reference" className="input input-sm" /></label>
            <label><span className="label">Amount received</span><input name="amount" type="number" step="0.01" required defaultValue={balance.toFixed(2)} className="input input-sm" /></label>
            <label><span className="label">Date</span><input name="date" type="date" defaultValue={today()} className="input input-sm" /></label>
            <label className="sm:col-span-2"><span className="label">Note (required if the amount differs)</span><input name="note" className="input input-sm" /></label>
            <div className="sm:col-span-2"><SubmitButton className="btn-primary btn-sm">Record cash → Completed</SubmitButton></div>
          </ActionForm>
        </Box>
      ) : null}

      {o.status === 'returned' ? (
        <Box title="Parcel back at the store">
          <ActionForm action={A.restockAction} className="flex flex-wrap items-center gap-3">
            {hid}
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="damaged" className="h-4 w-4 accent-brand-green" />Damaged — do not restock</label>
            <SubmitButton className="btn-primary btn-sm">Restock &amp; cancel order</SubmitButton>
          </ActionForm>
        </Box>
      ) : null}

      {o.payment_status === 'refund_pending' ? (
        <Box title="Refund">
          <ActionForm action={A.recordRefundAction} className="flex flex-wrap items-end gap-2">
            {hid}
            <label><span className="label">Refund reference</span><input name="reference" required className="input input-sm" /></label>
            <label><span className="label">Date</span><input name="date" type="date" defaultValue={today()} className="input input-sm" /></label>
            <SubmitButton className="btn-primary btn-sm">Record refund</SubmitButton>
          </ActionForm>
        </Box>
      ) : null}

      {['pending', 'on_hold', 'processing'].includes(o.status) ? (
        <Box title="Cancel order" tone="danger">
          <ActionForm action={A.cancelOrderAction} className="flex flex-wrap items-end gap-2">
            {hid}
            <label className="flex-1"><span className="label">Reason (saved in history)</span><input name="reason" required className="input input-sm" /></label>
            <SubmitButton className="btn-danger btn-sm">Cancel order</SubmitButton>
          </ActionForm>
          <p className="help mt-2">{o.status === 'processing' ? 'Stock will be returned.' : 'No stock change (stock was not reduced yet).'}{Number(o.amount_received) > 0 ? ' Payment → Refund pending.' : ''} Items go back to the customer&apos;s cart.</p>
        </Box>
      ) : null}
    </div>
  );
}
