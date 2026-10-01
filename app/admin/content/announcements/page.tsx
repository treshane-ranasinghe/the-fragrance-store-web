import { ActionForm } from '@/components/admin/ActionForm';
import { ContentRowActions } from '@/components/admin/ContentRowActions';
import { Card, ContentStatus, Empty, PageHeader, toLocalInput } from '@/components/admin/ui';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { requireAdmin } from '@/lib/admin';
import { saveAnnouncementAction } from '@/lib/actions/admin/content';
import { formatDateTime } from '@/lib/format';

export const metadata = { title: 'Announcement bar' };

type A = { id: string; text: string; link_url: string | null; background: string; starts_at: string | null; ends_at: string | null; is_active: boolean };

function Form({ a }: { a?: A }) {
  return (
    <ActionForm action={saveAnnouncementAction} className="grid gap-3 md:grid-cols-2" resetOnSuccess={!a}>
      <input type="hidden" name="id" value={a?.id ?? ''} />
      <label className="md:col-span-2"><span className="label">Text (max ~90 characters)</span><input name="text" required maxLength={120} defaultValue={a?.text} className="input" placeholder="Free delivery on orders over Rs. 10,000" /></label>
      <label><span className="label">Link (optional)</span><input name="link_url" defaultValue={a?.link_url ?? ''} className="input" placeholder="/promotions/avurudu-sale" /></label>
      <label><span className="label">Background</span><select name="background" defaultValue={a?.background ?? 'gold'} className="input"><option value="gold">Gold</option><option value="green">Dark Green</option><option value="beige">Beige</option></select></label>
      <label><span className="label">Start</span><input type="datetime-local" name="starts_at" defaultValue={toLocalInput(a?.starts_at)} className="input" /></label>
      <label><span className="label">End</span><input type="datetime-local" name="ends_at" defaultValue={toLocalInput(a?.ends_at)} className="input" /></label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="is_active" defaultChecked={a?.is_active ?? true} className="h-4 w-4 accent-brand-green" />Active</label>
      <div className="md:col-span-2"><SubmitButton className="btn-primary btn-sm">{a ? 'Save' : 'Add announcement'}</SubmitButton></div>
    </ActionForm>
  );
}

export default async function AnnouncementsPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from('announcements').select('*').order('created_at', { ascending: false });
  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader title="Announcement bar" subtitle="A thin strip at the top of every page. The newest live announcement is shown; visitors can close it for 24 hours." />
      <Card title="Announcements">
        {!data?.length ? <Empty>No announcements.</Empty> : (
          <ul className="space-y-4">{(data as A[]).map((a) => (
            <li key={a.id} className="rounded-card border border-brand-beige p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2"><ContentStatus is_active={a.is_active} starts_at={a.starts_at} ends_at={a.ends_at} />
                  <span className="text-xs text-brand-muted">{a.starts_at || a.ends_at ? `${formatDateTime(a.starts_at)} → ${formatDateTime(a.ends_at)}` : 'Always on'}</span></span>
                <ContentRowActions table="announcements" id={a.id} active={a.is_active} duplicate />
              </div>
              <details><summary className="cursor-pointer font-medium">{a.text}</summary><div className="mt-3"><Form a={a} /></div></details>
            </li>
          ))}</ul>
        )}
      </Card>
      <Card title="Add announcement"><Form /></Card>
    </div>
  );
}
