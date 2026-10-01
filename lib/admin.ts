import 'server-only';
import { redirect } from 'next/navigation';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

/** Every admin page / action re-checks the role (middleware also does, and RLS underneath) */
export async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login?next=/admin');
  const { data } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).maybeSingle();
  if (data?.role !== 'admin') redirect('/');
  return { supabase, user, name: data.full_name as string | null };
}

/** Refresh cached public pages after an admin save (live within seconds) */
export function refreshStore(tags: ('catalog' | 'cms' | 'bundles' | 'settings')[], paths: string[] = []) {
  tags.forEach((t) => revalidateTag(t));
  paths.forEach((p) => revalidatePath(p));
  revalidatePath('/sitemap.xml');
}

export function csvResponse(filename: string, rows: Record<string, unknown>[]) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const esc = (v: unknown) => {
    const s = v == null ? '' : Array.isArray(v) ? v.join('; ') : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
  return new Response('﻿' + body, {
    headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' },
  });
}
