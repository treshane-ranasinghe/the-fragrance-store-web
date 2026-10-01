import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CheckoutForm } from '@/components/store/CheckoutForm';
import { pageLocale } from '@/i18n/server';
import { DEMO_MODE } from '@/lib/config';
import { getSettings } from '@/lib/data';
import { localizeRows } from '@/lib/i18n-content';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('checkout') };
}

export default async function CheckoutPage({ params }: Props) {
  const locale = await pageLocale(params);
  // Payment names / descriptions in the page language (the checkout_options RPC returns the English ones)
  const { settings, deliveryMethods } = await getSettings();
  const paymentText = {
    bank: { title: settings.bacs_title, description: settings.bacs_description },
    cod: { title: settings.cod_title, description: settings.cod_description },
  };
  if (DEMO_MODE) {
    return <CheckoutForm addresses={[]} methods={deliveryMethods} profile={{ full_name: '', phone: '' }} email={null} guest paymentText={paymentText} />;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  // Guests (no login, or the guest session the bag lives in) check out with their email; no saved addresses
  const guest = !user || Boolean(user.is_anonymous);
  const [profile, addresses, methods] = await Promise.all([
    user ? supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle() : Promise.resolve({ data: null }),
    user && !guest ? supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at') : Promise.resolve({ data: [] }),
    supabase.from('delivery_methods').select('id, name, description, fee, free_over, cod_allowed, requires_address, i18n').eq('is_active', true).order('sort_order'),
  ]);
  return <CheckoutForm addresses={addresses.data ?? []} methods={localizeRows(methods.data ?? [], locale)} profile={profile.data ?? { full_name: null, phone: null }}
    email={guest ? null : user?.email ?? null} guest={guest} paymentText={paymentText} />;
}
