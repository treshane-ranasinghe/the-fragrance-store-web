'use client';
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createClient, ensureSession } from '@/lib/supabase/client';
import { DEMO_MODE } from '@/lib/config';
import { translateDbError } from '@/lib/db-errors';
import type { Cart } from '@/lib/types';

const EMPTY: Cart = { items: [], orders: [], subtotal: 0, count: 0 };

interface CartApi {
  cart: Cart;
  loading: boolean;
  add: (item: { variantId?: string; bundleId?: string; quantity?: number; label?: string }) => Promise<boolean>;
  setQuantity: (itemId: string, quantity: number) => Promise<void>;
  remove: (itemId: string) => Promise<void>;
  refresh: () => Promise<void>;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  toast: { text: string; tone: 'success' | 'error' } | null;
  showToast: (text: string, tone?: 'success' | 'error') => void;
}

const CartContext = createContext<CartApi | null>(null);


// Demo mode (no Supabase): cart lines are kept in browser storage and priced by /api/demo/cart
type DemoLine = { variantId?: string; bundleId?: string; quantity: number };
const DEMO_KEY = 'fs-demo-cart';
const readDemo = (): DemoLine[] => { try { return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]'); } catch { return []; } };
const writeDemo = (l: DemoLine[]) => { try { localStorage.setItem(DEMO_KEY, JSON.stringify(l)); } catch { /* ignore */ } };
const demoPost = async (body: unknown) => (await fetch('/api/demo/cart', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();

function CartState({ children }: { children: React.ReactNode }) {
  const supabase = DEMO_MODE ? (null as unknown as ReturnType<typeof createClient>) : createClient();
  const qc = useQueryClient();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast, setToast] = useState<CartApi['toast']>(null);
  const t = useTranslations();
  const errorMessage = useCallback((e: unknown) => {
    const m = (e as { message?: string })?.message;
    return m ? translateDbError(m, t) : t('cart.somethingWrong');
  }, [t]);

  const query = useQuery({
    queryKey: ['cart'],
    queryFn: async (): Promise<Cart> => {
      if (DEMO_MODE) return (await demoPost({ lines: readDemo() })) as Cart;
      const { data: s } = await supabase.auth.getSession();
      if (!s.session) return EMPTY; // never create guests just by browsing
      const { data, error } = await supabase.rpc('get_cart');
      if (error) throw error;
      return (data as Cart) ?? EMPTY;
    },
    staleTime: 15_000,
  });

  useEffect(() => {
    if (DEMO_MODE) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') qc.invalidateQueries({ queryKey: ['cart'] });
    });
    return () => data.subscription.unsubscribe();
  }, [supabase, qc]);

  const showToast = useCallback((text: string, tone: 'success' | 'error' = 'success') => {
    setToast({ text, tone });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => { await qc.invalidateQueries({ queryKey: ['cart'] }); }, [qc]);

  const add: CartApi['add'] = useCallback(async ({ variantId, bundleId, quantity = 1 }) => {
    try {
      if (DEMO_MODE) {
        const lines = readDemo();
        const cur = lines.find((l) => (variantId ? l.variantId === variantId : l.bundleId === bundleId));
        const res = await demoPost({ lines, check: { variantId, bundleId, quantity: (cur?.quantity ?? 0) + quantity } });
        if (res.error) throw new Error(res.error);
        if (cur) cur.quantity += quantity; else lines.push({ variantId, bundleId, quantity });
        writeDemo(lines);
        await refresh();
        setDrawerOpen(true);
        return true;
      }
      await ensureSession();
      const { error } = await supabase.rpc('add_to_cart', {
        p_variant_id: variantId ?? null, p_bundle_id: bundleId ?? null, p_quantity: quantity,
      });
      if (error) throw error;
      await refresh();
      setDrawerOpen(true);
      return true;
    } catch (e) {
      showToast(errorMessage(e), 'error');
      return false;
    }
  }, [supabase, refresh, showToast, errorMessage]);

  const setQuantity = useCallback(async (itemId: string, quantity: number) => {
    if (DEMO_MODE) {
      const lines = readDemo();
      const idx = Number(itemId.replace('demo-', ''));
      if (quantity <= 0) lines.splice(idx, 1);
      else {
        const res = await demoPost({ lines, check: { ...lines[idx], quantity } });
        if (res.error) { showToast(errorMessage({ message: res.error }), 'error'); return; }
        lines[idx].quantity = quantity;
      }
      writeDemo(lines); await refresh(); return;
    }
    const { error } = await supabase.rpc('set_cart_quantity', { p_item_id: itemId, p_quantity: quantity });
    if (error) showToast(errorMessage(error), 'error');
    await refresh();
  }, [supabase, refresh, showToast, errorMessage]);

  const remove = useCallback(async (itemId: string) => {
    if (DEMO_MODE) { const lines = readDemo(); lines.splice(Number(itemId.replace('demo-', '')), 1); writeDemo(lines); await refresh(); return; }
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (error) showToast(errorMessage(error), 'error');
    await refresh();
  }, [supabase, refresh, showToast, errorMessage]);

  const value = useMemo<CartApi>(() => ({
    cart: query.data ?? EMPTY, loading: query.isLoading, add, setQuantity, remove, refresh,
    drawerOpen, setDrawerOpen, toast, showToast,
  }), [query.data, query.isLoading, add, setQuantity, remove, refresh, drawerOpen, toast, showToast]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: true, retry: 1 } } }));
  return (
    <QueryClientProvider client={client}>
      <CartState>{children}</CartState>
    </QueryClientProvider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside <Providers>');
  return ctx;
}
