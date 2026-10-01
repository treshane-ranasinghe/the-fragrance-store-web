'use client';
import { useTranslations } from 'next-intl';
import { SL_DISTRICTS } from '@/lib/format';

/** <option>s for the 25 districts: the value stays English (stored on the address), the label is in the page language */
export function DistrictOptions() {
  const t = useTranslations('districts');
  return <>{SL_DISTRICTS.map((d) => <option key={d} value={d}>{t(d.replace(/\s/g, ''))}</option>)}</>;
}
