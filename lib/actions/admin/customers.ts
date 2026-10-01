'use server';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin';
import { fail, str, type AdminState } from './result';

export async function saveCustomerNoteAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase, user } = await requireAdmin();
  const id = str(fd, 'user_id');
  const { error } = await supabase.from('customer_admin_notes').upsert({ user_id: id, note: str(fd, 'note'), updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return fail(error);
  revalidatePath(`/admin/customers/${id}`);
  return { ok: 'Note saved.' };
}

export async function setRoleAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const email = str(fd, 'email').toLowerCase();
  const role = str(fd, 'role') === 'customer' ? 'customer' : 'admin';
  let id = str(fd, 'user_id');
  if (!id && email) {
    const { data } = await supabase.from('profiles').select('id').ilike('email', email).maybeSingle();
    if (!data) return { error: 'No registered user with that email. Ask them to create an account first.' };
    id = data.id;
  }
  const { error } = await supabase.rpc('set_user_role', { p_user_id: id, p_role: role });
  if (error) return fail(error);
  revalidatePath('/admin/settings');
  revalidatePath(`/admin/customers/${id}`);
  return { ok: role === 'admin' ? 'User promoted to admin.' : 'Admin access removed.' };
}
