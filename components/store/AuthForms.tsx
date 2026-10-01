'use client';
import { useTranslations } from 'next-intl';
import { useActionState, useState } from 'react';
import { Title } from '@/components/site/Title';
import { Link } from '@/i18n/navigation';
import { forgotPasswordAction, googleSignInAction, loginAction, registerAction, resetPasswordAction, type FormState } from '@/lib/actions/auth';
import { DEMO_MODE } from '@/lib/config';

function Msg({ state }: { state: FormState }) {
  if (state?.error) return <p className="co__error" role="alert">{state.error}</p>;
  if (state?.ok) return <p className="co__notice" role="status" style={{ margin: 0 }}>{state.ok}</p>;
  return null;
}

function Password({ id, name, autoComplete, minLength }: { id: string; name: string; autoComplete: string; minLength?: number }) {
  const t = useTranslations('auth');
  const [show, setShow] = useState(false);
  return (
    <div className="co__pw">
      <input id={id} name={name} type={show ? 'text' : 'password'} autoComplete={autoComplete} minLength={minLength} required />
      <button type="button" className="co__pwtoggle" aria-label={show ? t('hidePassword') : t('showPassword')} aria-pressed={show} onClick={() => setShow(!show)}>{show ? t('hide') : t('show')}</button>
    </div>
  );
}

/** "Continue with Google": signs in, or creates the customer account on first use */
function GoogleButton({ next, enabled }: { next: string; enabled: boolean }) {
  const t = useTranslations('auth');
  const [pending, setPending] = useState(false);
  if (DEMO_MODE || !enabled) return null;
  return (
    <form action={googleSignInAction} onSubmit={() => setPending(true)}>
      <input type="hidden" name="next" value={next} />
      <button className="btn btn--ghost btn--block ac__google" disabled={pending}>
        <svg viewBox="0 0 48 48" aria-hidden="true" width="18" height="18">
          <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
          <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
          <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
          <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
        </svg>
        <span>{pending ? t('googleRedirecting') : t('google')}</span>
      </button>
    </form>
  );
}

function OrDivider({ enabled }: { enabled: boolean }) {
  const t = useTranslations('auth');
  if (DEMO_MODE || !enabled) return null;
  return <p className="ac__or"><span>{t('or')}</span></p>;
}

/** Sign in / Sign up card with tabs, from the original account page */
export function AuthCard({ tab, next, children }: { tab?: 'signin' | 'signup'; next: string; children: React.ReactNode }) {
  const t = useTranslations('auth');
  const q = next !== '/account' ? `?next=${encodeURIComponent(next)}` : '';
  return (
    <section className="ac__signin">
      <div className="ac__card ac__auth">
        {tab ? (
          <div className="ac__tabs" role="tablist" aria-label={t('tabs')}>
            <Link href={`/login${q}`} role="tab" aria-selected={tab === 'signin'} className="ac__tab">{t('signIn')}</Link>
            <Link href={`/register${q}`} role="tab" aria-selected={tab === 'signup'} className="ac__tab">{t('signUp')}</Link>
          </div>
        ) : null}
        {DEMO_MODE ? <p className="co__error">{t('demo')}</p> : null}
        {children}
      </div>
    </section>
  );
}

export function LoginForm({ next, linkError = false, googleError = false, google = false }: { next: string; linkError?: boolean; googleError?: boolean; google?: boolean }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <>
    <h1 className="co__title"><Title text={t('welcome')} /></h1>
    <p className="ac__lead">{next.startsWith('/checkout') ? t('leadCheckout') : t('lead')}</p>
    {googleError && !state ? <p className="co__error" role="alert">{t('googleError')}</p> : null}
    <GoogleButton next={next} enabled={google} />
    <OrDivider enabled={google} />
    <form action={action} noValidate>
      {linkError && !state ? <p className="co__error" role="alert">{t('linkExpired')}</p> : null}
      <input type="hidden" name="next" value={next} />
      <div className="field"><label htmlFor="si-email">{t('email')}</label><input id="si-email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} /></div>
      <div className="field"><label htmlFor="si-pw">{t('password')}</label><Password id="si-pw" name="password" autoComplete="current-password" /></div>
      <Msg state={state} />
      <button className="btn btn--gold btn--block" disabled={pending}>{pending ? t('signingIn') : t('signIn')}</button>
      <p className="ac__small"><Link href="/forgot-password" className="co__link">{t('forgot')}</Link> {t('resetHint')}</p>
      <hr className="ac__rule" />
      <p className="ac__small">{t('newHere')} <Link href={`/register${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`} className="co__link">{t('create')}</Link></p>
    </form>
    </>
  );
}

export function RegisterForm({ next, google = false }: { next: string; google?: boolean }) {
  const t = useTranslations('auth');
  const [state, action, pending] = useActionState(registerAction, undefined);
  if (state?.ok) return <Msg state={state} />;
  return (
    <>
    <h1 className="co__title"><Title text={t('registerTitle')} /></h1>
    <p className="ac__lead">{t('registerLead')}</p>
    <GoogleButton next={next} enabled={google} />
    <OrDivider enabled={google} />
    <form action={action} noValidate>
      <input type="hidden" name="next" value={next} />
      <div className="field"><label htmlFor="su-name">{t('fullName')}</label><input id="su-name" name="full_name" autoComplete="name" required defaultValue={state?.fields?.full_name} /></div>
      <div className="field"><label htmlFor="su-phone">{t('mobile')}</label><input id="su-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="077 123 4567" required defaultValue={state?.fields?.phone} /></div>
      <div className="field"><label htmlFor="su-email">{t('email')} <small>{t('emailHint')}</small></label><input id="su-email" name="email" type="email" autoComplete="email" required defaultValue={state?.fields?.email} /></div>
      <div className="field"><label htmlFor="su-pw">{t('password')} <small>{t('min8')}</small></label><Password id="su-pw" name="password" autoComplete="new-password" minLength={8} /></div>
      <Msg state={state} />
      <button className="btn btn--gold btn--block" disabled={pending}>{pending ? t('creating') : t('createAccount')}</button>
      <hr className="ac__rule" />
      <p className="ac__small">{t('haveAccount')} <Link href={`/login${next !== '/account' ? `?next=${encodeURIComponent(next)}` : ''}`} className="co__link">{t('signIn')}</Link></p>
    </form>
    </>
  );
}

export function ForgotForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(forgotPasswordAction, undefined);
  return (
    <form action={action} noValidate>
      <h1 className="co__title"><Title text={t('forgotTitle')} /></h1>
      <p className="ac__lead">{t('forgotLead')}</p>
      <div className="field"><label htmlFor="fp-email">{t('email')}</label><input id="fp-email" name="email" type="email" autoComplete="email" required /></div>
      <Msg state={state} />
      <button className="btn btn--gold btn--block" disabled={pending}>{pending ? tc('sending') : t('sendLink')}</button>
      <p className="ac__small"><Link href="/login" className="co__link">{t('backToSignIn')}</Link></p>
    </form>
  );
}

export function ResetForm() {
  const t = useTranslations('auth');
  const tc = useTranslations('common');
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  return (
    <form action={action} noValidate>
      <h1 className="co__title"><Title text={t('resetTitle')} /></h1>
      <div className="field"><label htmlFor="rp-pw">{t('newPassword')} <small>{t('min8')}</small></label><Password id="rp-pw" name="password" autoComplete="new-password" minLength={8} /></div>
      <div className="field"><label htmlFor="rp-c">{t('confirmPassword')}</label><Password id="rp-c" name="confirm" autoComplete="new-password" minLength={8} /></div>
      <Msg state={state} />
      <button className="btn btn--gold btn--block" disabled={pending}>{pending ? tc('saving') : t('savePassword')}</button>
    </form>
  );
}

export function AuthPage({ children }: { children: React.ReactNode }) {
  return <section className="section section--dark page"><div className="container co ac">{children}</div></section>;
}
