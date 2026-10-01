'use client';
import { useTranslations } from 'next-intl';
import { useActionState, useEffect, useState } from 'react';
import { saveAddressAction } from '@/lib/actions/account';
import { DistrictOptions } from './DistrictOptions';

type Addr = { id?: string; full_name: string; phone: string; line1: string; line2: string | null; city: string; district: string; postal_code: string | null; is_default: boolean };

export function AddressForm({ address, label }: { address?: Addr; label?: string }) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(saveAddressAction, undefined);
  useEffect(() => { if (state?.ok) setOpen(false); }, [state]);
  if (!open) return <button type="button" className={address ? 'co__link' : 'btn btn--ghost btn--sm'} onClick={() => setOpen(true)}>{label ?? t('account.addAddress')}</button>;
  const k = address?.id ?? 'new';
  return (
    <form action={action} className="ac__card" style={{ marginTop: 14 }} noValidate>
      <input type="hidden" name="id" value={address?.id ?? ''} />
      <div className="fields">
        <div className="field"><label htmlFor={`a-n-${k}`}>{t('checkout.fullName')}</label><input id={`a-n-${k}`} name="full_name" required defaultValue={address?.full_name} /></div>
        <div className="field"><label htmlFor={`a-p-${k}`}>{t('checkout.mobile')}</label><input id={`a-p-${k}`} name="phone" type="tel" required defaultValue={address?.phone} placeholder={t('checkout.phonePlaceholder')} /></div>
        <div className="field field--full"><label htmlFor={`a-1-${k}`}>{t('checkout.address')}</label><input id={`a-1-${k}`} name="line1" required defaultValue={address?.line1} placeholder={t('checkout.addressPlaceholder')} /></div>
        <div className="field field--full"><label htmlFor={`a-2-${k}`} className="sr-only">{t('checkout.line2')}</label><input id={`a-2-${k}`} name="line2" defaultValue={address?.line2 ?? ''} placeholder={t('checkout.line2Placeholder')} /></div>
        <div className="field"><label htmlFor={`a-c-${k}`}>{t('checkout.city')}</label><input id={`a-c-${k}`} name="city" required defaultValue={address?.city} /></div>
        <div className="field"><label htmlFor={`a-d-${k}`}>{t('checkout.district')}</label><select id={`a-d-${k}`} name="district" required defaultValue={address?.district ?? ''}><option value="">{t('checkout.selectDistrict')}</option><DistrictOptions /></select></div>
        <div className="field"><label htmlFor={`a-z-${k}`}>{t('account.postal')} <small>{t('common.optional')}</small></label><input id={`a-z-${k}`} name="postal_code" defaultValue={address?.postal_code ?? ''} /></div>
        <div className="field" style={{ alignSelf: 'end' }}><label className="ac__check"><input type="checkbox" name="is_default" defaultChecked={address?.is_default} /> {t('account.defaultAddress')}</label></div>
      </div>
      {state?.error ? <p className="co__error" role="alert" style={{ marginTop: 16 }}>{state.error}</p> : null}
      <div className="notify__row" style={{ marginTop: 18 }}>
        <button className="btn btn--gold btn--sm" disabled={pending}>{pending ? t('common.saving') : t('account.saveAddress')}</button>
        <button type="button" className="co__link" onClick={() => setOpen(false)}>{t('common.cancel')}</button>
      </div>
    </form>
  );
}
