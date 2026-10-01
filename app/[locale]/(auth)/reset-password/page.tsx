import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard, AuthPage, ResetForm } from '@/components/store/AuthForms';
import { pageLocale } from '@/i18n/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('reset') };
}

export default async function Page({ params }: Props) {
  await pageLocale(params);
  return <AuthPage><AuthCard next="/account"><ResetForm /></AuthCard></AuthPage>;
}
