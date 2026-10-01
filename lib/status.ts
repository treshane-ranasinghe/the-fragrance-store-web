import type { CartOrder, Order, OrderStatus, PaymentStatus } from '@/lib/types';
import { formatRs } from '@/lib/format';

type Tone = 'success' | 'warning' | 'error' | 'neutral' | 'info';

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone }> = {
  pending: { label: 'Pending confirmation', tone: 'warning' },
  on_hold: { label: 'On hold', tone: 'warning' },
  processing: { label: 'Processing', tone: 'info' },
  shipped: { label: 'Shipped', tone: 'info' },
  delivered: { label: 'Delivered', tone: 'success' },
  completed: { label: 'Completed', tone: 'success' },
  returned: { label: 'Returned', tone: 'error' },
  cancelled: { label: 'Cancelled', tone: 'error' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  unpaid: { label: 'Unpaid', tone: 'warning' },
  payment_notified: { label: 'Checking payment', tone: 'warning' },
  partially_paid: { label: 'Part paid', tone: 'warning' },
  paid: { label: 'Paid', tone: 'success' },
  refund_pending: { label: 'Refund pending', tone: 'error' },
  refunded: { label: 'Refunded', tone: 'neutral' },
};

export const PAYMENT_METHOD = { bank_transfer: 'Bank transfer', cod: 'Cash on delivery' } as const;

/** Badge shown on in-progress orders (03-cart.md); `id` is a key under "status" in messages/*.json */
export function orderBadge(o: Pick<CartOrder, 'status' | 'payment_status' | 'payment_method' | 'total' | 'amount_received' | 'tracking_number'>):
  { id: string; values?: Record<string, string>; tone: Tone } {
  if (o.status === 'on_hold') {
    if (o.payment_status === 'payment_notified') return { id: 'badge_checkingPayment', tone: 'warning' };
    if (o.payment_status === 'partially_paid') return { id: 'badge_balanceDue', values: { amount: formatRs(o.total - o.amount_received) }, tone: 'warning' };
    if (o.payment_status === 'paid') return { id: 'badge_paymentReceived', tone: 'success' };
    return { id: 'badge_awaitingPayment', tone: 'warning' };
  }
  if (o.status === 'pending') return { id: 'badge_awaitingConfirmation', tone: 'warning' };
  if (o.status === 'processing')
    return o.payment_method === 'cod' ? { id: 'badge_preparingCod', values: { amount: formatRs(o.total - o.amount_received) }, tone: 'info' } : { id: 'badge_preparing', tone: 'info' };
  if (o.status === 'shipped') return o.tracking_number ? { id: 'badge_onTheWayTracking', values: { tracking: o.tracking_number }, tone: 'info' } : { id: 'badge_onTheWay', tone: 'info' };
  return { id: `order_${o.status}`, tone: ORDER_STATUS[o.status].tone };
}

export const TONE_CLASSES: Record<Tone, string> = {
  success: 'bg-state-success/10 text-state-success',
  warning: 'bg-state-warning/10 text-state-warning',
  error: 'bg-state-error/10 text-state-error',
  info: 'bg-brand-green/10 text-brand-green',
  neutral: 'bg-brand-muted/10 text-brand-muted',
};

export function isInProgress(o: Pick<Order, 'status'>) {
  return ['pending', 'on_hold', 'processing', 'shipped'].includes(o.status);
}
