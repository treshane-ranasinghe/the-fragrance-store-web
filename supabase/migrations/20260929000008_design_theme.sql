-- Fields needed by the "Onyx & Champagne Gold" design (18-design-theme.md)

-- Hero slides: giant outlined "ghost word", glow tint, and the product shown in the "Now Featuring" card
alter table public.hero_banners
  add column ghost_word text,
  add column tint text not null default '#C6A566' check (tint ~ '^#[0-9A-Fa-f]{6}$'),
  add column feature_product_id uuid references public.products (id) on delete set null;

-- Product card tag ("Bestseller", "Signature", "Icon" …)
alter table public.products add column badge text;

-- Collection cards: short line under the title ("Woods, leather & spice")
alter table public.categories add column subtitle text;

-- Signature homepage sections
alter table public.home_sections drop constraint home_sections_type_check;
alter table public.home_sections add constraint home_sections_type_check check (type in (
  'hero', 'product_row', 'promo_banner', 'bundle_showcase', 'category_tiles', 'brand_strip', 'image_text', 'text', 'trust_badges',
  'marquee', 'notes', 'testimonials', 'gallery', 'visit'
));

-- Boutique details and social links (Visit section, footer, menus)
alter table public.store_settings
  add column store_hours text not null default E'Mon – Sat  10:00 – 20:00\nSunday  11:00 – 18:00',
  add column instagram_url text,
  add column instagram_handle text,
  add column facebook_url text,
  add column tiktok_url text,
  add column maps_url text,
  add column announcement_short text;

-- Views that select * must be recreated to pick up the new columns
create or replace view public.live_hero_banners with (security_invoker = true) as
select * from public.hero_banners where public.is_live(is_active, starts_at, ends_at);

drop view if exists public.public_store_settings;
create view public.public_store_settings as
select store_name, bacs_enabled, bacs_title, bacs_description, bacs_instructions, bank_payment_hours,
       cod_enabled, cod_title, cod_description, cod_instructions, cod_fee, cod_max_order_value,
       store_phone, store_whatsapp, store_email, store_address, default_hero_media_id,
       store_hours, instagram_url, instagram_handle, facebook_url, tiktok_url, maps_url, announcement_short
  from public.store_settings where id = 1;
grant select on public.public_store_settings to anon, authenticated;

-- store_products: add badge + brand/category fields used by the design (append-only, so replace works)
create or replace view public.store_products with (security_invoker = true) as
with v as (
  select sv.*,
         row_number() over (partition by sv.product_id order by (sv.stock_qty > 0) desc, sv.effective_price, sv.size_ml) as rn
    from public.store_variants sv
)
select p.id, p.name, p.slug, p.gender, p.concentration, p.description,
       p.top_notes, p.middle_notes, p.base_notes, p.is_featured, p.created_at, p.updated_at,
       p.seo_title, p.seo_description,
       p.brand_id, b.name as brand_name, b.slug as brand_slug,
       p.category_id, c.name as category_name, c.slug as category_slug,
       img.storage_path as image_path, img.alt_text as image_alt,
       dv.id as default_variant_id, dv.size_ml as default_size_ml,
       dv.effective_price as price, dv.price as regular_price, dv.compare_at_price,
       dv.badge_text, dv.promotion_id, dv.promo_ends_at, dv.show_countdown,
       (select min(effective_price) from v where v.product_id = p.id) as min_price,
       (select max(effective_price) from v where v.product_id = p.id) as max_price,
       (select array_agg(distinct size_ml order by size_ml) from v where v.product_id = p.id) as sizes,
       (select count(*) from v where v.product_id = p.id)::int as variant_count,
       coalesce((select sum(stock_qty) from v where v.product_id = p.id), 0) > 0 as in_stock,
       exists (select 1 from v where v.product_id = p.id and v.promotion_id is not null) as on_sale,
       private.product_sales_qty(p.id) as sales_count,
       lower(p.name || ' ' || coalesce(b.name, '') || ' ' || coalesce(c.name, '') || ' ' || p.concentration || ' ' ||
             array_to_string(p.top_notes || p.middle_notes || p.base_notes, ' ')) as search_text,
       p.badge
  from public.products p
  left join public.brands b on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id
  left join lateral (select storage_path, alt_text from public.product_images i where i.product_id = p.id order by sort_order limit 1) img on true
  left join v dv on dv.product_id = p.id and dv.rn = 1
 where p.is_active and p.deleted_at is null
   and exists (select 1 from v where v.product_id = p.id);

-- Delivery methods such as "Collect from the boutique" don't need a delivery address at checkout
alter table public.delivery_methods add column requires_address boolean not null default true;
