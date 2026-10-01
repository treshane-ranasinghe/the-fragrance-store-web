'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { createClient } from '@/lib/supabase/client';
import { timeAgo } from '@/lib/format';

interface Alert { id: number; type: string; order_id: string | null; message: string; read_at: string | null; created_at: string }

/** Real-time alerts: new orders, "I've made the payment", stock issues, refused COD parcels */
export function AdminAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [open, setOpen] = useState(false);
  const [flash, setFlash] = useState<Alert | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('admin_alerts').select('*').order('created_at', { ascending: false }).limit(20).then(({ data }) => setAlerts((data as Alert[]) ?? []));
    const channel = supabase.channel('admin-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'admin_alerts' }, (payload) => {
        const a = payload.new as Alert;
        setAlerts((cur) => [a, ...cur].slice(0, 20));
        setFlash(a);
        setTimeout(() => setFlash(null), 6000);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const unread = alerts.filter((a) => !a.read_at).length;
  const markAll = async () => {
    const ids = alerts.filter((a) => !a.read_at).map((a) => a.id);
    if (!ids.length) return;
    await createClient().from('admin_alerts').update({ read_at: new Date().toISOString() }).in('id', ids);
    setAlerts((cur) => cur.map((a) => ({ ...a, read_at: a.read_at ?? new Date().toISOString() })));
  };

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(!open)} className="relative rounded-btn p-2 text-brand-green hover:bg-brand-beige/40" aria-label={`Alerts, ${unread} unread`} aria-expanded={open}>
        <Icon name="bell" className="h-6 w-6" />
        {unread ? <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-gold px-1 text-[11px] font-semibold text-brand-ink">{unread}</span> : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-40 w-80 rounded-card border border-brand-beige bg-white shadow-card">
          <div className="flex items-center justify-between border-b border-brand-beige px-4 py-2">
            <p className="font-medium">Alerts</p>
            <button type="button" onClick={markAll} className="text-xs underline">Mark all read</button>
          </div>
          <ul className="max-h-96 overflow-y-auto">
            {alerts.length === 0 ? <li className="p-4 text-sm text-brand-muted">No alerts</li> : alerts.map((a) => (
              <li key={a.id} className={`border-b border-brand-beige/60 px-4 py-3 text-sm ${a.read_at ? '' : 'bg-brand-gold/10'}`}>
                {a.order_id ? <Link href={`/admin/orders/${a.order_id}`} onClick={() => setOpen(false)}>{a.message}</Link> : a.message}
                <p className="text-xs text-brand-muted">{timeAgo(a.created_at)}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {flash ? (
        <div role="status" className="fixed bottom-4 right-4 z-50 max-w-sm animate-flash rounded-card border border-brand-gold bg-white p-4 text-sm shadow-card">
          <p className="font-medium text-brand-green">New alert</p>
          {flash.order_id ? <Link href={`/admin/orders/${flash.order_id}`}>{flash.message}</Link> : <p>{flash.message}</p>}
        </div>
      ) : null}
    </div>
  );
}
