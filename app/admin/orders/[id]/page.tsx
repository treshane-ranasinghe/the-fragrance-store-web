import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm } from '@/components/admin/ActionForm';
import { OrderActions } from '@/components/admin/OrderActions';
import { Card, PageHeader } from '@/components/admin/ui';
import { AddressBlock, OrderItemsTable } from '@/components/store/OrderParts';
import { OrderStatusPill, PaymentStatusPill, Pill } from '@/components/ui/StatusPill';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { requireAdmin } from '@/lib/admin';
import { addOrderNoteAction } from '@/lib/actions/admin/orders';
import { formatDate, formatDateTime, formatDeadline, formatRs } from '@/lib/format';
import { PAYMENT_METHOD } from '@/lib/status';
import type { Order, OrderItem } from '@/lib/types';

export const metadata = { title: 'Order' };

export default async function AdminOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('admin_orders').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const o = data as Order & { customer_name: string; customer_email: string | null; balance_due: number; cod_needs_attention: boolean };
  const [items, payments, history, notes, calls, warning, profile] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', id).order('parent_item_id', { nullsFirst: true }),
    supabase.from('order_payments').select('*, profiles:recorded_by(full_name)').eq('order_id', id).order('created_at'),
    supabase.from('order_status_history').select('*, profiles:changed_by(full_name)').eq('order_id', id).order('created_at'),
    supabase.from('order_notes').select('*, profiles:created_by(full_name)').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('cod_call_logs').select('*').eq('order_id', id).order('created_at', { ascending: false }),
    supabase.from('admin_stock_warnings').select('shortages').eq('order_id', id).maybeSingle(),
    o.user_id ? supabase.from('profiles').select('id, full_name, email, phone, failed_cod_count, is_anonymous').eq('id', o.user_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title={`Order ${o.order_number}`} back={{ href: '/admin/orders', label: 'Orders' }}
        subtitle={<>Placed {formatDateTime(o.created_at)} · {PAYMENT_METHOD[o.payment_method]}</>}
        actions={<>
          <a href={`/account/orders/${o.order_number}/invoice?type=packing`} target="_blank" className="btn-secondary btn-sm no-underline">Packing slip</a>
          <a href={`/account/orders/${o.order_number}/invoice`} className="btn-secondary btn-sm no-underline">Invoice PDF</a>
        </>} />
      <div className="flex flex-wrap gap-2">
        <OrderStatusPill status={o.status} /><PaymentStatusPill status={o.payment_status} />
        {o.stock_issue ? <Pill label="Paid — out of stock: action needed" tone="error" /> : null}
        {o.is_overdue ? <Pill label="Payment overdue" tone="error" /> : null}
        {o.cod_needs_attention ? <Pill label="Unconfirmed too long — consider cancelling" tone="warning" /> : null}
        {warning.data ? <Pill label={`Stock short: ${warning.data.shortages}`} tone="error" /> : null}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card title="Items"><OrderItemsTable items={(items.data ?? []) as OrderItem[]} order={o} /></Card>
          <div className="grid gap-6 md:grid-cols-2">
            <Card title="Customer">
              {profile.data ? (
                <div className="text-sm">
                  {profile.data.is_anonymous
                    ? <p className="font-medium">{o.shipping_name ?? 'Guest'} <span className="text-xs text-brand-muted">(guest checkout)</span></p>
                    : <Link href={`/admin/customers/${profile.data.id}`} className="font-medium">{profile.data.full_name ?? 'Customer'}</Link>}
                  <p>{o.customer_email}</p><p>{profile.data.phone}</p>
                  {profile.data.failed_cod_count > 0 ? <p className="mt-1 text-state-error">Refused COD parcels: {profile.data.failed_cod_count}</p> : null}
                </div>
              ) : <p className="text-sm text-brand-muted">Deleted account</p>}
              <div className="mt-4 border-t border-brand-beige pt-3"><p className="label">Deliver to</p><AddressBlock o={o} /><p className="mt-2 text-sm text-brand-muted">{o.delivery_method_name}</p></div>
              {o.customer_note ? <p className="mt-3 rounded-btn bg-brand-beige/50 p-2 text-sm">Customer note: {o.customer_note}</p> : null}
            </Card>
            <Card title="Payment">
              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>Total</dt><dd>{formatRs(o.total)}</dd></div>
                <div className="flex justify-between"><dt>Received</dt><dd>{formatRs(o.amount_received)}</dd></div>
                <div className="flex justify-between font-semibold"><dt>Balance due</dt><dd>{formatRs(o.balance_due)}</dd></div>
                {Number(o.overpaid_amount) > 0 ? <div className="flex justify-between text-state-warning"><dt>Overpaid</dt><dd>{formatRs(o.overpaid_amount)}</dd></div> : null}
                {o.payment_due_at && o.status === 'on_hold' ? <div className="flex justify-between"><dt>Deadline</dt><dd>{formatDeadline(o.payment_due_at)}</dd></div> : null}
                {o.cod_amount_to_collect != null ? <div className="flex justify-between"><dt>Cash to collect</dt><dd>{formatRs(o.cod_amount_to_collect)}</dd></div> : null}
              </dl>
              {o.payment_notified_at ? <p className="mt-3 rounded-btn bg-state-warning/10 p-2 text-sm text-state-warning">Customer said they paid {formatDateTime(o.payment_notified_at)}{o.payment_customer_note ? `: “${o.payment_customer_note}”` : ''}</p> : null}
              {payments.data?.length ? (
                <ul className="mt-3 space-y-1 border-t border-brand-beige pt-3 text-sm">
                  {payments.data.map((p) => <li key={p.id}>{formatRs(p.amount)} · {formatDate(p.received_on)}{p.bank_reference ? ` · ref ${p.bank_reference}` : ''}<span className="text-brand-muted"> — {(p.profiles as { full_name: string } | null)?.full_name ?? ''}</span></li>)}
                </ul>
              ) : null}
              {o.refunded_at ? <p className="mt-2 text-sm">Refunded {formatDate(o.refunded_at)} ({o.refund_reference})</p> : null}
            </Card>
          </div>
          <Card title="History">
            <ol className="space-y-2 text-sm">
              {(history.data ?? []).map((h) => (
                <li key={h.id} className="flex gap-3"><span className="w-40 shrink-0 text-brand-muted">{formatDateTime(h.created_at)}</span>
                  <span>{h.from_status && h.from_status !== h.to_status ? `${h.from_status} → ` : ''}<strong>{h.to_status}</strong>{h.note ? ` — ${h.note}` : ''}<span className="text-brand-muted"> {(h.profiles as { full_name: string } | null)?.full_name ? `(${(h.profiles as { full_name: string }).full_name})` : ''}</span></span></li>
              ))}
            </ol>
            {calls.data?.length ? (
              <div className="mt-4 border-t border-brand-beige pt-3"><p className="label">Confirmation calls ({o.cod_call_attempts})</p>
                <ul className="text-sm">{calls.data.map((c) => <li key={c.id}>{formatDateTime(c.created_at)} — {c.result.replace('_', ' ')}{c.note ? `: ${c.note}` : ''}</li>)}</ul></div>
            ) : null}
          </Card>
        </div>
        <div className="space-y-6">
          <OrderActions o={o} stockOk={!warning.data} />
          <Card title="Internal notes">
            <ActionForm action={addOrderNoteAction} resetOnSuccess className="mb-3 space-y-2">
              <input type="hidden" name="order_id" value={o.id} />
              <textarea name="note" rows={2} className="input input-sm" placeholder="Only admins can see these" />
              <SubmitButton className="btn-secondary btn-sm">Add note</SubmitButton>
            </ActionForm>
            <ul className="space-y-2 text-sm">{(notes.data ?? []).map((n) => <li key={n.id} className="rounded-btn bg-brand-cream p-2">{n.note}<p className="text-xs text-brand-muted">{(n.profiles as { full_name: string } | null)?.full_name} · {formatDateTime(n.created_at)}</p></li>)}</ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
