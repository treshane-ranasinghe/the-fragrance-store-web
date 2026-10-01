import { ActionForm } from '@/components/admin/ActionForm';
import { ConfirmButton } from '@/components/admin/ConfirmButton';
import { Field, SettingsForm, Toggle } from '@/components/admin/SettingsFields';
import { SortableList } from '@/components/admin/SortableList';
import { Card, PageHeader } from '@/components/admin/ui';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { requireAdmin } from '@/lib/admin';
import { deleteRowAction, saveBankAccountAction } from '@/lib/actions/admin/settings';

export const metadata = { title: 'Direct bank transfer' };

type Acc = { id: string; account_name: string; account_number: string; bank_name: string; branch: string | null; branch_code: string | null; swift: string | null; is_active: boolean };

function AccountFields({ a }: { a?: Acc }) {
  return (
    <ActionForm action={saveBankAccountAction} className="grid gap-2 md:grid-cols-3" resetOnSuccess={!a}>
      <input type="hidden" name="id" value={a?.id ?? ''} />
      <input name="account_name" required defaultValue={a?.account_name} placeholder="Account name" className="input input-sm" aria-label="Account name" />
      <input name="account_number" required defaultValue={a?.account_number} placeholder="Account number" className="input input-sm" aria-label="Account number" />
      <input name="bank_name" required defaultValue={a?.bank_name} placeholder="Bank name" className="input input-sm" aria-label="Bank name" />
      <input name="branch" defaultValue={a?.branch ?? ''} placeholder="Branch" className="input input-sm" aria-label="Branch" />
      <input name="branch_code" defaultValue={a?.branch_code ?? ''} placeholder="Branch code" className="input input-sm" aria-label="Branch code" />
      <input name="swift" defaultValue={a?.swift ?? ''} placeholder="SWIFT (optional)" className="input input-sm" aria-label="SWIFT" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={a?.is_active ?? true} className="h-4 w-4 accent-brand-green" />Show at checkout</label>
      <div className="md:col-span-2"><SubmitButton className="btn-secondary btn-sm">{a ? 'Save' : 'Add account'}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function BankTransferSettings() {
  const { supabase } = await requireAdmin();
  const [{ data: s }, { data: accounts }] = await Promise.all([
    supabase.from('store_settings').select('*').single(),
    supabase.from('bank_accounts').select('*').order('sort_order'),
  ]);
  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Direct bank transfer" subtitle="Take payments in person via BACS — the customer transfers money using the order number as reference. No slip upload." />
      <SettingsForm fields={['bacs_enabled', 'bacs_title', 'bacs_description', 'bacs_instructions', 'payment_reminder_enabled', 'auto_cancel_unpaid', 'bank_payment_hours', 'bank_recheck_hours', 'bank_grace_hours']}>
        <Toggle name="bacs_enabled" label="Enable bank transfer" defaultChecked={!!s?.bacs_enabled} />
        <Field name="bacs_title" label="Title" defaultValue={s?.bacs_title} wide help="Shown at checkout" />
        <Field name="bacs_description" label="Description" defaultValue={s?.bacs_description} wide textarea help="Shown at checkout under the title" />
        <Field name="bacs_instructions" label="Instructions" defaultValue={s?.bacs_instructions} wide textarea help="Added to the Order Received page and emails" />
        <Field name="bank_payment_hours" label="Payment deadline (hours)" type="number" defaultValue={s?.bank_payment_hours} />
        <Field name="bank_recheck_hours" label="Extend deadline after “not found” (hours)" type="number" defaultValue={s?.bank_recheck_hours} />
        <Toggle name="payment_reminder_enabled" label="Send a payment reminder 24 h before the deadline" defaultChecked={!!s?.payment_reminder_enabled} />
        <Toggle name="auto_cancel_unpaid" label="Auto-cancel unpaid orders" defaultChecked={!!s?.auto_cancel_unpaid} help="Off by default (like WooCommerce). Orders where the customer tapped “I’ve made the payment” or paid part are never auto-cancelled." />
        <Field name="bank_grace_hours" label="Grace period after the deadline before auto-cancel (hours)" type="number" defaultValue={s?.bank_grace_hours} />
      </SettingsForm>
      <Card title="Account details" actions={<span className="text-xs text-brand-muted">Drag to reorder — shown in this order</span>}>
        <SortableList table="bank_accounts" items={((accounts ?? []) as Acc[]).map((a) => ({ id: a.id, node: (
          <div className="space-y-2">
            <AccountFields a={a} />
            <form action={deleteRowAction}><input type="hidden" name="table" value="bank_accounts" /><input type="hidden" name="id" value={a.id} /><ConfirmButton message="Delete this bank account? Customers will no longer see it at checkout." className="text-xs text-state-error underline">Delete</ConfirmButton></form>
          </div>
        ) }))} />
        <div className="mt-4 border-t border-brand-beige pt-4"><p className="label">Add an account</p><AccountFields /></div>
      </Card>
    </div>
  );
}
