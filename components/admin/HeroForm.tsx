'use client';
import { ActionForm } from './ActionForm';
import { LinkPicker, type LinkOptions } from './LinkPicker';
import { MediaPicker, type Media } from './MediaPicker';
import { toLocalInput } from './ui';
import { SubmitButton } from '@/components/ui/SubmitButton';
import { saveHeroAction } from '@/lib/actions/admin/content';

interface Banner {
  id: string; internal_name: string; alt_text: string; eyebrow: string | null; headline: string | null; subheading: string | null;
  button1_text: string | null; button1_link_type: string | null; button1_link_target: string | null;
  button2_text: string | null; button2_link_type: string | null; button2_link_target: string | null;
  text_position: string; overlay: string; text_colour: string; starts_at: string | null; ends_at: string | null; is_active: boolean;
  ghost_word?: string | null; tint?: string | null; feature_product_id?: string | null;
}

export function HeroForm({ banner, desktop, mobile, options, products = [], onDone }: { banner?: Banner; desktop?: Media | null; mobile?: Media | null; options: LinkOptions; products?: { id: string; name: string }[]; onDone?: () => void }) {
  return (
    <ActionForm action={saveHeroAction} className="grid gap-4 md:grid-cols-2" resetOnSuccess={!banner} onSuccess={onDone}>
      <input type="hidden" name="id" value={banner?.id ?? ''} />
      <label className="md:col-span-2"><span className="label">Internal name (admin only)</span><input name="internal_name" required defaultValue={banner?.internal_name} className="input" placeholder="e.g. Avurudu 2027 main" /></label>
      <MediaPicker name="desktop_media_id" initial={desktop} label="Desktop image *" slot="hero_desktop" />
      <MediaPicker name="mobile_media_id" initial={mobile} label="Mobile image (recommended)" slot="hero_mobile" hint="If empty, phones show the desktop image cropped to portrait." />
      <label><span className="label">Ghost word (giant outlined letters)</span><input name="ghost_word" defaultValue={banner?.ghost_word ?? ''} maxLength={12} className="input uppercase" placeholder="ELIXIR" /></label>
      <label><span className="label">Glow tint</span><input name="tint" type="color" defaultValue={banner?.tint ?? '#C6A566'} className="input h-12 p-1" /></label>
      <label className="md:col-span-2"><span className="label">&ldquo;Now Featuring&rdquo; product</span>
        <select name="feature_product_id" defaultValue={banner?.feature_product_id ?? ''} className="input"><option value="">None</option>{products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="md:col-span-2"><span className="label">Image alt text *</span><input name="alt_text" required defaultValue={banner?.alt_text} className="input" placeholder="Describe the image" /></label>
      <label><span className="label">Small top line (eyebrow)</span><input name="eyebrow" defaultValue={banner?.eyebrow ?? ''} className="input" placeholder="LIMITED TIME" /><span className="help">Only the first banner&rsquo;s is shown, and only if it has a headline</span></label>
      <label><span className="label">Headline</span><input name="headline" defaultValue={banner?.headline ?? ''} className="input" /><span className="help">Used as the ghost word if that is empty</span></label>
      <label className="md:col-span-2"><span className="label">Sub-heading</span><input name="subheading" defaultValue={banner?.subheading ?? ''} className="input" /><span className="help">Only the first banner&rsquo;s is shown, and only if it has a headline</span></label>
      <div><span className="label">Button 1</span><input name="button1_text" defaultValue={banner?.button1_text ?? ''} className="input input-sm mb-2" placeholder="Button text" aria-label="Button 1 text" />
        <LinkPicker prefix="button1" options={options} initialType={banner?.button1_link_type} initialTarget={banner?.button1_link_target} /><span className="help">The link is where the slide goes when clicked</span></div>
      <div><span className="label">Button 2 (outline)</span><input name="button2_text" defaultValue={banner?.button2_text ?? ''} className="input input-sm mb-2" placeholder="Button text" aria-label="Button 2 text" />
        <LinkPicker prefix="button2" options={options} initialType={banner?.button2_link_type} initialTarget={banner?.button2_link_target} /><span className="help">Not used by the current homepage design</span></div>
      <label><span className="label">Text position</span><select name="text_position" defaultValue={banner?.text_position ?? 'left'} className="input"><option value="left">Left</option><option value="center">Centre</option><option value="right">Right</option></select><span className="help">Not used by the current homepage design</span></label>
      <label><span className="label">Overlay</span><select name="overlay" defaultValue={banner?.overlay ?? 'medium'} className="input"><option value="none">None</option><option value="light">Light</option><option value="medium">Medium</option><option value="dark">Dark</option></select><span className="help">Not used by the current homepage design</span></label>
      <label><span className="label">Text colour</span><select name="text_colour" defaultValue={banner?.text_colour ?? 'cream'} className="input"><option value="cream">Cream (dark images)</option><option value="dark">Dark (light images)</option></select><span className="help">Not used by the current homepage design</span></label>
      <label className="flex items-center gap-2 self-end pb-3 text-sm"><input type="checkbox" name="is_active" defaultChecked={banner?.is_active ?? true} className="h-4 w-4 accent-brand-green" />Active</label>
      <label><span className="label">Start (Sri Lanka time)</span><input type="datetime-local" name="starts_at" defaultValue={toLocalInput(banner?.starts_at)} className="input" /></label>
      <label><span className="label">End</span><input type="datetime-local" name="ends_at" defaultValue={toLocalInput(banner?.ends_at)} className="input" /><span className="help">Blank = always on while active</span></label>
      <div className="md:col-span-2"><SubmitButton>{banner ? 'Save banner' : 'Add banner'}</SubmitButton></div>
    </ActionForm>
  );
}
