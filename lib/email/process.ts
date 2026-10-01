import 'server-only';
import { createPublicClient } from '@/lib/supabase/public';
import { renderEmail } from './templates';

/**
 * Sends queued emails from the database outbox via Resend.
 * Emails are optional for version 1: without RESEND_API_KEY jobs are marked "skipped".
 * The database functions are protected by REVALIDATE_SECRET, so no service-role key is needed.
 */
export async function processEmailQueue(limit = 20) {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret) return { processed: 0 };
  const db = createPublicClient();
  const { data, error } = await db.rpc('claim_email_jobs', { p_secret: secret, p_limit: limit });
  if (error) throw error;
  const { jobs, settings, bank_accounts } = data as { jobs: Parameters<typeof renderEmail>[0][] & { id: number; to_email: string | null }[]; settings: Record<string, unknown>; bank_accounts: Record<string, string | null>[] };
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || 'The Fragrance Store <orders@example.com>';

  for (const job of jobs as unknown as (Parameters<typeof renderEmail>[0] & { id: number; to_email: string | null })[]) {
    const mail = renderEmail(job, { settings, bank_accounts });
    if (!mail || !job.to_email || !key) {
      await db.rpc('complete_email_job', { p_secret: secret, p_id: job.id, p_status: 'skipped', p_error: !key ? 'RESEND_API_KEY not set' : !job.to_email ? 'No email address' : 'Unknown template' });
      continue;
    }
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [job.to_email], subject: mail.subject, html: mail.html, reply_to: (settings.store_email as string) || undefined }),
      });
      if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
      await db.rpc('complete_email_job', { p_secret: secret, p_id: job.id, p_status: 'sent' });
    } catch (e) {
      await db.rpc('complete_email_job', { p_secret: secret, p_id: job.id, p_status: 'failed', p_error: String(e).slice(0, 500) });
    }
  }
  return { processed: jobs.length };
}
