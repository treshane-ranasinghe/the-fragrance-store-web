'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { logoutAction } from '@/lib/actions/auth';

const GROUPS: { title?: string; links: [string, string][] }[] = [
  { links: [['/admin', 'Dashboard']] },
  { title: 'Sales', links: [['/admin/orders', 'Orders'], ['/admin/payments/bank', 'Bank transfers'], ['/admin/payments/cod', 'Cash on delivery'], ['/admin/customers', 'Customers'], ['/admin/cart-activity', 'Cart activity']] },
  { title: 'Catalogue', links: [['/admin/products', 'Products'], ['/admin/categories', 'Categories'], ['/admin/brands', 'Brands'], ['/admin/bundles', 'Bundles'], ['/admin/promotions', 'Promotions']] },
  { title: 'Content', links: [['/admin/content/homepage', 'Homepage'], ['/admin/content/hero', 'Hero banners'], ['/admin/content/announcements', 'Announcement bar'], ['/admin/content/media', 'Media library']] },
  { title: 'Settings', links: [['/admin/settings', 'Store settings'], ['/admin/settings/payments/bank-transfer', 'Bank transfer'], ['/admin/settings/payments/cod', 'Cash on delivery'], ['/admin/settings/delivery', 'Delivery methods']] },
];

export function AdminNav({ name }: { name: string | null }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);
  const isActive = (href: string) => (href === '/admin' ? path === href : href === '/admin/settings' ? path === href : path.startsWith(href));
  const nav = (
    <nav aria-label="Admin" className="flex h-full flex-col gap-5 overflow-y-auto bg-brand-forest px-3 py-5 text-brand-cream">
      <Link href="/admin" className="px-3 font-serif text-2xl font-light text-brand-cream no-underline">The Fragrance <em className="text-brand-gold">Store</em></Link>
      {GROUPS.map((g, i) => (
        <div key={i}>
          {g.title ? <p className="mb-1 px-3 text-xs uppercase tracking-[0.12em] text-brand-gold">{g.title}</p> : null}
          <ul>
            {g.links.map(([href, label]) => (
              <li key={href}>
                <Link href={href} aria-current={isActive(href) ? 'page' : undefined}
                  className={`block border-l-2 px-3 py-1.5 text-sm no-underline ${isActive(href) ? 'border-brand-gold font-medium text-brand-gold' : 'border-transparent text-brand-cream/90 hover:text-brand-cream'}`}>{label}</Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
      <div className="mt-auto space-y-2 border-t border-brand-cream/15 px-3 pt-4 text-sm">
        <p className="text-brand-cream/70">{name ?? 'Admin'}</p>
        <Link href="/" className="block text-brand-gold">View store →</Link>
        <form action={logoutAction}><button className="text-brand-cream/80 hover:text-brand-cream">Log out</button></form>
      </div>
    </nav>
  );
  return (
    <>
      <div className="flex items-center gap-3 bg-brand-forest px-4 py-3 lg:hidden">
        <button type="button" onClick={() => setOpen(true)} aria-label="Open admin menu" className="text-brand-cream"><Icon name="menu" /></button>
        <span className="font-serif text-xl text-brand-cream">Admin</span>
      </div>
      <aside className="sticky top-0 hidden h-screen lg:block">{nav}</aside>
      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-64">{nav}</div>
        </div>
      ) : null}
    </>
  );
}
