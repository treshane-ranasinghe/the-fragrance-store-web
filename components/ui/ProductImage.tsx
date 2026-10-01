import Image from 'next/image';
import { productImage } from '@/lib/storage';

/** next/image for product photos, with an elegant bottle placeholder when there's no photo yet */
export function ProductImage({ path, alt, sizes = '(max-width: 768px) 50vw, 25vw', priority = false, className = '' }:
  { path: string | null | undefined; alt: string; sizes?: string; priority?: boolean; className?: string }) {
  const src = productImage(path);
  if (!src) return <BottlePlaceholder label={alt} className={className} />;
  return <Image src={src} alt={alt} fill sizes={sizes} priority={priority} className={`object-cover ${className}`} />;
}

export function BottlePlaceholder({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div role="img" aria-label={label} className={`absolute inset-0 flex items-center justify-center bg-gradient-to-b from-white to-brand-cream ${className}`}>
      <svg viewBox="0 0 80 120" className="h-1/2 w-1/2 text-brand-beige" fill="none" stroke="currentColor" strokeWidth={2}>
        <rect x="32" y="6" width="16" height="12" rx="2" />
        <rect x="36" y="18" width="8" height="10" />
        <rect x="14" y="28" width="52" height="84" rx="10" />
        <path d="M24 60h32" stroke="#B89B63" />
      </svg>
    </div>
  );
}
