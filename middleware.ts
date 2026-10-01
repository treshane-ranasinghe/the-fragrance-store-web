import createIntlMiddleware from 'next-intl/middleware';
import { NextResponse, type NextRequest } from 'next/server';
import { localePath, routing, splitLocale } from '@/i18n/routing';
import { refreshSessionOnto, updateSession } from '@/lib/supabase/middleware';
import { DEMO_MODE } from '@/lib/config';

const intl = createIntlMiddleware(routing);

/** Storefront pages that refresh the login cookie (the rest are public, cached pages) */
const SESSION_PATHS = ['/account', '/checkout', '/cart', '/order', '/login', '/register'];
const under = (path: string, prefixes: string[]) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Storefront: picks the language from the URL (/si/… = Sinhala), then checks the login cookie on
 * /account, /checkout and /order. /admin (admin role required) and /auth are English-only and skip the language step.
 * Database security rules still apply underneath.
 */
export async function middleware(request: NextRequest) {
  const fullPath = request.nextUrl.pathname;
  if (fullPath.startsWith('/admin') || fullPath.startsWith('/auth')) return adminOrAuth(request);

  const res = intl(request);
  // Language redirects (e.g. /en/shop → /shop) go straight back to the browser
  if (res.headers.has('location')) return res;

  const { locale, path } = splitLocale(fullPath);
  if (!under(path, SESSION_PATHS)) return res;

  const toLogin = () => {
    const url = request.nextUrl.clone();
    url.pathname = localePath('/login', locale);
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  };

  // Demo mode (no Supabase): pages that need a login go to the login screen, which explains demo mode
  if (DEMO_MODE) return under(path, ['/account', '/order']) ? toLogin() : res;

  const { user } = await refreshSessionOnto(request, res);
  if (under(path, ['/account', '/checkout']) && (!user || user.is_anonymous)) return toLogin();
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}

async function adminOrAuth(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (DEMO_MODE) {
    if (path.startsWith('/admin')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.search = `?next=${encodeURIComponent(path)}`;
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  const { supabase, user, response } = await updateSession(request);

  if (path.startsWith('/admin') && (!user || user.is_anonymous)) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return NextResponse.redirect(url);
  }

  if (path.startsWith('/admin') && user) {
    const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (data?.role !== 'admin') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }
  }

  const res = response();
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}

export const config = {
  // Everything except API routes, Next internals and files (anything with a dot: favicon.svg, sitemap.xml, images…)
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
