'use server';
import { revalidatePath } from 'next/cache';
import { refreshStore, requireAdmin } from '@/lib/admin';
import { bool, fail, num, optStr, str, type AdminState } from './result';

type Kind = 'text' | 'optText' | 'int' | 'optNum' | 'money' | 'bool' | 'optUuid';
const FIELDS: Record<string, Kind> = {
  store_name: 'text', store_phone: 'optText', store_whatsapp: 'optText', store_email: 'optText', store_address: 'optText',
  default_hero_media_id: 'optUuid',
  bacs_enabled: 'bool', bacs_title: 'text', bacs_description: 'text', bacs_instructions: 'text',
  bank_payment_hours: 'int', bank_recheck_hours: 'int', bank_grace_hours: 'int', payment_reminder_enabled: 'bool', auto_cancel_unpaid: 'bool',
  cod_enabled: 'bool', cod_title: 'text', cod_description: 'text', cod_instructions: 'text', cod_fee: 'money',
  cod_max_order_value: 'optNum', cod_max_failed: 'optNum', cod_max_call_attempts: 'int', cod_confirm_hours: 'int', cod_remit_alert_days: 'int',
  abandoned_cart_hours: 'int', cart_keep_days_after_delivery: 'int',
  store_hours: 'optText', instagram_url: 'optText', instagram_handle: 'optText', facebook_url: 'optText', tiktok_url: 'optText', maps_url: 'optText', announcement_short: 'optText',
};

/** Saves only the settings fields present in the form (fd "fields" lists them, so unchecked boxes count) */
export async function saveSettingsAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const keys = str(fd, 'fields').split(',').filter((k) => k in FIELDS);
  const patch: Record<string, unknown> = {};
  for (const k of keys) {
    const kind = FIELDS[k];
    if (kind === 'bool') patch[k] = bool(fd, k);
    else if (kind === 'text') { const v = str(fd, k); if (!v) return { error: `${k.replace(/_/g, ' ')} cannot be empty` }; patch[k] = v; }
    else if (kind === 'optText' || kind === 'optUuid') patch[k] = optStr(fd, k);
    else if (kind === 'int') { const v = num(fd, k); if (v == null || !Number.isInteger(v) || v < 0) return { error: `${k.replace(/_/g, ' ')} must be a whole number` }; patch[k] = v; }
    else if (kind === 'money') { const v = num(fd, k) ?? 0; if (v < 0) return { error: 'Amounts cannot be negative' }; patch[k] = v; }
    else if (kind === 'optNum') { const v = num(fd, k); patch[k] = v && v > 0 ? v : null; }
  }
  const { error } = await supabase.from('store_settings').update(patch).eq('id', 1);
  if (error) return fail(error);
  refreshStore(['settings', 'cms'], ['/', '/delivery-policy']);
  return { ok: 'Settings saved.' };
}

// Bank accounts ------------------------------------------------------------
export async function saveBankAccountAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'id');
  const row = {
    account_name: str(fd, 'account_name'), account_number: str(fd, 'account_number'), bank_name: str(fd, 'bank_name'),
    branch: optStr(fd, 'branch'), branch_code: optStr(fd, 'branch_code'), swift: optStr(fd, 'swift'), is_active: bool(fd, 'is_active'),
  };
  if (!row.account_name || !row.account_number || !row.bank_name) return { error: 'Account name, number and bank are required' };
  if (!id) {
    const { data } = await supabase.from('bank_accounts').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    Object.assign(row, { sort_order: (data?.[0]?.sort_order ?? 0) + 1 });
  }
  const { error } = id ? await supabase.from('bank_accounts').update(row).eq('id', id) : await supabase.from('bank_accounts').insert(row);
  if (error) return fail(error);
  refreshStore(['settings']);
  return { ok: 'Bank account saved.' };
}

export async function deleteRowAction(fd: FormData) {
  const { supabase } = await requireAdmin();
  const table = str(fd, 'table');
  if (!['bank_accounts', 'delivery_methods'].includes(table)) return;
  const { error } = await supabase.from(table).delete().eq('id', str(fd, 'id'));
  if (error) await supabase.from(table).update({ is_active: false }).eq('id', str(fd, 'id'));
  refreshStore(['settings']);
  revalidatePath('/admin/settings', 'layout');
}

const REORDERABLE = ['bank_accounts', 'delivery_methods', 'hero_banners', 'home_sections', 'bundle_images'] as const;
export async function reorderAction(table: (typeof REORDERABLE)[number], ids: string[]) {
  const { supabase } = await requireAdmin();
  if (!REORDERABLE.includes(table)) return { error: 'Not allowed' };
  for (const [i, id] of ids.entries()) await supabase.from(table).update({ sort_order: i + 1 }).eq('id', id);
  refreshStore(table === 'bank_accounts' || table === 'delivery_methods' ? ['settings'] : ['cms', 'bundles'], ['/']);
  return { ok: true };
}

// Delivery methods -----------------------------------------------------------
export async function saveDeliveryMethodAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'id');
  const row = {
    name: str(fd, 'name'), description: optStr(fd, 'description'), fee: num(fd, 'fee') ?? 0,
    free_over: num(fd, 'free_over'), cod_allowed: bool(fd, 'cod_allowed'), is_active: bool(fd, 'is_active'),
    requires_address: bool(fd, 'requires_address'),
  };
  if (!row.name) return { error: 'Enter a name' };
  if (row.fee < 0) return { error: 'Fee cannot be negative' };
  if (!id) {
    const { data } = await supabase.from('delivery_methods').select('sort_order').order('sort_order', { ascending: false }).limit(1);
    Object.assign(row, { sort_order: (data?.[0]?.sort_order ?? 0) + 1 });
  }
  const { error } = id ? await supabase.from('delivery_methods').update(row).eq('id', id) : await supabase.from('delivery_methods').insert(row);
  if (error) return fail(error);
  refreshStore(['settings'], ['/delivery-policy']);
  return { ok: 'Delivery method saved.' };
}

/** "Enable for delivery methods" on the COD settings page */
export async function saveCodMethodsAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const allowed = new Set(fd.getAll('cod_methods').map(String));
  const { data } = await supabase.from('delivery_methods').select('id');
  // Leave empty = all methods
  for (const m of data ?? []) await supabase.from('delivery_methods').update({ cod_allowed: allowed.size === 0 || allowed.has(m.id) }).eq('id', m.id);
  refreshStore(['settings']);
  return { ok: 'Saved.' };
}
