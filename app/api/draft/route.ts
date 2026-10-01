import { draftMode } from 'next/headers';
import { redirect } from 'next/navigation';
import { type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/** Preview (Draft Mode) — admins only */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response('Unauthorized', { status: 401 });
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (data?.role !== 'admin') return new Response('Unauthorized', { status: 401 });
  (await draftMode()).enable();
  const to = request.nextUrl.searchParams.get('redirect') || '/';
  redirect(to.startsWith('/') && !to.startsWith('//') ? to : '/');
}
