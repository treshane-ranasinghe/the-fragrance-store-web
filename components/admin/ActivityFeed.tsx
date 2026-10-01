'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime, formatRs, timeAgo } from '@/lib/format';

export interface FeedRow {
  id: number; created_at: string; action: string; quantity_before: number; quantity_after: number; price_at_time: number | null;
  user_id: string; customer_name: string; email: string | null; is_anonymous: boolean; item_name: string | null; brand_name: string | null;
  size_ml: number | null; is_bundle: boolean; order_id: string | null;
}

const ACTION: Record<string, { label: string; cls: string }> = {
  add: { label: 'Added', cls: 'text-state-success' },
  remove: { label: 'Removed', cls: 'text-state-error' },
  update_qty: { label: 'Changed qty', cls: 'text-state-warning' },
  checked_out: { label: 'Checked out', cls: 'text-brand-green' },
  released: { label: 'Back in cart', cls: 'text-state-warning' },
  completed: { label: 'Delivered', cls: 'text-brand-muted' },
};

/** Live feed of every add / remove / quantity change, as it happens */
export function ActivityFeed({ initial, limit = 20, filter }: { initial: FeedRow[]; limit?: number; filter?: { customerType?: 'guest' | 'registered'; productId?: string } }) {
  const [rows, setRows] = useState(initial);
  const [fresh, setFresh] = useState<Set<number>>(new Set());

  useEffect(() => setRows(initial), [initial]);
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel('cart-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'cart_events' }, async (payload) => {
        const { data } = await supabase.from('admin_cart_feed').select('*').eq('id', (payload.new as { id: number }).id).maybeSingle();
        if (!data) return;
        const r = data as FeedRow;
        if (filter?.customerType === 'guest' && !r.is_anonymous) return;
        if (filter?.customerType === 'registered' && r.is_anonymous) return;
        if (filter?.productId && (data as { product_id?: string }).product_id !== filter.productId) return;
        setRows((cur) => [r, ...cur.filter((x) => x.id !== r.id)].slice(0, limit));
        setFresh((s) => new Set(s).add(r.id));
        setTimeout(() => setFresh((s) => { const n = new Set(s); n.delete(r.id); return n; }), 2000);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [limit, filter?.customerType, filter?.productId]);

  if (!rows.length) return <p className="text-sm text-brand-muted">No cart activity yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="table-admin">
        <thead><tr><th>Time</th><th>Customer</th><th>Action</th><th>Item</th><th className="text-right">Qty</th><th className="text-right">Price</th></tr></thead>
        <tbody>
          {rows.map((r) => {
            const a = ACTION[r.action] ?? { label: r.action, cls: '' };
            return (
              <tr key={r.id} className={fresh.has(r.id) ? 'animate-flash' : ''}>
                <td className="whitespace-nowrap" title={formatDateTime(r.created_at)}>{timeAgo(r.created_at)}</td>
                <td>{r.is_anonymous ? <span className="text-brand-muted">{r.customer_name}</span> : <Link href={`/admin/customers/${r.user_id}`}>{r.customer_name}</Link>}</td>
                <td className={`font-medium ${a.cls}`}>{a.label}</td>
                <td>{r.is_bundle ? <span className="mr-1 rounded-full bg-brand-green/10 px-1.5 text-xs text-brand-green">Bundle</span> : null}{r.item_name}{r.size_ml ? ` ${r.size_ml} ml` : ''}</td>
                <td className="text-right">{r.action === 'update_qty' ? `${r.quantity_before} → ${r.quantity_after}` : r.action === 'remove' || r.action === 'completed' ? r.quantity_before : r.quantity_after}</td>
                <td className="text-right">{r.price_at_time != null ? formatRs(r.price_at_time) : '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
