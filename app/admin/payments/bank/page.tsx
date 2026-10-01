import Link from 'next/link';
import { PageHeader, Empty } from '@/components/admin/ui';
import { Pill, PaymentStatusPill } from '@/components/ui/StatusPill';
import { QuickBankPayment } from '@/components/admin/QuickForms';
import { NewOrderRefresher } from '@/components/admin/NewOrderRefresher';
import { requireAdmin } from '@/lib/admin';
import { formatDateTime, formatDeadline, formatRs } from '@/lib/format';

export const metadata = { title: 'Bank transfers' };

/** Unpaid bank-transfer orders to match against the bank account; "I've made the payment" first */
export default async function BankPaymentsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const { supabase } = await requireAdmin();
  let q = supabase.from('admin_orders').select('*').eq('payment_method', 'bank_transfer').eq('status', 'on_hold');
  if (filter === 'overdue') q = q.eq('is_overdue', true);
  const { data } = await q.order('payment_notified_at', { ascending: false, nullsFirst: false }).order('created_at');
  const rows = (data ?? []).sort((a, b) => Number(b.payment_status === 'payment_notified') - Number(a.payment_status === 'payment_notified'));
  return (
    <div>
      <NewOrderRefresher />
      <PageHeader title="Bank transfers" subtitle="Match each transfer by order number in the reference, or by exact amount + name + date. Only continue once the money has cleared."
        actions={<><Link href="/admin/payments/bank" className="btn-secondary btn-sm no-underline">All on hold</Link><Link href="?filter=overdue" className="btn-secondary btn-sm no-underline">Overdue</Link></>} />
      {!rows.length ? <Empty>No bank transfers waiting.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead><tr><th>Order</th><th>Customer</th><th className="text-right">Due</th><th>Payment</th><th>Deadline</th><th>Record payment</th></tr></thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className={o.payment_status === 'payment_notified' ? 'bg-state-warning/5' : ''}>
                  <td><Link href={`/admin/orders/${o.id}`} className="font-medium">{o.order_number}</Link><br /><span className="text-xs text-brand-muted">{formatDateTime(o.created_at)}</span></td>
                  <td>{o.customer_name}<br /><span className="text-xs text-brand-muted">{o.shipping_phone}</span></td>
                  <td className="whitespace-nowrap text-right font-medium">{formatRs(o.balance_due)}{Number(o.amount_received) > 0 ? <><br /><span className="text-xs text-brand-muted">of {formatRs(o.total)}</span></> : null}</td>
                  <td className="space-y-1"><PaymentStatusPill status={o.payment_status} />{o.payment_customer_note ? <p className="text-xs">“{o.payment_customer_note}”</p> : null}
                    {o.stock_issue ? <Pill label="Paid — out of stock" tone="error" /> : null}</td>
                  <td className="whitespace-nowrap">{formatDeadline(o.payment_due_at)}{o.is_overdue ? <><br /><Pill label="Overdue" tone="error" /></> : null}</td>
                  <td>{o.payment_status !== 'paid' ? <QuickBankPayment orderId={o.id} orderNumber={o.order_number} balance={Number(o.balance_due)} /> : <Link href={`/admin/orders/${o.id}`}>Resolve stock →</Link>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
