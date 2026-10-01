import { ORDER_STATUS, PAYMENT_STATUS, TONE_CLASSES } from '@/lib/status';
import type { OrderStatus, PaymentStatus } from '@/lib/types';

export function Pill({ label, tone = 'neutral', className = '' }: { label: string; tone?: keyof typeof TONE_CLASSES; className?: string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONE_CLASSES[tone]} ${className}`}>{label}</span>;
}

export function OrderStatusPill({ status }: { status: OrderStatus }) {
  const s = ORDER_STATUS[status];
  return <Pill label={s.label} tone={s.tone} />;
}

export function PaymentStatusPill({ status }: { status: PaymentStatus }) {
  const s = PAYMENT_STATUS[status];
  return <Pill label={s.label} tone={s.tone} />;
}
