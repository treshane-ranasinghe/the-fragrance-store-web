import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { getTranslations } from 'next-intl/server';
import { RootDocument } from '@/components/RootDocument';
import { routing } from '@/i18n/routing';
import { pageLocale } from '@/i18n/server';
import { STORE_NAME } from '@/lib/config';

type Props = { children: React.ReactNode; params: Promise<{ locale: string }> };

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    title: { default: t('defaultTitle'), template: `%s | ${STORE_NAME}` },
    description: t('defaultDescription'),
    openGraph: { siteName: STORE_NAME, locale: locale === 'si' ? 'si_LK' : 'en_LK', type: 'website' },
  };
}

/** Storefront root: <html lang="en|si"> */
export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  await pageLocale(params);
  return (
    <RootDocument lang={locale}>{children}</RootDocument>
  );
}
