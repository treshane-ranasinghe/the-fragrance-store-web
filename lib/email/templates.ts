import { formatDeadline, formatRs } from '@/lib/format';
import { SITE_URL, STORE_NAME } from '@/lib/config';

interface Job {
  template: string;
  payload: Record<string, unknown>;
  order: Record<string, unknown> & { order_number: string; total: number; amount_received: number; payment_method: string };
  customer_name: string | null;
  items: { product_name: string; size_ml: number | null; quantity: number; unit_price: number; line_total: number; parent_item_id: string | null; bundle_id: string | null }[] | null;
}
interface Ctx { settings: Record<string, unknown>; bank_accounts: Record<string, string | null>[] }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const nl2br = (s: unknown) => esc(s).replace(/\n/g, '<br>');

function layout(title: string, body: string) {
  return `<!doctype html><html><body style="margin:0;background:#F5F0E6;font-family:Jost,Helvetica,Arial,sans-serif;color:#1D2924">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F5F0E6;padding:24px 0"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border:1px solid #DCCFB8">
<tr><td style="background:#12352B;padding:22px 28px;text-align:center"><p style="margin:0;font-family:Helvetica,Arial,sans-serif;font-weight:800;letter-spacing:.16em;font-size:10px;color:#E8D5A8;text-transform:uppercase">The Fragrance</p><p style="margin:2px 0 0;font-family:Helvetica,Arial,sans-serif;font-weight:900;font-size:26px;color:#ffffff">STORE</p></td></tr><tr><td style="height:3px;background:#C6A566;line-height:3px;font-size:0">&nbsp;</td></tr>
<tr><td style="padding:28px"><h1 style="margin:0 0 16px;font-family:Georgia,serif;font-weight:300;font-size:30px;color:#1D2924">${esc(title)}</h1>${body}</td></tr>
<tr><td style="background:#12352B;padding:16px 28px;color:#DCCFB8;font-size:12px;letter-spacing:.08em;text-align:center">${STORE_NAME} · <a href="${SITE_URL}" style="color:#C6A566">${SITE_URL.replace(/^https?:\/\//, '')}</a></td></tr>
</table></td></tr></table></body></html>`;
}

function orderTable(j: Job) {
  const o = j.order;
  const rows = (j.items ?? []).map((i) => i.parent_item_id
    ? `<tr><td style="padding:2px 0 2px 16px;color:#5B6660;font-size:13px">· ${esc(i.product_name)}${i.size_ml ? ` ${i.size_ml} ml` : ''} × ${i.quantity}</td><td></td></tr>`
    : `<tr><td style="padding:6px 0;border-top:1px solid #eee">${esc(i.product_name)}${i.size_ml ? ` ${i.size_ml} ml` : ''} × ${i.quantity}</td><td align="right" style="padding:6px 0;border-top:1px solid #eee">${formatRs(i.line_total)}</td></tr>`).join('');
  const line = (l: string, v: unknown, bold = false) => `<tr><td style="padding:4px 0;${bold ? 'font-weight:600' : ''}">${l}</td><td align="right" style="padding:4px 0;${bold ? 'font-weight:600' : ''}">${formatRs(v as number)}</td></tr>`;
  return `<h2 style="font-family:Georgia,serif;color:#7D6435;font-size:20px;margin:24px 0 8px">Order ${esc(o.order_number)}</h2>
<table width="100%" cellpadding="0" cellspacing="0" style="font-size:14px">${rows}
${line('Subtotal', o.subtotal)}${Number(o.delivery_fee) ? line('Delivery', o.delivery_fee) : ''}${Number(o.cod_fee) ? line('Cash on delivery fee', o.cod_fee) : ''}${line('Total', o.total, true)}</table>
<p style="font-size:13px;color:#5B6660;margin-top:16px">Delivering to: ${esc(o.shipping_name)}, ${esc(o.shipping_line1)}${o.shipping_line2 ? ', ' + esc(o.shipping_line2) : ''}, ${esc(o.shipping_city)}, ${esc(o.shipping_district)}</p>`;
}

function bankBlock(j: Job, c: Ctx) {
  const o = j.order;
  const due = Number(o.total) - Number(o.amount_received);
  const accounts = c.bank_accounts.map((a) => `<tr><td style="padding:10px;border:1px solid #DCCFB8;font-size:14px">
<strong style="color:#7D6435">${esc(a.bank_name)}${a.branch ? ' — ' + esc(a.branch) : ''}</strong><br>Account name: ${esc(a.account_name)}<br>Account number: <strong>${esc(a.account_number)}</strong>${a.branch_code ? '<br>Branch code: ' + esc(a.branch_code) : ''}${a.swift ? '<br>SWIFT: ' + esc(a.swift) : ''}</td></tr>`).join('');
  return `<p>${nl2br(c.settings.bacs_instructions)}</p>
<h2 style="font-family:Georgia,serif;color:#7D6435;font-size:20px;margin:20px 0 8px">Our bank details</h2>
<table width="100%" cellpadding="0" cellspacing="0">${accounts}</table>
<p style="background:#F5F0E6;border-left:3px solid #C6A566;padding:12px;margin-top:16px">Amount to pay: <strong>${formatRs(due)}</strong><br>Use <strong>${esc(o.order_number)}</strong> as the payment reference.${o.payment_due_at ? `<br>Please pay by ${formatDeadline(o.payment_due_at as string)}.` : ''}</p>`;
}

const btn = (href: string, text: string) => `<p style="margin:24px 0"><a href="${href}" style="background:#183F32;color:#F5F0E6;padding:14px 28px;text-decoration:none;font-size:11px;font-weight:600;letter-spacing:.26em;text-transform:uppercase">${text}</a></p>`;

export function renderEmail(j: Job, c: Ctx): { subject: string; html: string } | null {
  const o = j.order;
  const hi = `<p>Hi ${esc(j.customer_name || 'there')},</p>`;
  // Guest orders have no account page; the order page works in the browser they ordered from (or once they sign up)
  const guest = Boolean(o.guest_email);
  const link = btn(`${SITE_URL}${guest ? '/order' : '/account/orders'}/${o.order_number}`, 'View your order');
  const cash = formatRs(Number(o.total) - Number(o.amount_received));
  switch (j.template) {
    case 'order_on_hold':
      return { subject: `Your order ${o.order_number} is on hold — payment details inside`, html: layout('Thank you for your order', `${hi}<p>Your order has been received and is on hold until we confirm your payment.</p>${bankBlock(j, c)}${orderTable(j)}${link}`) };
    case 'order_received_cod':
      return { subject: `We've received your order ${o.order_number}`, html: layout('Thank you for your order', `${hi}<p>${nl2br(c.settings.cod_instructions)}</p><p style="background:#F5F0E6;border-left:3px solid #C6A566;padding:12px">Please keep <strong>${cash}</strong> ready for the courier.</p><p>We'll confirm your order shortly, usually by phone.</p>${orderTable(j)}${link}`) };
    case 'order_processing':
      return { subject: `Payment received — we're preparing order ${o.order_number}`, html: layout('Payment received', `${hi}<p>Thank you — your payment has reached our account and we're now preparing your order.</p>${orderTable(j)}${link}`) };
    case 'order_confirmed':
      return { subject: `Order ${o.order_number} confirmed`, html: layout('Your order is confirmed', `${hi}<p>Your order is confirmed and we're preparing it now. Please keep <strong>${cash}</strong> ready for the courier.</p>${orderTable(j)}${link}`) };
    case 'payment_partial':
      return { subject: `Part payment received for ${o.order_number}`, html: layout('Part payment received', `${hi}<p>We received <strong>${formatRs(j.payload.amount as number)}</strong>. The balance due is <strong>${formatRs(j.payload.balance as number)}</strong>.</p>${bankBlock(j, c)}${link}`) };
    case 'payment_not_found':
      return { subject: `We couldn't find your payment for ${o.order_number} yet`, html: layout("We haven't received your payment yet", `${hi}<p>We checked our bank account but couldn't find a payment for order <strong>${esc(o.order_number)}</strong> yet. Transfers can take a little time — please double-check that you used the order number as the reference, or contact us.</p>${bankBlock(j, c)}${link}`) };
    case 'payment_reminder':
      return { subject: `Reminder: payment for ${o.order_number}`, html: layout('A friendly reminder', `${hi}<p>We're still holding your order, but we haven't received the payment yet.</p>${bankBlock(j, c)}${link}`) };
    case 'order_shipped':
      return { subject: `Your order ${o.order_number} is on the way`, html: layout('Your order is on the way', `${hi}<p>Your order has been handed to <strong>${esc(o.courier_name)}</strong>${o.tracking_number ? ` — tracking number <strong>${esc(o.tracking_number)}</strong>` : ''}.</p>${o.payment_method === 'cod' ? `<p style="background:#F5F0E6;border-left:3px solid #C6A566;padding:12px">Please pay <strong>${formatRs(o.cod_amount_to_collect as number)}</strong> in cash to the courier.</p>` : ''}${link}`) };
    case 'order_completed':
      return { subject: `Order ${o.order_number} completed`, html: layout('Thank you!', `${hi}<p>Your payment has been received and your order is complete. We hope you love your new fragrance.</p>${btn(`${SITE_URL}${guest ? '/shop' : '/account/purchases'}`, 'Buy again')}`) };
    case 'order_cancelled':
      return { subject: `Order ${o.order_number} cancelled`, html: layout('Your order was cancelled', `${hi}<p>Order <strong>${esc(o.order_number)}</strong> has been cancelled${j.payload.reason ? `: ${esc(j.payload.reason)}` : ''}.</p>${Number(o.amount_received) > 0 ? '<p>We will refund the amount you paid to your bank account and let you know once it is done.</p>' : ''}<p>The items are back in your cart if you'd like to order again.</p>${btn(`${SITE_URL}/cart`, 'Go to cart')}`) };
    default:
      return null;
  }
}
