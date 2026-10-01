import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { InfoPage } from '@/components/store/InfoPage';
import { localeAlternates, pageLocale } from '@/i18n/server';
import { getSettings } from '@/lib/data';
import { money } from '@/components/site/money';

export const revalidate = 300;

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = await pageLocale(params);
  const t = await getTranslations({ locale, namespace: 'meta' });
  return { title: t('deliveryTitle'), description: t('deliveryDescription'), alternates: localeAlternates('/delivery-policy', locale) };
}

export default async function Page({ params }: Props) {
  await pageLocale(params);
  const [{ deliveryMethods, settings }, t] = await Promise.all([getSettings(), getTranslations()]);
  return (
    <InfoPage title={t('info.deliveryTitle')} eyebrow={t('info.clientCare')} intro={t('info.deliveryIntro')}>
      <h2>{t('info.deliveryOptions')}</h2>
      <ul>
        {deliveryMethods.map((m) => (
          <li key={m.id}><strong>{m.name}</strong> — {Number(m.fee) === 0 ? t('common.free') : money(m.fee)}{m.free_over ? t('info.freeOver', { amount: money(m.free_over) }) : ''}{m.description ? `. ${m.description}` : ''}{!m.cod_allowed ? t('info.noCod') : ''}</li>
        ))}
      </ul>
      <h2>{t('info.whenTitle')}</h2>
      <p>{t('info.when')}</p>
      {settings.cod_enabled ? <><h2>{t('info.codTitle')}</h2><p>{t('info.codText')} {Number(settings.cod_fee) > 0 ? t('info.codFee', { amount: money(settings.cod_fee) }) : ''}</p></> : null}
    </InfoPage>
  );
}
