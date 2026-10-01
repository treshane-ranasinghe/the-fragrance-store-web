import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { AddressForm } from '@/components/store/AddressForm';
import { pageLocale } from '@/i18n/server';
import { deleteAddressAction, setDefaultAddressAction } from '@/lib/actions/account';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('addresses') };
}

export default async function AddressesPage({ params }: Props) {
  await pageLocale(params);
  const supabase = await createClient();
  const [{ data }, t] = await Promise.all([
    supabase.from('addresses').select('*').order('is_default', { ascending: false }).order('created_at'),
    getTranslations(),
  ]);
  return (
    <div style={{ maxWidth: 760 }}>
      <div className="ac__card">
        <h2 className="ac__h2">{t('account.savedAddresses')}</h2>
        {!data?.length ? <p className="ac__small">{t('account.noAddresses')}</p> : data.map((a) => (
          <div key={a.id} className="ac__addr">
            {a.is_default ? <span className="ac__tag">{t('account.default')}</span> : null}
            <p style={{ margin: 0 }}>{a.full_name} · {a.phone}<br /><small>{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {t.has(`districts.${a.district.replace(/\s/g, '')}`) ? t(`districts.${a.district.replace(/\s/g, '')}`) : a.district} {a.postal_code}</small></p>
            <div className="ac__actions" style={{ margin: '10px 0 0' }}>
              <AddressForm address={a} label={t('account.edit')} />
              {!a.is_default ? <form action={setDefaultAddressAction}><input type="hidden" name="id" value={a.id} /><button className="co__link">{t('account.setDefault')}</button></form> : null}
              <form action={deleteAddressAction}><input type="hidden" name="id" value={a.id} /><button className="co__link">{t('account.delete')}</button></form>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 16 }}><AddressForm /></div>
    </div>
  );
}
