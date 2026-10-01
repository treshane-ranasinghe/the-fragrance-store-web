'use client';
import { createContext, useContext } from 'react';

export interface SiteInfo {
  whatsapp: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  hours: string | null;
  instagram: string | null;
  instagramHandle: string | null;
  facebook: string | null;
  tiktok: string | null;
  maps: string | null;
  /** Free-delivery threshold of the main delivery method (bag progress meter) */
  freeOver: number | null;
}

const Ctx = createContext<SiteInfo | null>(null);

export function SiteProvider({ value, children }: { value: SiteInfo; children: React.ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSite() {
  return useContext(Ctx) ?? ({} as SiteInfo);
}


export { waLink } from './wa';
