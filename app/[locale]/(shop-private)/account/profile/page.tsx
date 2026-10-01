import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { ProfileForm } from '@/components/store/ProfileForm';
import { pageLocale } from '@/i18n/server';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const t = await getTranslations({ locale: await pageLocale(params), namespace: 'meta' });
  return { title: t('profile') };
}

export default async function ProfilePage({ params }: Props) {
  await pageLocale(params);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: p } = await supabase.from('profiles').select('full_name, phone, date_of_birth, marketing_opt_in, avatar_path').eq('id', user!.id).single();
  const avatarUrl = p?.avatar_path ? (await supabase.storage.from('avatars').createSignedUrl(p.avatar_path, 3600)).data?.signedUrl ?? null : null;
  return (
    <div style={{ maxWidth: 640 }}>
      <ProfileForm userId={user!.id} email={user!.email ?? ''} avatarUrl={avatarUrl}
        profile={{ full_name: p?.full_name ?? '', phone: p?.phone ?? '', date_of_birth: p?.date_of_birth ?? null, marketing_opt_in: !!p?.marketing_opt_in }} />
    </div>
  );
}
