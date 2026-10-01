import type { Metadata } from 'next';
import { AdminAlerts } from '@/components/admin/AdminAlerts';
import { AdminNav } from '@/components/admin/AdminNav';
import { FlashHost } from '@/components/admin/Flash';
import { RootDocument } from '@/components/RootDocument';
import { requireAdmin } from '@/lib/admin';
import './admin.css';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/** The admin panel is English-only, so it has its own <html lang="en"> (the storefront's comes from app/[locale]) */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const { name } = await requireAdmin();
  return (
    <RootDocument lang="en">
      <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
        <AdminNav name={name} />
        <div className="min-w-0">
          <div className="sticky top-0 z-30 flex items-center justify-end gap-3 border-b border-brand-beige bg-brand-cream/95 px-4 py-2 backdrop-blur md:px-8">
            <AdminAlerts />
          </div>
          <main className="px-4 py-6 md:px-8 md:py-8">{children}</main>
          <FlashHost />
        </div>
      </div>
    </RootDocument>
  );
}
