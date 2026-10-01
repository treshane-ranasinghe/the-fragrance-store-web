import { ActionForm } from '@/components/admin/ActionForm';
import { MediaPicker, type Media } from '@/components/admin/MediaPicker';
import { Field, SettingsForm } from '@/components/admin/SettingsFields';
import { Card, PageHeader } from '@/components/admin/ui';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { requireAdmin } from '@/lib/admin';
import { setRoleAction } from '@/lib/actions/admin/customers';

export const metadata = { title: 'Store settings' };

export default async function SettingsPage() {
  const { supabase, user } = await requireAdmin();
  const [{ data: s }, { data: admins }] = await Promise.all([
    supabase.from('store_settings').select('*').single(),
    supabase.from('profiles').select('id, full_name, email').eq('role', 'admin').order('created_at'),
  ]);
  const { data: hero } = s?.default_hero_media_id ? await supabase.from('media_assets').select('*').eq('id', s.default_hero_media_id).maybeSingle() : { data: null };
  return (
    <div className="max-w-4xl space-y-8">
      <PageHeader title="Store settings" />
      <section><h2 className="mb-3 text-2xl">Contact details</h2>
        <SettingsForm fields={['store_name', 'store_phone', 'store_whatsapp', 'store_email', 'store_address', 'store_hours', 'maps_url']}>
          <Field name="store_name" label="Store name" defaultValue={s?.store_name} />
          <Field name="store_email" label="Email" type="email" defaultValue={s?.store_email} />
          <Field name="store_phone" label="Phone" defaultValue={s?.store_phone} />
          <Field name="store_whatsapp" label="WhatsApp number" defaultValue={s?.store_whatsapp} help="International format without +, e.g. 94771234567" />
          <Field name="store_address" label="Address (Visit section)" defaultValue={s?.store_address} wide textarea />
          <Field name="store_hours" label="Opening hours" defaultValue={s?.store_hours} wide textarea />
          <Field name="maps_url" label="Google Maps link (Get Directions)" defaultValue={s?.maps_url} wide />
        </SettingsForm>
      </section>
      <section><h2 className="mb-3 text-2xl">Social &amp; announcement</h2>
        <SettingsForm fields={['instagram_url', 'instagram_handle', 'facebook_url', 'tiktok_url', 'announcement_short']}>
          <Field name="instagram_url" label="Instagram link" defaultValue={s?.instagram_url} />
          <Field name="instagram_handle" label="Instagram handle (gallery tile)" defaultValue={s?.instagram_handle} placeholder="@thefragrancestore.lk" />
          <Field name="facebook_url" label="Facebook link" defaultValue={s?.facebook_url} />
          <Field name="tiktok_url" label="TikTok link" defaultValue={s?.tiktok_url} />
          <Field name="announcement_short" label="Short announcement text for phones" defaultValue={s?.announcement_short} wide help="The long text is set in Content → Announcement bar" />
        </SettingsForm>
      </section>
      <section><h2 className="mb-3 text-2xl">Orders &amp; carts</h2>
        <SettingsForm fields={['bank_payment_hours', 'abandoned_cart_hours', 'cart_keep_days_after_delivery']}>
          <Field name="bank_payment_hours" label="Bank transfer payment deadline (hours)" type="number" defaultValue={s?.bank_payment_hours} />
          <Field name="abandoned_cart_hours" label="Abandoned cart after (hours)" type="number" defaultValue={s?.abandoned_cart_hours} />
          <Field name="cart_keep_days_after_delivery" label="Keep delivered orders in the cart for (days)" type="number" defaultValue={s?.cart_keep_days_after_delivery} />
        </SettingsForm>
      </section>
      <section><h2 className="mb-3 text-2xl">Default homepage banner</h2>
        <SettingsForm fields={['default_hero_media_id']}>
          <div className="md:col-span-2"><MediaPicker name="default_hero_media_id" initial={hero as Media | null} label="Shown when no hero banner is live" slot="hero_desktop" /></div>
        </SettingsForm>
      </section>
      <Card title="Admin users">
        <ul className="mb-4 divide-y divide-brand-beige text-sm">
          {(admins ?? []).map((a) => (
            <li key={a.id} className="flex items-center justify-between py-2">
              <span>{a.full_name ?? '—'} · {a.email}</span>
              {a.id !== user.id ? (
                <ActionForm action={setRoleAction}><input type="hidden" name="user_id" value={a.id} /><input type="hidden" name="role" value="customer" /><SubmitButton className="text-sm text-state-error underline" pendingText="…">Remove admin</SubmitButton></ActionForm>
              ) : <span className="text-brand-muted">You</span>}
            </li>
          ))}
        </ul>
        <ActionForm action={setRoleAction} className="flex flex-wrap items-end gap-2" resetOnSuccess>
          <input type="hidden" name="role" value="admin" />
          <label className="flex-1"><span className="label">Promote an existing user to admin</span><input name="email" type="email" required placeholder="their account email" className="input input-sm" /></label>
          <SubmitButton className="btn-primary btn-sm">Make admin</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
