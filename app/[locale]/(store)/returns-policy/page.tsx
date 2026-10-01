import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { InfoPage } from '@/components/store/InfoPage';
import { localeAlternates, pageLocale } from '@/i18n/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: t('returnsTitle'), description: t('returnsDescription'), alternates: localeAlternates('/returns-policy', locale) };
}

// NOTE: policy wording to be confirmed by the store owner (spec open decision #6)
export default async function Page({ params }: Props) {
  await pageLocale(params);
  const t = await getTranslations('info');
  return (
    <InfoPage title={t('returnsTitle')} eyebrow={t('clientCare')}>
      <p>{t('returnsP1')}</p>
      <h2>{t('damagedTitle')}</h2>
      <p>{t('damaged')}</p>
      <h2>{t('unopenedTitle')}</h2>
      <p>{t('unopened')}</p>
      <h2>{t('refundsTitle')}</h2>
      <p>{t('refunds')}</p>
    </InfoPage>
  );
}
