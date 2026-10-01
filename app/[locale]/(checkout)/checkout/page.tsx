import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CheckoutForm } from '@/components/store/CheckoutForm';
import { redirect } from '@/i18n/navigation';
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
    return <CheckoutForm addresses={[]} methods={deliveryMethods} profile={{ full_name: '', phone: '' }} email={null} paymentText={paymentText} />;
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return redirect({ href: '/login?next=/checkout', locale });
  const [profile, addresses, methods] = await Promise.all([
    supabase.from('profiles').select('full_name, phone').eq('id', user.id).maybeSingle(),
    supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at'),
    supabase.from('delivery_methods').select('id, name, description, fee, free_over, cod_allowed, requires_address, i18n').eq('is_active', true).order('sort_order'),
  ]);
  return <CheckoutForm addresses={addresses.data ?? []} methods={localizeRows(methods.data ?? [], locale)} profile={profile.data ?? { full_name: null, phone: null }}
    email={user.email ?? null} paymentText={paymentText} />;
}
