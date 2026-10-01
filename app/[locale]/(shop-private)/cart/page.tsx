import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CartView } from '@/components/store/CartView';
import { pageLocale } from '@/i18n/server';
import { getSettings } from '@/lib/data';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('cart') };
}

export default async function CartPage({ params }: Props) {
  await pageLocale(params);
  const { bankAccounts, settings } = await getSettings();
  return (
    <section className="section section--dark page">
      <div className="container co"><CartView bankAccounts={bankAccounts} bacsInstructions={settings.bacs_instructions} /></div>
    </section>
  );
}
