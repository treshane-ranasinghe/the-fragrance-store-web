import 'server-only';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { formatDate, formatRs } from '@/lib/format';
import { PAYMENT_METHOD, PAYMENT_STATUS } from '@/lib/status';
import type { Order, OrderItem, PublicSettings } from '@/lib/types';

const GREEN = rgb(0x18 / 255, 0x3f / 255, 0x32 / 255);
const MUTED = rgb(0x5b / 255, 0x66 / 255, 0x60 / 255);
const GOLD = rgb(0xc6 / 255, 0xa5 / 255, 0x66 / 255);

/** Invoice PDF (also usable as a packing slip): bundles list their contents */
export async function buildInvoicePdf(o: Order, items: OrderItem[], s: PublicSettings, kind: 'invoice' | 'packing' = 'invoice') {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const serif = await pdf.embedFont(StandardFonts.TimesRomanBold);
  // Standard PDF fonts are WinAnsi only: strip characters they can't draw
  const clean = (t: unknown) => String(t ?? '').replace(/[^\x20-\x7E -ÿ]/g, (c) => (c === '−' || c === '–' || c === '—' ? '-' : c === '’' || c === '‘' ? "'" : ''));
  let y = 790;
  const text = (t: unknown, x: number, size = 10, f = font, color = rgb(0.11, 0.16, 0.14)) => page.drawText(clean(t), { x, y, size, font: f, color });
  const right = (t: unknown, xr: number, size = 10, f = font) => { const s2 = clean(t); page.drawText(s2, { x: xr - f.widthOfTextAtSize(s2, size), y, size, font: f }); };

  text(s.store_name, 50, 22, serif, GREEN);
  right(kind === 'invoice' ? 'INVOICE' : 'PACKING SLIP', 545, 14, bold);
  y -= 16; text([s.store_address, s.store_phone, s.store_email].filter(Boolean).join('  ·  '), 50, 9, font, MUTED);
  y -= 8; page.drawLine({ start: { x: 50, y }, end: { x: 545, y }, thickness: 1, color: GOLD });

  y -= 26;
  text('Order', 50, 9, font, MUTED); text('Date', 200, 9, font, MUTED); text('Payment', 330, 9, font, MUTED);
  y -= 14;
  text(o.order_number, 50, 11, bold); text(formatDate(o.created_at), 200, 11); text(`${PAYMENT_METHOD[o.payment_method]} - ${PAYMENT_STATUS[o.payment_status].label}`, 330, 11);

  y -= 30; text('Deliver to', 50, 9, font, MUTED); y -= 14;
  for (const line of [o.shipping_name, o.shipping_phone, [o.shipping_line1, o.shipping_line2].filter(Boolean).join(', '), `${o.shipping_city ?? ''}, ${o.shipping_district ?? ''} ${o.shipping_postal_code ?? ''}`, o.delivery_method_name]) {
    if (line && String(line).trim() && String(line).trim() !== ',') { text(line, 50, 10); y -= 13; }
  }

  y -= 16;
  page.drawRectangle({ x: 50, y: y - 4, width: 495, height: 18, color: rgb(0.96, 0.94, 0.9) });
  text('Item', 56, 9, bold); if (kind === 'invoice') { right('Price', 400, 9, bold); right('Total', 540, 9, bold); } right('Qty', 460, 9, bold);
  y -= 20;
  for (const i of items.filter((x) => !x.parent_item_id)) {
    if (y < 120) break;
    text(`${i.brand_name && i.brand_name !== 'Bundle' ? i.brand_name + ' ' : ''}${i.product_name}${i.size_ml ? ` ${i.size_ml} ml` : ''}`.slice(0, 70), 56, 10);
    if (kind === 'invoice') { right(formatRs(i.unit_price), 400); right(formatRs(i.line_total), 540); }
    right(i.quantity, 460);
    y -= 14;
    for (const c of items.filter((x) => x.parent_item_id === i.id)) { text(`   - ${c.product_name} ${c.size_ml ?? ''} ml x ${c.quantity}${c.sku ? `  (${c.sku})` : ''}`, 56, 9, font, MUTED); y -= 12; }
    if (Number(i.discount_amount) > 0 && kind === 'invoice') { text(`   Promotion: saved ${formatRs(i.discount_amount)} each`, 56, 8, font, MUTED); y -= 11; }
    y -= 4;
  }
  if (kind === 'invoice') {
    y -= 6; page.drawLine({ start: { x: 330, y: y + 8 }, end: { x: 545, y: y + 8 }, thickness: 0.5, color: MUTED });
    const tot = (l: string, v: number, b = false) => { text(l, 340, 10, b ? bold : font); right(formatRs(v), 540, 10, b ? bold : font); y -= 15; };
    tot('Subtotal', o.subtotal); tot('Delivery', o.delivery_fee);
    if (Number(o.cod_fee)) tot('Cash on delivery fee', o.cod_fee);
    if (Number(o.discount)) tot('Discount', -o.discount);
    tot('Total', o.total, true);
    tot('Paid', o.amount_received);
  } else if (o.customer_note) {
    y -= 10; text(`Customer note: ${o.customer_note}`.slice(0, 100), 50, 10);
  }
  page.drawText(clean(`Thank you for shopping with ${s.store_name}.`), { x: 50, y: 50, size: 9, font, color: MUTED });
  return pdf.save();
}
