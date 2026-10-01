import { formatDateTime, formatRs } from '@/lib/format';
import type { Order, OrderItem } from '@/lib/types';

/** Items with the price paid at the time (from order_items); bundles show their contents */
export function OrderItemsTable({ items, order }: { items: OrderItem[]; order: Order }) {
  const top = items.filter((i) => !i.parent_item_id);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead><tr className="border-b border-brand-beige text-left text-brand-muted"><th className="py-2 font-medium">Item</th><th className="py-2 text-right font-medium">Price</th><th className="py-2 text-right font-medium">Qty</th><th className="py-2 text-right font-medium">Total</th></tr></thead>
        <tbody>
          {top.map((i) => (
            <tr key={i.id} className="border-b border-brand-beige/60 align-top">
              <td className="py-3">
                <p className="font-medium">{i.brand_name && i.brand_name !== 'Bundle' ? `${i.brand_name} ` : ''}{i.product_name}{i.size_ml ? ` ${i.size_ml} ml` : ''}</p>
                {i.bundle_id ? <ul className="mt-1 text-brand-muted">{items.filter((c) => c.parent_item_id === i.id).map((c) => <li key={c.id}>· {c.product_name} {c.size_ml} ml × {c.quantity}</li>)}</ul> : null}
                {Number(i.discount_amount) > 0 ? <p className="text-xs text-brand-gold-dark">Saved {formatRs(i.discount_amount)} each (was {formatRs(i.original_unit_price)})</p> : null}
              </td>
              <td className="py-3 text-right">{formatRs(i.unit_price)}</td>
              <td className="py-3 text-right">{i.quantity}</td>
              <td className="py-3 text-right">{formatRs(i.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <dl className="ml-auto mt-4 max-w-xs space-y-1 text-sm">
        <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatRs(order.subtotal)}</dd></div>
        <div className="flex justify-between"><dt>Delivery{order.delivery_method_name ? ` (${order.delivery_method_name})` : ''}</dt><dd>{Number(order.delivery_fee) ? formatRs(order.delivery_fee) : 'Free'}</dd></div>
        {Number(order.cod_fee) ? <div className="flex justify-between"><dt>Cash on delivery fee</dt><dd>{formatRs(order.cod_fee)}</dd></div> : null}
        {Number(order.discount) ? <div className="flex justify-between"><dt>Discount</dt><dd>−{formatRs(order.discount)}</dd></div> : null}
        <div className="flex justify-between border-t border-brand-beige pt-2 text-base font-semibold"><dt>Total</dt><dd>{formatRs(order.total)}</dd></div>
      </dl>
    </div>
  );
}

export function AddressBlock({ o }: { o: Order }) {
  return (
    <address className="not-italic text-sm leading-relaxed">
      <strong>{o.shipping_name}</strong>{o.shipping_phone ? <> · {o.shipping_phone}</> : null}<br />
      {o.shipping_line1}{o.shipping_line2 ? <>, {o.shipping_line2}</> : null}<br />
      {o.shipping_city}, {o.shipping_district}{o.shipping_postal_code ? ` ${o.shipping_postal_code}` : ''}
    </address>
  );
}

/** Placed → On hold / Processing → Shipped → Delivered → Completed, with dates */
export function OrderTimeline({ o }: { o: Order }) {
  const cancelled = o.status === 'cancelled';
  const steps: { label: string; at: string | null; note?: string }[] = [
    { label: 'Placed', at: o.created_at },
    o.payment_method === 'bank_transfer'
      ? { label: o.paid_at ? 'Payment received' : 'On hold — awaiting payment', at: o.paid_at }
      : { label: o.cod_confirmed_at ? 'Confirmed' : 'Awaiting confirmation', at: o.cod_confirmed_at },
    { label: 'Processing', at: o.stock_reduced_at },
    { label: 'Shipped', at: o.shipped_at, note: o.courier_name ? `${o.courier_name}${o.tracking_number ? ` · ${o.tracking_number}` : ''}` : undefined },
    { label: 'Delivered', at: o.delivered_at },
    { label: 'Completed', at: o.completed_at },
  ];
  return (
    <ol className="relative space-y-4 border-l-2 border-brand-beige pl-6">
      {steps.map((s, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 ${s.at ? 'border-brand-green bg-brand-green' : 'border-brand-beige bg-white'}`} aria-hidden />
          <p className={s.at ? 'font-medium' : 'text-brand-muted'}>{s.label}</p>
          {s.at ? <p className="text-xs text-brand-muted">{formatDateTime(s.at)}</p> : null}
          {s.note ? <p className="text-sm">{s.note}</p> : null}
        </li>
      ))}
      {cancelled ? (
        <li className="relative">
          <span className="absolute -left-[31px] top-1 h-4 w-4 rounded-full border-2 border-state-error bg-state-error" aria-hidden />
          <p className="font-medium text-state-error">Cancelled</p>
          <p className="text-xs text-brand-muted">{formatDateTime(o.cancelled_at)}</p>
        </li>
      ) : null}
      {o.status === 'returned' ? <li className="font-medium text-state-error">Returned{o.failure_reason ? `: ${o.failure_reason}` : ''}</li> : null}
    </ol>
  );
}
