import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { InfoPage } from '@/components/store/InfoPage';
import { localeAlternates, pageLocale } from '@/i18n/server';
import { waLink } from '@/components/site/wa';
import { getSiteInfo } from '@/lib/site';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: t('termsTitle'), alternates: localeAlternates('/terms', locale) };
}

export default async function Page({ params }: Props) {
  await pageLocale(params);
  const [t, tw, site] = await Promise.all([getTranslations('info'), getTranslations('wa'), getSiteInfo()]);
  return (
    <InfoPage title={t('termsTitle')} eyebrow={t('smallPrint')}>
      <p>{t('termsIntro')}</p>
      <h2>{t('pricesTitle')}</h2>
      <p>{t('prices')}</p>
      <h2>{t('ordersTitle')}</h2>
      <p>{t('orders')}</p>
      <h2>{t('stockTitle')}</h2>
      <p>{t('stock')}</p>
      <h2>{t('contactTitle')}</h2>
      <p>{t.rich('contact', { link: (c) => <a href={waLink(site.whatsapp, tw('enquire'))} target="_blank" rel="noopener noreferrer">{c}</a> })}</p>
    </InfoPage>
  );
}
