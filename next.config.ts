import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./i18n/request.ts');

const supabaseHost = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : 'localhost';

const nextConfig: NextConfig = {
  // Lets a second dev / test server use its own build folder (NEXT_DIST_DIR=.next-test) without corrupting .next
  distDir: process.env.NEXT_DIST_DIR || '.next',
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [{ protocol: 'https', hostname: supabaseHost, pathname: '/storage/v1/object/public/**' }],
  },
  // Old single-page anchors / info pages now have their own pages
  async redirects() {
    return [
      // The Visit page was removed; old links go to the home page
      { source: '/visit', destination: '/', permanent: true },
      { source: '/si/visit', destination: '/si', permanent: true },
      { source: '/contact', destination: '/', permanent: true },
      { source: '/about', destination: '/our-story', permanent: true },
      { source: '/si/contact', destination: '/si', permanent: true },
      { source: '/si/about', destination: '/si/our-story', permanent: true },
    ];
  },
  experimental: {
    serverActions: { bodySizeLimit: '6mb' },
  },
};

export default withNextIntl(nextConfig);
