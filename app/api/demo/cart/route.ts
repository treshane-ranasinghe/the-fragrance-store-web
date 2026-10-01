import { NextResponse, type NextRequest } from 'next/server';
import { DEMO_MODE } from '@/lib/config';
import { demoCart, demoStock } from '@/lib/demo';

/** Demo mode only: turns the browser-stored cart lines into a priced cart, and checks stock on add */
export async function POST(request: NextRequest) {
  if (!DEMO_MODE) return NextResponse.json({ error: 'Not available' }, { status: 404 });
  const body = (await request.json()) as { lines: { variantId?: string; bundleId?: string; quantity: number }[]; check?: { variantId?: string; bundleId?: string; quantity: number } };
  if (body.check) {
    const s = demoStock(body.check.variantId, body.check.bundleId);
    if (!s) return NextResponse.json({ error: 'This item is no longer available' });
    if (s.max != null && body.check.quantity > s.max) return NextResponse.json({ error: `You can buy up to ${s.max} of ${s.name}` });
    if (body.check.quantity > s.stock) return NextResponse.json({ error: s.stock <= 0 ? `${s.name} is out of stock` : `Only ${s.stock} left of ${s.name}` });
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json(demoCart(body.lines ?? []));
}
