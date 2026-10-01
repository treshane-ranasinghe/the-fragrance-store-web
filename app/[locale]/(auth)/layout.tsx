import type { Metadata } from 'next';
import { StoreShell } from '@/components/store/StoreShell';
import { pageLocale } from '@/i18n/server';

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function Layout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  await pageLocale(params);
  return <StoreShell>{children}</StoreShell>;
}
