import { notFound } from 'next/navigation';

/** Unknown storefront URLs → the translated 404 in app/[locale]/not-found.tsx */
export default function CatchAll() {
  notFound();
}
