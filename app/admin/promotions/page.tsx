import Link from 'next/link';
import { ContentRowActions } from '@/components/admin/ContentRowActions';
import { ContentStatus, Empty, PageHeader } from '@/components/admin/ui';
import { requireAdmin } from '@/lib/admin';
import { formatDateTime, formatRs } from '@/lib/format';

export const metadata = { title: 'Promotions' };

export default async function PromotionsPage() {
  const { supabase } = await requireAdmin();
  const [{ data: promos }, { data: affected }] = await Promise.all([
    supabase.from('promotions').select('*, promotion_targets(target_type, is_exclusion)').order('starts_at', { ascending: false }),
    supabase.from('store_variants').select('promotion_id, product_id').not('promotion_id', 'is', null),
  ]);
  const counts = (affected ?? []).reduce<Record<string, Set<string>>>((acc, v) => { (acc[v.promotion_id!] ??= new Set()).add(v.product_id); return acc; }, {});
  return (
    <div>
      <PageHeader title="Promotions" subtitle="Timed sales that lower prices automatically" actions={<Link href="/admin/promotions/new" className="btn-primary btn-sm no-underline">+ New promotion</Link>} />
      {!promos?.length ? <Empty>No promotions yet.</Empty> : (
        <div className="card overflow-x-auto">
          <table className="table-admin">
            <thead><tr><th>Name</th><th>Discount</th><th>Applies to</th><th>Dates</th><th>Status</th><th className="text-right">Products (live)</th><th /></tr></thead>
            <tbody>{promos.map((p) => {
              const t = (p.promotion_targets as { target_type: string; is_exclusion: boolean }[]).filter((x) => !x.is_exclusion);
              const applies = t.some((x) => x.target_type === 'all') ? 'Whole store' : [...new Set(t.map((x) => x.target_type))].map((x) => `${t.filter((y) => y.target_type === x).length} ${x}${t.filter((y) => y.target_type === x).length > 1 ? 's' : ''}`).join(', ');
              return (
                <tr key={p.id}>
                  <td><Link href={`/admin/promotions/${p.id}`} className="font-medium">{p.name}</Link><br /><span className="text-xs text-brand-muted">/promotions/{p.slug}</span></td>
                  <td>{p.discount_type === 'percent' ? `${Number(p.discount_value)}%` : formatRs(p.discount_value)} off</td>
                  <td>{applies || '—'}</td>
                  <td className="whitespace-nowrap text-xs">{formatDateTime(p.starts_at)}<br />→ {formatDateTime(p.ends_at)}</td>
                  <td><ContentStatus is_active={p.is_active} starts_at={p.starts_at} ends_at={p.ends_at} draftLabel="Draft" /></td>
                  <td className="text-right">{counts[p.id]?.size ?? 0}</td>
                  <td className="whitespace-nowrap"><ContentRowActions table="promotions" id={p.id} active={p.is_active} /></td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
