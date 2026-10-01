-- Sinhala (and any later language) versions of shop text, laid over the English columns by the storefront:
--   products.i18n = {"si": {"description": "…", "top_notes": ["…"]}}
--   home_sections.i18n = {"si": {"title": "…", "config": {"body": "…"}}}
-- Anything left out stays English. Edited in the admin panel ("Sinhala" fields).

alter table public.products        add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');
alter table public.categories      add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');
alter table public.brands          add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');
alter table public.bundles         add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');
alter table public.promotions      add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');
alter table public.hero_banners    add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');
alter table public.announcements   add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');
alter table public.home_sections   add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');
alter table public.delivery_methods add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');
alter table public.store_settings  add column i18n jsonb not null default '{}'::jsonb check (jsonb_typeof(i18n) = 'object');

-- Views that select * must be recreated to pick up the new column
create or replace view public.live_hero_banners with (security_invoker = true) as
select * from public.hero_banners where public.is_live(is_active, starts_at, ends_at);

create or replace view public.live_announcement with (security_invoker = true) as
select * from public.announcements where public.is_live(is_active, starts_at, ends_at)
 order by coalesce(starts_at, created_at) desc limit 1;

create or replace view public.live_home_sections with (security_invoker = true) as
select * from public.home_sections where public.is_live(is_active, starts_at, ends_at);

create or replace view public.live_promotions with (security_invoker = true) as
select * from public.promotions where public.is_live(is_active, starts_at, ends_at);

create or replace view public.live_bundles with (security_invoker = true) as
select * from public.bundles where public.is_live(is_active, starts_at, ends_at);

drop view if exists public.public_store_settings;
create view public.public_store_settings as
select store_name, bacs_enabled, bacs_title, bacs_description, bacs_instructions, bank_payment_hours,
       cod_enabled, cod_title, cod_description, cod_instructions, cod_fee, cod_max_order_value,
       store_phone, store_whatsapp, store_email, store_address, default_hero_media_id,
       store_hours, instagram_url, instagram_handle, facebook_url, tiktok_url, maps_url, announcement_short,
       i18n
  from public.store_settings where id = 1;
grant select on public.public_store_settings to anon, authenticated;

-- store_products / store_bundles: append the translations (append-only, so replace works)
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
       p.badge,
       p.i18n,
       c.i18n as category_i18n
  from public.products p
  left join public.brands b on b.id = p.brand_id
  left join public.categories c on c.id = p.category_id
  left join lateral (select storage_path, alt_text from public.product_images i where i.product_id = p.id order by sort_order limit 1) img on true
  left join v dv on dv.product_id = p.id and dv.rn = 1
 where p.is_active and p.deleted_at is null
   and exists (select 1 from v where v.product_id = p.id);

create or replace view public.store_bundles with (security_invoker = true) as
select bu.id, bu.name, bu.slug, bu.description, bu.category_id, c.slug as category_slug, bu.max_per_order,
       bu.seo_title, bu.seo_description, bu.starts_at, bu.ends_at, bu.updated_at,
       bp.base_price as price, bp.effective_price, bp.badge_text, bp.promo_ends_at, bp.items_value,
       greatest(bp.items_value - bp.effective_price, 0) as you_save,
       public.bundle_availability(bu.id) as available,
       coalesce(
         (select storage_path from public.bundle_images i where i.bundle_id = bu.id order by sort_order limit 1),
         (select pi.storage_path from public.bundle_items bi join public.product_variants v2 on v2.id = bi.variant_id
            join public.product_images pi on pi.product_id = v2.product_id where bi.bundle_id = bu.id
           order by pi.sort_order limit 1)) as image_path,
       (select array_agg(pi.storage_path order by bi.id)
          from public.bundle_items bi join public.product_variants v2 on v2.id = bi.variant_id
          left join lateral (select storage_path from public.product_images i where i.product_id = v2.product_id order by sort_order limit 1) pi on true
         where bi.bundle_id = bu.id) as item_images,
       bu.i18n
  from public.bundles bu
  left join public.categories c on c.id = bu.category_id
  cross join lateral public.bundle_pricing(bu.id) bp
 where public.is_live(bu.is_active, bu.starts_at, bu.ends_at);
