import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { Title } from '@/components/site/Title';
import { AccountNav } from '@/components/store/AccountNav';
import { pageLocale } from '@/i18n/server';
import { logoutAction } from '@/lib/actions/auth';
import { createClient } from '@/lib/supabase/server';

export default async function AccountLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await pageLocale(params);
  const supabase = await createClient();
  const [{ data: { user } }, t] = await Promise.all([supabase.auth.getUser(), getTranslations('account')]);
  const { data: p } = user ? await supabase.from('profiles').select('full_name, role').eq('id', user.id).maybeSingle() : { data: null };
  const first = (p?.full_name ?? '').split(' ')[0] || t('there');
  return (
    <section className="section section--dark page">
      <div className="container co ac">
        <header className="ac__head">
          <div>
            <p className="eyebrow">{t('eyebrow')}</p>
            <h1 className="co__title"><Title text={t('hello', { name: first })} /></h1>
          </div>
          <div style={{ display: 'flex', gap: '.75rem', alignItems: 'center' }}>
            {/* The admin panel is English-only and outside the language URLs */}
            {p?.role === 'admin' ? <Link href="/admin" className="btn btn--gold btn--sm">{t('adminPanel')}</Link> : null}
            <form action={logoutAction}><button className="btn btn--ghost btn--sm">{t('signOut')}</button></form>
          </div>
        </header>
        <AccountNav />
        {children}
      </div>
    </section>
  );
}
