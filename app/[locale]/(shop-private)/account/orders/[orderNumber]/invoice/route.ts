import { NextResponse } from 'next/server';
import { getSettings } from '@/lib/data';
import { buildInvoicePdf } from '@/lib/invoice';
import { createClient } from '@/lib/supabase/server';
import type { Order, OrderItem } from '@/lib/types';

/** Invoice PDF for the customer's own order (admins can open any order; RLS decides) */
export async function GET(request: Request, { params }: { params: Promise<{ orderNumber: string }> }) {
  const { orderNumber } = await params;
  const supabase = await createClient();
  const { data: order } = await supabase.from('orders').select('*').eq('order_number', orderNumber).maybeSingle();
  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { data: items } = await supabase.from('order_items').select('*').eq('order_id', order.id).order('parent_item_id', { nullsFirst: true });
  const { settings } = await getSettings();
  const kind = new URL(request.url).searchParams.get('type') === 'packing' ? 'packing' : 'invoice';
  const bytes = await buildInvoicePdf(order as Order, (items ?? []) as OrderItem[], settings, kind);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${kind === 'packing' ? 'inline' : 'attachment'}; filename="${kind}-${orderNumber}.pdf"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
