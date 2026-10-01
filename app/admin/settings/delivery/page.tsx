import { ActionForm } from '@/components/admin/ActionForm';
import { SortableList } from '@/components/admin/SortableList';
import { Card, PageHeader } from '@/components/admin/ui';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { requireAdmin } from '@/lib/admin';
import { deleteRowAction, saveDeliveryMethodAction } from '@/lib/actions/admin/settings';

export const metadata = { title: 'Delivery methods' };

type M = { id: string; name: string; description: string | null; fee: number; free_over: number | null; cod_allowed: boolean; is_active: boolean; requires_address: boolean };

function MethodFields({ m }: { m?: M }) {
  return (
    <ActionForm action={saveDeliveryMethodAction} className="grid gap-2 md:grid-cols-4" resetOnSuccess={!m}>
      <input type="hidden" name="id" value={m?.id ?? ''} />
      <input name="name" required defaultValue={m?.name} placeholder="Name" className="input input-sm md:col-span-2" aria-label="Name" />
      <input name="fee" type="number" step="0.01" min="0" required defaultValue={m?.fee ?? 0} placeholder="Fee" className="input input-sm" aria-label="Fee (Rs.)" />
      <input name="free_over" type="number" step="0.01" min="0" defaultValue={m?.free_over ?? ''} placeholder="Free over (Rs.)" className="input input-sm" aria-label="Free delivery over" />
      <input name="description" defaultValue={m?.description ?? ''} placeholder="Description, e.g. 2–4 working days" className="input input-sm md:col-span-4" aria-label="Description" />
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="cod_allowed" defaultChecked={m?.cod_allowed ?? true} className="h-4 w-4 accent-brand-green" />Allow COD</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="requires_address" defaultChecked={m?.requires_address ?? true} className="h-4 w-4 accent-brand-green" />Needs an address</label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={m?.is_active ?? true} className="h-4 w-4 accent-brand-green" />Active</label>
      <div className="md:col-span-2"><SubmitButton className="btn-secondary btn-sm">{m ? 'Save' : 'Add method'}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function DeliverySettings() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('delivery_methods').select('*').order('sort_order');
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Delivery methods" subtitle="Shown at checkout in this order. Delivery is free when the subtotal reaches “free over”." />
      <Card>
        <SortableList table="delivery_methods" items={((data ?? []) as M[]).map((m) => ({ id: m.id, node: (
          <div className="space-y-2"><MethodFields m={m} />
            <form action={deleteRowAction}><input type="hidden" name="table" value="delivery_methods" /><input type="hidden" name="id" value={m.id} /><button className="text-xs text-state-error underline">Delete</button></form></div>
        ) }))} />
        <div className="mt-4 border-t border-brand-beige pt-4"><p className="label">Add a delivery method</p><MethodFields /></div>
      </Card>
    </div>
  );
}
