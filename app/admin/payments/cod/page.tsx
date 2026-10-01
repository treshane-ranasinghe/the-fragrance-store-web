import Link from 'next/link';
import { Card, Empty, PageHeader } from '@/components/admin/ui';
import { CodCashTable, QuickConfirm } from '@/components/admin/QuickForms';
import { NewOrderRefresher } from '@/components/admin/NewOrderRefresher';
import { Pill } from '@/components/ui/StatusPill';
import { requireAdmin } from '@/lib/admin';
import { formatDateTime, formatRs } from '@/lib/format';

export const metadata = { title: 'Cash on delivery' };

export default async function CodPage() {
  const { supabase } = await requireAdmin();
  const [{ data: toConfirm }, { data: cash }, { data: warnings }, { data: settings }] = await Promise.all([
    supabase.from('admin_orders').select('*').eq('payment_method', 'cod').eq('status', 'pending').order('created_at'),
    supabase.from('admin_orders').select('*').eq('payment_method', 'cod').eq('status', 'delivered').eq('payment_status', 'unpaid').order('delivered_at'),
    supabase.from('admin_stock_warnings').select('order_id, shortages'),
    supabase.from('store_settings').select('cod_remit_alert_days').single(),
  ]);
  const short = new Map((warnings ?? []).map((w) => [w.order_id, w.shortages as string]));
  const perCourier = Object.entries((cash ?? []).reduce<Record<string, number>>((acc, o) => { const k = o.courier_name ?? 'Unknown'; acc[k] = (acc[k] ?? 0) + Number(o.balance_due); return acc; }, {}));

  return (
    <div className="space-y-8">
      <NewOrderRefresher />
      <PageHeader title="Cash on delivery" />
      <Card title="COD orders to confirm" actions={<span className="text-xs text-brand-muted">Oldest first · call the customer, then confirm</span>}>
        {!toConfirm?.length ? <Empty>No COD orders waiting for confirmation.</Empty> : (
          <div className="overflow-x-auto">
            <table className="table-admin">
              <thead><tr><th>Order</th><th>Customer</th><th>Address</th><th className="text-right">Total</th><th className="text-right">Calls</th><th /></tr></thead>
              <tbody>
                {toConfirm.map((o) => (
                  <tr key={o.id}>
                    <td><Link href={`/admin/orders/${o.id}`} className="font-medium">{o.order_number}</Link><br /><span className="text-xs text-brand-muted">{formatDateTime(o.created_at)}</span>
                      {o.cod_needs_attention ? <><br /><Pill label="Consider cancelling" tone="warning" /></> : null}</td>
                    <td>{o.customer_name}<br /><a href={`tel:${o.shipping_phone}`} className="text-xs">{o.shipping_phone}</a></td>
                    <td className="text-xs">{o.shipping_line1}, {o.shipping_city}, {o.shipping_district}</td>
                    <td className="text-right">{formatRs(o.total)}</td>
                    <td className="text-right">{o.cod_call_attempts}</td>
                    <td>{short.has(o.id) ? <span className="text-xs text-state-error">Short: {short.get(o.id)}</span> : <QuickConfirm orderId={o.id} orderNumber={o.order_number} />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <section id="cash">
        <Card title="COD cash to collect" actions={<span className="text-xs text-brand-muted">Red after {settings?.cod_remit_alert_days ?? 7} days</span>}>
          {perCourier.length ? <p className="mb-4 flex flex-wrap gap-4 text-sm">{perCourier.map(([c, v]) => <span key={c}><strong>{c}:</strong> {formatRs(v)}</span>)}</p> : null}
          {!cash?.length ? <Empty>No COD cash outstanding.</Empty> : <CodCashTable rows={cash} alertDays={settings?.cod_remit_alert_days ?? 7} />}
        </Card>
      </section>
    </div>
  );
}
