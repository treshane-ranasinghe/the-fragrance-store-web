'use client';
import { useTranslations } from 'next-intl';
import { useActionState } from 'react';
import { changePasswordAction, deleteAccountAction } from '@/lib/actions/account';

export function ChangePasswordForm() {
  const t = useTranslations();
  const [state, action, pending] = useActionState(changePasswordAction, undefined);
  return (
    <form action={action} className="ac__card" noValidate>
      <h2 className="ac__h2">{t('account.changePassword')}</h2>
      <div className="fields">
        <div className="field field--full"><label htmlFor="pw-c">{t('account.currentPassword')}</label><input id="pw-c" name="current" type="password" required autoComplete="current-password" /></div>
        <div className="field"><label htmlFor="pw-n">{t('auth.newPassword')} <small>{t('auth.min8')}</small></label><input id="pw-n" name="password" type="password" required minLength={8} autoComplete="new-password" /></div>
        <div className="field"><label htmlFor="pw-r">{t('account.confirm')}</label><input id="pw-r" name="confirm" type="password" required minLength={8} autoComplete="new-password" /></div>
      </div>
      {state?.error ? <p className="co__error" role="alert" style={{ marginTop: 16 }}>{state.error}</p> : null}
      {state?.ok ? <p className="ac__small" role="status" style={{ marginTop: 16, color: 'var(--gold-light)' }}>{state.ok}</p> : null}
      <button className="btn btn--ghost btn--block" disabled={pending}>{pending ? t('common.saving') : t('account.updatePassword')}</button>
    </form>
  );
}

export function DeleteAccountForm() {
  const t = useTranslations('account');
  const [state, action, pending] = useActionState(deleteAccountAction, undefined);
  return (
    <form action={action} className="ac__card ac__danger" noValidate>
      <h2 className="ac__h2">{t('deleteTitle')}</h2>
      <p className="ac__small">{t.rich('deleteText', { b: (c) => <b>{c}</b> })}</p>
      <div className="field" style={{ marginTop: 16 }}><label htmlFor="del">{t('typeDelete')}</label><input id="del" name="confirm" required autoComplete="off" /></div>
      {state?.error ? <p className="co__error" role="alert" style={{ marginTop: 16 }}>{state.error}</p> : null}
      <button className="btn btn--ghost btn--block" disabled={pending}>{pending ? t('deleting') : t('deleteTitle')}</button>
    </form>
  );
}
