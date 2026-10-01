'use server';
import { after } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { LK_PHONE, normalisePhone } from '@/lib/format';
import { processEmailQueue } from '@/lib/email/process';

const placeSchema = (t: (key: string) => string) => z.object({
  checkoutToken: z.string().min(8),
  // Guests only (the database requires it for guest orders)
  email: z.string().trim().email(t('email')).optional(),
  address: z.object({
    full_name: z.string().trim().min(2, t('recipient')),
    phone: z.string().transform(normalisePhone).refine((p) => LK_PHONE.test(p), t('phone')),
    line1: z.string().trim().min(3, t('address')),
    line2: z.string().trim().optional().default(''),
    city: z.string().trim().min(2, t('city')),
    district: z.string().trim().min(2, t('district')),
    postal_code: z.string().trim().optional().default(''),
  }),
  deliveryMethodId: z.string().uuid(t('deliveryMethod')),
  paymentMethod: z.enum(['bank_transfer', 'cod'], { message: t('paymentMethod') }),
  note: z.string().max(500).optional(),
  expectedTotal: z.number(),
  saveAddress: z.boolean().optional(),
});

export type PlaceOrderResult = { ok: true; orderNumber: string } | { ok: false; error: string; priceChanged?: boolean };

export async function placeOrderAction(input: z.input<ReturnType<typeof placeSchema>>): Promise<PlaceOrderResult> {
  const parsed = placeSchema(await getTranslations('errors')).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const d = parsed.data;
  const supabase = await createClient();

  // Totals are recalculated in the database; expectedTotal only detects price changes
  const { data, error } = await supabase.rpc('place_order', {
    p_checkout_token: d.checkoutToken,
    p_address: d.address,
    p_delivery_method_id: d.deliveryMethodId,
    p_payment_method: d.paymentMethod,
    p_note: d.note || null,
    p_expected_total: d.expectedTotal,
    // Only sent for guests, so signed-in checkout keeps working before the guest-checkout migration is applied
    ...(d.email ? { p_email: d.email } : {}),
  });
  if (error) {
    const priceChanged = error.message.startsWith('PRICE_CHANGED');
    // The checkout form shows the database message in the page language (lib/db-errors.ts)
    return { ok: false, error: error.message, priceChanged };
  }
  const result = data as { order_number: string; duplicate: boolean };

  if (d.saveAddress && !result.duplicate) {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) await supabase.from('addresses').insert({ ...d.address, user_id: user.id });
  }
  after(() => processEmailQueue().catch(() => {}));
  return { ok: true, orderNumber: result.order_number };
}
