import { NextResponse, type NextRequest } from 'next/server';
import { hasLocale } from 'next-intl';
import { routing } from '@/i18n/routing';
import { getProductRows } from '@/lib/data';
import { localizeDeep } from '@/lib/i18n-content';

/** Product + sizes for the quick-view modal (public, cached data), in ?locale=en|si */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const requested = request.nextUrl.searchParams.get('locale');
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const data = localizeDeep(await getProductRows((await params).slug), locale);
  if (!data.product) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ product: data.product, variants: data.variants, images: data.images });
}
