'use server';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { getLocale, getTranslations } from 'next-intl/server';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import type { Locale } from '@/i18n/routing';
import { createClient } from '@/lib/supabase/server';
import { LK_PHONE, normalisePhone } from '@/lib/format';
import { processEmailQueue } from '@/lib/email/process';

export type ActionState = { error?: string; ok?: string } | undefined;

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) return redirect({ href: '/login', locale: (await getLocale()) as Locale });
  return { supabase, user };
}

type T = (key: string, values?: Record<string, string>) => string;

const profileSchema = (t: T) => z.object({
  full_name: z.string().trim().min(2, t('fullName')),
  phone: z.string().transform(normalisePhone).refine((p) => LK_PHONE.test(p), t('phone')),
  email: z.string().trim().email(t('email')),
  date_of_birth: z.string().optional().transform((v) => (v ? v : null)),
  marketing_opt_in: z.boolean(),
});

export async function updateProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const [{ supabase, user }, t] = await Promise.all([requireUser(), getTranslations('errors')]);
  const parsed = profileSchema(t).safeParse({
    full_name: fd.get('full_name'), phone: fd.get('phone'), email: fd.get('email'),
    date_of_birth: fd.get('date_of_birth') || undefined, marketing_opt_in: fd.get('marketing_opt_in') === 'on',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { email, ...rest } = parsed.data;
  const { error } = await supabase.from('profiles').update(rest).eq('id', user.id);
  if (error) return { error: error.message };
  let msg = t('profileSaved');
  if (email.toLowerCase() !== (user.email ?? '').toLowerCase()) {
    const { error: e2 } = await supabase.auth.updateUser({ email });
    if (e2) return { error: e2.message };
    msg = t('profileSavedEmail', { email });
  }
  revalidatePath('/account', 'layout');
  return { ok: msg };
}

export async function saveAvatarPathAction(path: string | null) {
  const { supabase, user } = await requireUser();
  if (path && !path.startsWith(`${user.id}/`)) return { error: (await getTranslations('errors'))('invalidFile') };
  const { data: old } = await supabase.from('profiles').select('avatar_path').eq('id', user.id).single();
  await supabase.from('profiles').update({ avatar_path: path }).eq('id', user.id);
  if (old?.avatar_path && old.avatar_path !== path) await supabase.storage.from('avatars').remove([old.avatar_path]);
  revalidatePath('/account/profile');
  return { ok: true };
}

const addressSchema = (t: T) => z.object({
  id: z.string().uuid().optional().or(z.literal('')),
  full_name: z.string().trim().min(2, t('recipient')),
  phone: z.string().transform(normalisePhone).refine((p) => LK_PHONE.test(p), t('phone')),
  line1: z.string().trim().min(3, t('address')),
  line2: z.string().trim().optional(),
  city: z.string().trim().min(2, t('city')),
  district: z.string().trim().min(2, t('district')),
  postal_code: z.string().trim().optional(),
  is_default: z.boolean(),
});

export async function saveAddressAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const [{ supabase, user }, t] = await Promise.all([requireUser(), getTranslations('errors')]);
  const parsed = addressSchema(t).safeParse({ ...Object.fromEntries(fd), is_default: fd.get('is_default') === 'on' });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const { id, ...row } = parsed.data;
  const res = id
    ? await supabase.from('addresses').update(row).eq('id', id).eq('user_id', user.id)
    : await supabase.from('addresses').insert({ ...row, user_id: user.id });
  if (res.error) return { error: res.error.message };
  revalidatePath('/account/addresses');
  return { ok: t('addressSaved') };
}

export async function deleteAddressAction(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from('addresses').delete().eq('id', String(fd.get('id'))).eq('user_id', user.id);
  revalidatePath('/account/addresses');
}

export async function setDefaultAddressAction(fd: FormData) {
  const { supabase, user } = await requireUser();
  await supabase.from('addresses').update({ is_default: true }).eq('id', String(fd.get('id'))).eq('user_id', user.id);
  revalidatePath('/account/addresses');
}

export async function cancelMyOrderAction(orderId: string, reason: string): Promise<ActionState> {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId, p_reason: reason || 'Cancelled by customer' });
  if (error) return { error: error.message };
  after(() => processEmailQueue().catch(() => {}));
  revalidatePath('/account', 'layout');
  return { ok: (await getTranslations('errors'))('orderCancelled') };
}

export async function buyAgainAction(orderId: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('buy_again', { p_order_id: orderId });
  if (error) return { error: error.message };
  return data as { added: { name: string; quantity: number }[]; skipped: { name: string; reason: string }[] };
}

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const [{ supabase, user }, t] = await Promise.all([requireUser(), getTranslations('errors')]);
  const current = String(fd.get('current') || '');
  const password = String(fd.get('password') || '');
  if (password.length < 8) return { error: t('min8') };
  if (password !== String(fd.get('confirm') || '')) return { error: t('mismatch') };
  const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email!, password: current });
  if (signInError) return { error: t('currentIncorrect') };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message };
  return { ok: t('passwordChanged') };
}

export async function deleteAccountAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const [{ supabase }, t, locale] = await Promise.all([requireUser(), getTranslations('errors'), getLocale() as Promise<Locale>]);
  if (String(fd.get('confirm') || '').trim().toUpperCase() !== 'DELETE') return { error: t('typeDelete') };
  const { error } = await supabase.rpc('delete_my_account');
  if (error) return { error: error.message };
  await supabase.auth.signOut();
  return redirect({ href: '/?account=deleted', locale });
}
