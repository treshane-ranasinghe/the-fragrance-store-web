import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { InfoPage } from '@/components/store/InfoPage';
import { localeAlternates, pageLocale } from '@/i18n/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: t('privacyTitle'), alternates: localeAlternates('/privacy', locale) };
}

export default async function Page({ params }: Props) {
  await pageLocale(params);
  const t = await getTranslations('info');
  return (
    <InfoPage title={t('privacyTitle')} eyebrow={t('smallPrint')}>
      <p>{t('privacyIntro')}</p>
      <h2>{t('collectTitle')}</h2>
      <ul>
        <li>{t('collect1')}</li>
        <li>{t('collect2')}</li>
        <li>{t('collect3')}</li>
      </ul>
      <h2>{t('useTitle')}</h2>
      <p>{t('use')}</p>
      <h2>{t('deleteTitle')}</h2>
      <p>{t.rich('delete', { b: (c) => <strong>{c}</strong> })}</p>
    </InfoPage>
  );
}
