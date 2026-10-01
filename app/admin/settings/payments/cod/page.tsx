import { ActionForm } from '@/components/admin/ActionForm';
import { Field, SettingsForm, Toggle } from '@/components/admin/SettingsFields';
import { Card, PageHeader } from '@/components/admin/ui';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { requireAdmin } from '@/lib/admin';
import { saveCodMethodsAction } from '@/lib/actions/admin/settings';

export const metadata = { title: 'Cash on delivery' };

export default async function CodSettings() {
  const { supabase } = await requireAdmin();
  const [{ data: s }, { data: methods }] = await Promise.all([
    supabase.from('store_settings').select('*').single(),
    supabase.from('delivery_methods').select('id, name, cod_allowed, is_active').order('sort_order'),
  ]);
  const allAllowed = (methods ?? []).every((m) => m.cod_allowed);
  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Cash on delivery" subtitle="Customers pay the courier in cash. Orders start Pending until you confirm them." />
      <SettingsForm fields={['cod_enabled', 'cod_title', 'cod_description', 'cod_instructions', 'cod_fee', 'cod_max_order_value', 'cod_max_failed', 'cod_max_call_attempts', 'cod_confirm_hours', 'cod_remit_alert_days']}>
        <Toggle name="cod_enabled" label="Enable cash on delivery" defaultChecked={!!s?.cod_enabled} />
        <Field name="cod_title" label="Title" defaultValue={s?.cod_title} wide />
        <Field name="cod_description" label="Description" defaultValue={s?.cod_description} wide textarea />
        <Field name="cod_instructions" label="Instructions" defaultValue={s?.cod_instructions} wide textarea help="Added to the Order Received page and emails" />
        <Field name="cod_fee" label="COD fee (Rs.)" type="number" step="0.01" defaultValue={s?.cod_fee} help="0 = off" />
        <Field name="cod_max_order_value" label="Maximum COD order value (Rs.)" type="number" step="0.01" defaultValue={s?.cod_max_order_value} help="Empty = no limit" />
        <Field name="cod_max_failed" label="Block COD after N refused parcels" type="number" defaultValue={s?.cod_max_failed} help="Empty = off" />
        <Field name="cod_max_call_attempts" label="Flag after N unanswered calls" type="number" defaultValue={s?.cod_max_call_attempts} />
        <Field name="cod_confirm_hours" label="Flag unconfirmed orders after (hours)" type="number" defaultValue={s?.cod_confirm_hours} />
        <Field name="cod_remit_alert_days" label="Courier cash overdue after (days)" type="number" defaultValue={s?.cod_remit_alert_days} />
      </SettingsForm>
      <Card title="Enable for delivery methods">
        <ActionForm action={saveCodMethodsAction} className="space-y-2">
          <p className="help">Choose which delivery methods offer COD. Leave all unticked = all methods.</p>
          {(methods ?? []).map((m) => (
            <label key={m.id} className="flex items-center gap-2 text-sm"><input type="checkbox" name="cod_methods" value={m.id} defaultChecked={!allAllowed && m.cod_allowed} className="h-4 w-4 accent-brand-green" />{m.name}{!m.is_active ? ' (inactive)' : ''}</label>
          ))}
          <SubmitButton className="btn-secondary btn-sm">Save</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
