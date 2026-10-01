import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ChangePasswordForm, DeleteAccountForm } from '@/components/store/SecurityForms';
import { pageLocale } from '@/i18n/server';
import { logoutAction } from '@/lib/actions/auth';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('security') };
}

export default async function SecurityPage({ params }: Props) {
  await pageLocale(params);
  const t = await getTranslations('account');
  return (
    <div className="ac__grid">
      <ChangePasswordForm />
      <aside className="ac__side">
        <form action={logoutAction} className="ac__card">
          <h2 className="ac__h2">{t('sessions')}</h2>
          <p className="ac__small">{t('sessionsLead')}</p>
          <input type="hidden" name="scope" value="global" />
          <button className="btn btn--ghost btn--block">{t('logoutAll')}</button>
        </form>
        <DeleteAccountForm />
      </aside>
    </div>
  );
}
