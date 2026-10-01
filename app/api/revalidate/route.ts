import { revalidatePath, revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';

/**
 * Called by pg_cron (cms_schedule_tick) when scheduled content starts or ends.
 * Requires the shared secret; it only refreshes pages and cannot change data.
 */
export async function POST(request: NextRequest) {
  if (!process.env.REVALIDATE_SECRET || request.headers.get('x-revalidate-secret') !== process.env.REVALIDATE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { tags?: string[]; paths?: string[] };
  const allowedTags = new Set(['catalog', 'cms', 'bundles', 'settings']);
  const tags = (body.tags ?? []).filter((t) => allowedTags.has(t));
  const paths = (body.paths ?? []).filter((p) => typeof p === 'string' && p.startsWith('/') && p.length < 200);
  tags.forEach((t) => revalidateTag(t));
  paths.forEach((p) => revalidatePath(p));
  revalidatePath('/sitemap.xml');
  return NextResponse.json({ revalidated: true, tags, paths });
}
