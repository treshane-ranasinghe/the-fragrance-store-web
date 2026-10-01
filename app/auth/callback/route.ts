import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { mergePendingCart } from '@/lib/cart-merge';

/** Email confirmation / password reset links and Google sign-in land here */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const nextParam = url.searchParams.get('next') ?? '/account';
  let next = nextParam.startsWith('/') && !nextParam.startsWith('//') ? nextParam : '/account';
  // Google sends ?error=… when the visitor cancels or the provider is not set up
  if (url.searchParams.get('error')) return NextResponse.redirect(new URL('/login?error=google', url.origin));
  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      await mergePendingCart(supabase);
      // Admins signing in (e.g. with Google) go straight to the admin panel, like the password sign-in
      if (/^\/(si\/)?account$/.test(next)) {
        const { data: p } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
        if (p?.role === 'admin') next = '/admin';
      }
      return NextResponse.redirect(new URL(next, url.origin));
    }
  }
  return NextResponse.redirect(new URL('/login?error=link', url.origin));
}
