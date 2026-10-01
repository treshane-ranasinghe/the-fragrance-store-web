import 'server-only';
import { DEMO_MODE, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/lib/config';

/** Whether Google sign-in is switched on in Supabase (Authentication → Providers). Checked at most every 5 minutes. */
export async function googleSignInEnabled() {
  if (DEMO_MODE || !SUPABASE_URL) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_ANON_KEY }, next: { revalidate: 300 } });
    const d = (await res.json()) as { external?: { google?: boolean } };
    return !!d.external?.google;
  } catch {
    return false;
  }
}
