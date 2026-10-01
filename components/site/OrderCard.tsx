import Image from 'next/image';
import { useLocale, useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';
import { formatDate } from '@/lib/format';
import { orderBadge, ORDER_STATUS } from '@/lib/status';
import { productImage } from '@/lib/storage';
import type { OrderStatus } from '@/lib/types';
import { money } from './money';

const TONE: Record<string, 'good' | 'info' | 'bad'> = { success: 'good', info: 'info', neutral: 'info', warning: 'info', error: 'bad' };

/** 4-step progress line from the original account page */
export function OrderSteps({ status, method }: { status: OrderStatus; method: string }) {
  const t = useTranslations('status');
  const steps = [t('stepPlaced'), method === 'bank_transfer' ? t('stepPaid') : t('stepConfirmed'), t('stepShipped'), t('stepDelivered')];
  const at = { pending: 0, on_hold: 0, processing: 1, shipped: 2, delivered: 3, completed: 4, returned: 2, cancelled: -1 }[status];
  if (at < 0) return null;
  return (
    <ol className="ac__steps" aria-label={t('stepsAria')}>
      {steps.map((s, i) => <li key={s} className={i < at || (i === 3 && at >= 3) ? 'is-done' : i === at ? 'is-now' : ''}>{s}</li>)}
    </ol>
  );
}

export function StatusBadge({ label, tone }: { label: string; tone: string }) {
  return <span className={`ac__status ac__status--${TONE[tone] ?? 'info'}`}>{label}</span>;
}

export function OrderStatusBadge({ o }: { o: { status: OrderStatus; payment_status: string; payment_method: string; total: number; amount_received: number; tracking_number: string | null } }) {
  const t = useTranslations('status');
  const b = ['pending', 'on_hold', 'processing', 'shipped'].includes(o.status)
    ? orderBadge(o as never)
    : { id: `order_${o.status}`, tone: ORDER_STATUS[o.status].tone };
  return <StatusBadge label={t(b.id, b.values)} tone={b.tone} />;
}

export function OrderCard({ o, items, children }: {
  o: { order_number: string; created_at: string; status: OrderStatus; payment_status: string; payment_method: string; total: number; amount_received: number; tracking_number: string | null };
  items: { name: string; size_ml: number | null; quantity: number; image_path?: string | null; price?: number | null }[];
  children?: React.ReactNode;
}) {
  const t = useTranslations();
  const locale = useLocale();
  return (
    <article className="ac__order">
      <header className="ac__order-head">
        <div><p className="ac__ref">{o.order_number}</p><p className="ac__date">{formatDate(o.created_at, locale)}</p></div>
        <OrderStatusBadge o={o} />
      </header>
      <OrderSteps status={o.status} method={o.payment_method} />
      <ul className="ac__items">
        {items.map((i, k) => (
          <li key={k}>
            <span className="ac__thumb ph-bottle">{productImage(i.image_path) ? <Image src={productImage(i.image_path)!} alt="" fill sizes="44px" /> : null}</span>
            <span>{i.name}<small>{i.size_ml ? `${t('common.ml', { size: i.size_ml })} · ` : ''}× {i.quantity}</small></span>
            {i.price != null ? <b>{money(i.price)}</b> : <span />}
          </li>
        ))}
      </ul>
      {children}
      <footer className="ac__order-foot">
        <Link href={`/account/orders/${o.order_number}`} className="co__link">{t('cart.viewOrder')}</Link>
        <b>{money(o.total)}</b>
      </footer>
    </article>
  );
}
