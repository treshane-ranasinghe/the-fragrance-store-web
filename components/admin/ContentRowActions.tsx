import { deleteContentAction, duplicateContentAction, toggleActiveAction } from '@/lib/actions/admin/content';
import { ConfirmButton } from './ConfirmButton';

export function ContentRowActions({ table, id, active, back, duplicate }: { table: string; id: string; active: boolean; back?: string; duplicate?: boolean }) {
  return (
    <span className="inline-flex items-center gap-3 text-sm">
      {duplicate ? <form action={duplicateContentAction}><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} /><button className="underline" title="Creates a hidden copy">Duplicate</button></form> : null}
      <form action={toggleActiveAction}><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} /><input type="hidden" name="active" value={String(!active)} /><button className="underline">{active ? 'Hide' : 'Show'}</button></form>
      <form action={deleteContentAction}><input type="hidden" name="table" value={table} /><input type="hidden" name="id" value={id} />{back ? <input type="hidden" name="back" value={back} /> : null}<ConfirmButton message="Delete this permanently? This can’t be undone — use Hide to take it off the site instead." className="text-state-error underline">Delete</ConfirmButton></form>
    </span>
  );
}
