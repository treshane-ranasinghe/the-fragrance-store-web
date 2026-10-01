export type AdminState = { error?: string; ok?: string; id?: string } | undefined;

export function fail(e: unknown): AdminState {
  const m = (e as { message?: string })?.message ?? String(e);
  if (/duplicate key.*slug/i.test(m)) return { error: 'That URL slug is already used — choose another.' };
  if (/duplicate key.*sku/i.test(m)) return { error: 'That SKU is already used by another variant.' };
  if (/violates foreign key/i.test(m)) return { error: 'This item is still used elsewhere, so it cannot be deleted.' };
  return { error: m };
}

export const str = (fd: FormData, k: string) => {
  const v = fd.get(k);
  return typeof v === 'string' ? v.trim() : '';
};
export const optStr = (fd: FormData, k: string) => str(fd, k) || null;
export const num = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === '' ? null : Number(v);
};
export const bool = (fd: FormData, k: string) => fd.get(k) === 'on' || fd.get(k) === 'true';
/** <input type="datetime-local"> is Sri Lanka time → ISO */
export const dt = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v ? new Date(`${v}:00+05:30`).toISOString() : null;
};
