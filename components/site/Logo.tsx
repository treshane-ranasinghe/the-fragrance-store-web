import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/** Wordmark where a perfume bottle replaces the "T" in STORE; sprays four mist dots on hover */
export function Logo({ large = false, href = '/' }: { large?: boolean; href?: string }) {
  const t = useTranslations('nav');
  return (
    <Link href={href} className={`logo${large ? ' logo--lg' : ''}`} aria-label={t('home')}>
      <span className="logo__top">The Fragrance</span>
      <span className="logo__word">
        S
        <span className="logo__bottle" aria-hidden="true">
          <svg viewBox="0 0 108 172"><path d="M31 3Q54-1 77 3V55H80V59H108V172H0V59H27V55H31Z" /></svg>
          <i /><i /><i /><i />
        </span>
        <span className="sr-only">T</span>ORE
      </span>
    </Link>
  );
}
