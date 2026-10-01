'use client';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import Image from 'next/image';
import { saveAvatarPathAction, updateProfileAction } from '@/lib/actions/account';
import { createClient } from '@/lib/supabase/client';

export function ProfileForm({ userId, profile, email, avatarUrl }: {
  userId: string; email: string; avatarUrl: string | null;
  profile: { full_name: string | null; phone: string | null; date_of_birth: string | null; marketing_opt_in: boolean };
}) {
  const t = useTranslations();
  const [state, action, pending] = useActionState(updateProfileAction, undefined);
  const [avatar, setAvatar] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const [avatarError, setAvatarError] = useState('');
  return (
    <form action={action} className="ac__card" noValidate>
      <h2 className="ac__h2">{t('account.yourDetails')}</h2>
      <div className="ac__avatar">
        <span className="ac__avatar-img ph-bottle">{avatar ? <Image src={avatar} alt={t('account.photo')} fill sizes="72px" unoptimized /> : null}</span>
        <span className="ac__row" style={{ justifyContent: 'flex-start' }}>
          <label className="btn btn--ghost btn--sm" style={{ cursor: 'pointer' }}>{uploading ? t('account.uploading') : t('account.changePhoto')}
            <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              if (file.size > 2 * 1024 * 1024) return setAvatarError(t('account.photoTooBig'));
              setUploading(true); setAvatarError('');
              const supabase = createClient();
              const path = `${userId}/${Date.now()}-${file.name.replace(/[^a-z0-9.]+/gi, '-')}`;
              const { error } = await supabase.storage.from('avatars').upload(path, file);
              if (error) { setAvatarError(error.message); setUploading(false); return; }
              await saveAvatarPathAction(path);
              const { data } = await supabase.storage.from('avatars').createSignedUrl(path, 3600);
              setAvatar(data?.signedUrl ?? null); setUploading(false);
            }} /></label>
          {avatar ? <button type="button" className="co__link" onClick={async () => { await saveAvatarPathAction(null); setAvatar(null); }}>{t('common.remove')}</button> : null}
        </span>
      </div>
      {avatarError ? <p className="co__error">{avatarError}</p> : null}
      <div className="fields">
        <div className="field field--full"><label htmlFor="p-name">{t('checkout.fullName')}</label><input id="p-name" name="full_name" required defaultValue={profile.full_name ?? ''} autoComplete="name" /></div>
        <div className="field"><label htmlFor="p-phone">{t('checkout.mobile')}</label><input id="p-phone" name="phone" type="tel" required defaultValue={profile.phone ?? ''} placeholder={t('checkout.phonePlaceholder')} autoComplete="tel" /></div>
        <div className="field"><label htmlFor="p-dob">{t('account.dob')} <small>{t('common.optional')}</small></label><input id="p-dob" name="date_of_birth" type="date" defaultValue={profile.date_of_birth ?? ''} /></div>
        <div className="field field--full"><label htmlFor="p-email">{t('auth.email')} <small>{t('account.emailHint')}</small></label><input id="p-email" name="email" type="email" required defaultValue={email} autoComplete="email" /></div>
        <div className="field field--full"><label className="ac__check"><input type="checkbox" name="marketing_opt_in" defaultChecked={profile.marketing_opt_in} /> {t('account.marketing')}</label></div>
      </div>
      {state?.error ? <p className="co__error" role="alert" style={{ marginTop: 16 }}>{state.error}</p> : null}
      {state?.ok ? <p className="ac__small" role="status" style={{ marginTop: 16, color: 'var(--gold-light)' }}>{state.ok}</p> : null}
      <button className="btn btn--gold btn--block" disabled={pending}>{pending ? t('common.saving') : t('account.saveDetails')}</button>
    </form>
  );
}
