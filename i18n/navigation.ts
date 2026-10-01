import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

/** Locale-aware Link / redirect / router: hrefs are written without the locale ("/shop") and get "/si" added when needed */
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } = createNavigation(routing);
