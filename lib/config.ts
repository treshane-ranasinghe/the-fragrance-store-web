export const STORE_NAME = 'The Fragrance Store';
/** NEXT_PUBLIC_SITE_URL wins; on Vercel without it, fall back to the deployment's own address */
const vercelHost = process.env.VERCEL_ENV === 'production' ? process.env.VERCEL_PROJECT_PRODUCTION_URL : process.env.VERCEL_URL;
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || (vercelHost ? `https://${vercelHost}` : 'http://localhost:3000')).replace(/\/$/, '');
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
/** Pages that show CMS content also expire every 5 minutes as a safety net */
export const CMS_REVALIDATE_SECONDS = 300;
/** No Supabase configured → storefront runs on built-in sample data (lib/demo.ts) */
export const DEMO_MODE = !SUPABASE_URL;

/** Hero slideshow shows at most this many live banners (in list order) */
export const MAX_LIVE_HEROES = 5;
