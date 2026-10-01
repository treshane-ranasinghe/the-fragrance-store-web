import type { Metadata, Viewport } from 'next';
import { SITE_URL, STORE_NAME } from '@/lib/config';
import './styles.css';
import './shop.css';
import './theme.css';
import './store.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  openGraph: { siteName: STORE_NAME, type: 'website' },
  twitter: { card: 'summary_large_image' },
  icons: { icon: '/images/favicon.svg' },
};

export const viewport: Viewport = { themeColor: '#0B281F', viewportFit: 'cover' };

/**
 * The <html> tag lives one level down, so it can carry the page language:
 * app/[locale]/layout.tsx for the storefront and app/admin/layout.tsx for the admin panel.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return children;
}
