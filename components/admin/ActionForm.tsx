'use client';
import { useActionState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { AdminState } from '@/lib/actions/admin/result';

/** Form bound to a server action; shows the error / success message. Optional redirect on success (with id). */
export function ActionForm({ action, children, className = '', redirectTo, resetOnSuccess = false, onSuccess }: {
  action: (s: AdminState, fd: FormData) => Promise<AdminState>;
  children: React.ReactNode; className?: string; redirectTo?: (id?: string) => string; resetOnSuccess?: boolean; onSuccess?: (state: NonNullable<AdminState>) => void;
}) {
  const [state, formAction] = useActionState(action, undefined);
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (!state?.ok) return;
    if (redirectTo) router.push(redirectTo(state.id));
    else router.refresh();
    if (resetOnSuccess) ref.current?.reset();
    onSuccess?.(state);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);
  return (
    <form ref={ref} action={formAction} className={className}>
      {state?.error ? <p role="alert" className="mb-3 rounded-btn bg-state-error/10 p-3 text-sm text-state-error">{state.error}</p> : null}
      {state?.ok && !redirectTo ? <p role="status" className="mb-3 rounded-btn bg-state-success/10 p-3 text-sm text-state-success">{state.ok}</p> : null}
      {children}
    </form>
  );
}
