import 'server-only';
import { cookies } from 'next/headers';
import type { createClient } from '@/lib/supabase/server';

export const MERGE_COOKIE = 'fs_cart_merge';

/** Moves a guest cart into the logged-in account using the one-time token (argument or pending cookie) */
export async function mergePendingCart(supabase: Awaited<ReturnType<typeof createClient>>, token?: string | null) {
  const jar = await cookies();
  const t = token ?? jar.get(MERGE_COOKIE)?.value;
  if (!t) return;
  await supabase.rpc('merge_guest_cart', { p_token: t });
  jar.delete(MERGE_COOKIE);
}
