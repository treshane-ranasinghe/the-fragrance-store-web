'use server';
import { cookies, headers } from 'next/headers';
import { redirect as redirectTo } from 'next/navigation';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { getPathname, redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { DEMO_MODE, SITE_URL } from '@/lib/config';
import { LK_PHONE, normalisePhone } from '@/lib/format';
import { MERGE_COOKIE, mergePendingCart } from '@/lib/cart-merge';

export type FormState = { error?: string; ok?: string; fields?: Record<string, string> } | undefined;


function safeNext(v: FormDataEntryValue | null) {
  const s = typeof v === 'string' ? v : '';
  return s.startsWith('/') && !s.startsWith('//') ? s : '/account';
}

/** Storefront paths get the page language ("/si/account"); the admin panel has no language prefix */
async function go(path: string): Promise<never> {
  if (path.startsWith('/admin')) redirectTo(path);
  return redirect({ href: path, locale: (await getLocale()) as Locale });
}

/** As the current guest, get a one-time token that lets the guest cart follow the user into their account */
async function guestCartToken(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.is_anonymous) return null;
  const { data } = await supabase.rpc('create_cart_transfer_token');
  return (data as string | null) ?? null;
}

export async function loginAction(_: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations('errors');
  if (DEMO_MODE) return { error: t('demoAccounts') };
  const email = String(formData.get('email') || '').trim();
  const password = String(formData.get('password') || '');
  if (!email || !password) return { error: t('enterEmailPassword'), fields: { email } };

  const supabase = await createClient();
  const token = await guestCartToken(supabase);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    return { error: error.message === 'Email not confirmed' ? t('confirmEmail') : t('incorrect'), fields: { email } };
  }
  await mergePendingCart(supabase, token);
  let next = safeNext(formData.get('next'));
  // Admins signing in from the normal login page go straight to the admin panel
  if (next === '/account') {
    const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
    if (p?.role === 'admin') next = '/admin';
  }
  return go(next);
}

/** Sign in / sign up with Google. New Google users get a customer profile automatically (database trigger). */
export async function googleSignInAction(formData: FormData) {
  const t = await getTranslations('errors');
  if (DEMO_MODE) throw new Error(t('demoAccounts'));
  const locale = (await getLocale()) as Locale;
  const next = safeNext(formData.get('next'));
  const supabase = await createClient();
  // Google sends the visitor back to /auth/callback, which picks the guest bag up from this cookie
  const token = await guestCartToken(supabase);
  if (token) (await cookies()).set(MERGE_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: SITE_URL.startsWith('https'), maxAge: 3600, path: '/' });
  // Come back to the address the visitor is actually using (e.g. a second dev server on another port)
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const origin = host ? `${h.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https')}://${host}` : SITE_URL;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(getPathname({ href: next, locale }))}`,
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error || !data.url) return go(`/login?error=google&next=${encodeURIComponent(next)}`);
  redirectTo(data.url);
}

const registerSchema = (t: (key: string) => string) => z.object({
  full_name: z.string().trim().min(2, t('fullName')),
  phone: z.string().transform(normalisePhone).refine((p) => LK_PHONE.test(p), t('phone')),
  email: z.string().trim().email(t('email')),
  password: z.string().min(8, t('min8')),
});

export async function registerAction(_: FormState, formData: FormData): Promise<FormState> {
  const [t, locale] = await Promise.all([getTranslations('errors'), getLocale() as Promise<Locale>]);
  if (DEMO_MODE) return { error: t('demoAccounts') };
  const raw = Object.fromEntries(['full_name', 'phone', 'email', 'password'].map((k) => [k, String(formData.get(k) || '')]));
  const parsed = registerSchema(t).safeParse(raw);
  const fields = { full_name: raw.full_name, phone: raw.phone, email: raw.email };
  if (!parsed.success) return { error: parsed.error.issues[0].message, fields };

  const next = safeNext(formData.get('next'));
  const supabase = await createClient();
  const token = await guestCartToken(supabase);
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.full_name, phone: parsed.data.phone },
      emailRedirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(getPathname({ href: next, locale }))}`,
    },
  });
  if (error) return { error: error.message, fields };

  if (data.session) {
    await mergePendingCart(supabase, token);
    return go(next);
  }
  // Email confirmation is on: keep the cart token until they confirm and log in
  if (token) (await cookies()).set(MERGE_COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: SITE_URL.startsWith('https'), maxAge: 7 * 86400, path: '/' });
  return { ok: t('sentConfirmation', { email: parsed.data.email }) };
}

export async function forgotPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const [t, locale] = await Promise.all([getTranslations('errors'), getLocale() as Promise<Locale>]);
  if (DEMO_MODE) return { error: t('demoAccounts') };
  const email = String(formData.get('email') || '').trim();
  if (!email) return { error: t('enterEmail') };
  const supabase = await createClient();
  const next = getPathname({ href: '/reset-password', locale });
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/auth/callback?next=${encodeURIComponent(next)}` });
  return { ok: t('resetSent') };
}

export async function resetPasswordAction(_: FormState, formData: FormData): Promise<FormState> {
  const t = await getTranslations('errors');
  if (DEMO_MODE) return { error: t('demoAccounts') };
  const password = String(formData.get('password') || '');
  if (password.length < 8) return { error: t('min8') };
  if (password !== String(formData.get('confirm') || '')) return { error: t('mismatch') };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return go('/account');
}

export async function logoutAction(formData?: FormData) {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: formData?.get('scope') === 'global' ? 'global' : 'local' });
  return go('/');
}
