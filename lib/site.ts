import 'server-only';
import { getSettings } from '@/lib/data';
import type { SiteInfo } from '@/components/site/SiteContext';

export async function getSiteInfo(): Promise<SiteInfo> {
  const { settings: s, deliveryMethods } = await getSettings();
  const main = deliveryMethods.find((m) => Number(m.fee) > 0) ?? deliveryMethods[0];
  return {
    whatsapp: s.store_whatsapp, phone: s.store_phone, email: s.store_email, address: s.store_address,
    hours: s.store_hours ?? null, instagram: s.instagram_url ?? null, instagramHandle: s.instagram_handle ?? null,
    facebook: s.facebook_url ?? null, tiktok: s.tiktok_url ?? null, maps: s.maps_url ?? null,
    freeOver: main?.free_over != null ? Number(main.free_over) : null,
  };
}
