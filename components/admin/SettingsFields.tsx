'use client';
import { ActionForm } from './ActionForm';
import { saveSettingsAction } from '@/lib/actions/admin/settings';
import { SubmitButton } from '@/components/ui/SubmitButton';

export function SettingsForm({ fields, children }: { fields: string[]; children: React.ReactNode }) {
  return (
    <ActionForm action={saveSettingsAction} className="card grid gap-4 p-5 md:grid-cols-2">
      <input type="hidden" name="fields" value={fields.join(',')} />
      {children}
      <div className="md:col-span-2"><SubmitButton>Save changes</SubmitButton></div>
    </ActionForm>
  );
}

export function Toggle({ name, label, defaultChecked, help }: { name: string; label: string; defaultChecked: boolean; help?: string }) {
  return (
    <label className="flex items-start gap-3 md:col-span-2">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 h-4 w-4 accent-brand-green" />
      <span><span className="font-medium">{label}</span>{help ? <span className="help block">{help}</span> : null}</span>
    </label>
  );
}

export function Field({ name, label, defaultValue, type = 'text', help, wide, textarea, step, placeholder }: {
  name: string; label: string; defaultValue: string | number | null | undefined; type?: string; help?: string; wide?: boolean; textarea?: boolean; step?: string; placeholder?: string;
}) {
  return (
    <label className={wide ? 'md:col-span-2' : ''}>
      <span className="label">{label}</span>
      {textarea
        ? <textarea name={name} rows={3} className="input" defaultValue={defaultValue ?? ''} placeholder={placeholder} />
        : <input name={name} type={type} step={step} className="input" defaultValue={defaultValue ?? ''} placeholder={placeholder} />}
      {help ? <span className="help mt-1 block">{help}</span> : null}
    </label>
  );
}
