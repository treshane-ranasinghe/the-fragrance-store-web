'use client';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

/** Refreshes the list when an order is created or changes (Supabase Realtime) */
export function NewOrderRefresher() {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let t: ReturnType<typeof setTimeout>;
    const ch = supabase.channel('orders-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => { clearTimeout(t); t = setTimeout(() => router.refresh(), 500); })
      .subscribe();
    return () => { clearTimeout(t); supabase.removeChannel(ch); };
  }, [router]);
  return null;
}
