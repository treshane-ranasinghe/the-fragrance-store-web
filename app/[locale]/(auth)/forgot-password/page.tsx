import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard, AuthPage, ForgotForm } from '@/components/store/AuthForms';
import { pageLocale } from '@/i18n/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('forgot') };
}

export default async function Page({ params }: Props) {
  await pageLocale(params);
  return <AuthPage><AuthCard next="/account"><ForgotForm /></AuthCard></AuthPage>;
}
