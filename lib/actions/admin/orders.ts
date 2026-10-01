'use server';
import { revalidatePath } from 'next/cache';
import { after } from 'next/server';
import { refreshStore, requireAdmin } from '@/lib/admin';
import { processEmailQueue } from '@/lib/email/process';
import { fail, num, str, type AdminState } from './result';

async function run(fn: string, args: Record<string, unknown>, ok: string, orderId?: string): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.rpc(fn, args);
  if (error) return fail(error);
  after(() => processEmailQueue().catch(() => {}));
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath('/admin', 'layout');
  // Stock changes affect product pages
  if (['confirm_order', 'cancel_order', 'restock_order', 'record_bank_payment'].includes(fn)) refreshStore(['catalog', 'bundles']);
  const d = data as { stock_issue?: boolean; message?: string; payment_status?: string; balance?: number; overpaid?: number } | null;
  if (d?.stock_issue) return { error: `Payment recorded, but the order stays On hold: ${d.message}. Add stock and click Confirm order, or cancel and refund.` };
  if (d?.payment_status === 'partially_paid') return { ok: `Part payment recorded. Balance due Rs. ${Number(d.balance).toLocaleString('en-LK', { minimumFractionDigits: 2 })}.` };
  if (d?.overpaid && d.overpaid > 0) return { ok: `${ok} Note: overpaid by Rs. ${Number(d.overpaid).toLocaleString('en-LK', { minimumFractionDigits: 2 })} — refund or keep as store credit.` };
  return { ok };
}

export async function recordBankPaymentAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('record_bank_payment', { p_order_id: id, p_amount: num(fd, 'amount'), p_received_on: str(fd, 'received_on') || null, p_bank_reference: str(fd, 'reference'), p_note: str(fd, 'note') || null }, 'Payment recorded — order moved to Processing.', id);
}
export async function paymentNotFoundAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('mark_payment_not_found', { p_order_id: id, p_note: str(fd, 'note') || null }, 'Marked as not received; deadline extended and customer emailed.', id);
}
export async function confirmOrderAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('confirm_order', { p_order_id: id }, 'Order confirmed — stock reduced, now Processing.', id);
}
export async function cancelOrderAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('cancel_order', { p_order_id: id, p_reason: str(fd, 'reason') }, 'Order cancelled. Items released back to the customer’s cart.', id);
}
export async function logCodCallAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('log_cod_call', { p_order_id: id, p_result: str(fd, 'result'), p_note: str(fd, 'note') || null }, 'Call logged.', id);
}
export async function markShippedAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('mark_shipped', { p_order_id: id, p_courier: str(fd, 'courier'), p_tracking: str(fd, 'tracking') }, 'Marked as shipped; customer emailed.', id);
}
export async function markDeliveredAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('mark_delivered', { p_order_id: id }, 'Marked as delivered.', id);
}
export async function deliveryFailedAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('mark_delivery_failed', { p_order_id: id, p_reason: str(fd, 'reason') }, 'Marked as returned.', id);
}
export async function restockAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('restock_order', { p_order_id: id, p_damaged: fd.get('damaged') === 'on' }, 'Parcel processed and order cancelled.', id);
}
export async function recordRefundAction(_: AdminState, fd: FormData) {
  const id = str(fd, 'order_id');
  return run('record_refund', { p_order_id: id, p_reference: str(fd, 'reference'), p_date: str(fd, 'date') || null }, 'Refund recorded.', id);
}
export async function codRemittanceAction(_: AdminState, fd: FormData) {
  const ids = fd.getAll('order_ids').map(String).filter(Boolean);
  return run('record_cod_remittance', {
    p_order_ids: ids, p_courier: str(fd, 'courier'), p_reference: str(fd, 'reference'), p_amount: num(fd, 'amount'), p_date: str(fd, 'date') || null, p_note: str(fd, 'note') || null,
  }, `COD cash recorded for ${ids.length} order(s) — marked Completed.`);
}

export async function addOrderNoteAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase, user } = await requireAdmin();
  const id = str(fd, 'order_id');
  const note = str(fd, 'note');
  if (!note) return { error: 'Write a note' };
  const { error } = await supabase.from('order_notes').insert({ order_id: id, note, created_by: user.id });
  if (error) return fail(error);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: 'Note added.' };
}

export async function updateTrackingAction(_: AdminState, fd: FormData): Promise<AdminState> {
  const { supabase } = await requireAdmin();
  const id = str(fd, 'order_id');
  const { error } = await supabase.from('orders').update({ courier_name: str(fd, 'courier') || null, tracking_number: str(fd, 'tracking') || null }).eq('id', id);
  if (error) return fail(error);
  revalidatePath(`/admin/orders/${id}`);
  return { ok: 'Courier details updated.' };
}
