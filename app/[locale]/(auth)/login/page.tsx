import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AuthCard, AuthPage, LoginForm } from '@/components/store/AuthForms';
import { pageLocale } from '@/i18n/server';
import { googleSignInEnabled } from '@/lib/auth-providers';

type Props = { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string; error?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('signIn') };
}

export default async function Page({ params, searchParams }: Props) {
  await pageLocale(params);
  const { next, error } = await searchParams;
  const safe = next?.startsWith('/') && !next.startsWith('//') ? next : '/account';
  return <AuthPage><AuthCard tab="signin" next={safe}><LoginForm next={safe} linkError={error === 'link'} googleError={error === 'google'} google={await googleSignInEnabled()} /></AuthCard></AuthPage>;
}
