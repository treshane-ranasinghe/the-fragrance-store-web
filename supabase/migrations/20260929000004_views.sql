-- Views. All use security_invoker so Row Level Security of the caller applies.

-- Confirmed units sold per product (orders are private, so this runs as owner)
create or replace function private.product_sales_qty(p_product_id uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(oi.quantity), 0)::int
    from public.order_items oi join public.orders o on o.id = oi.order_id
   where oi.product_id = p_product_id and o.status in ('processing', 'shipped', 'delivered', 'completed');
$$;

-- ---------------------------------------------------------------------------
-- Storefront
-- ---------------------------------------------------------------------------
create or replace view public.store_variants with (security_invoker = true) as
select pv.id, pv.product_id, pv.size_ml, pv.sku, pv.stock_qty, pv.compare_at_price,
       vp.base_price as price, vp.effective_price, vp.discount_amount, vp.promotion_id, vp.promotion_slug,
       vp.badge_text, vp.promo_ends_at, vp.show_countdown
  from public.product_variants pv
  join public.products p on p.id = pv.product_id
  cross join lateral public.variant_pricing(pv.id) vp
 where pv.is_active and p.is_active and p.deleted_at is null;

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
             array_to_string(p.top_notes || p.middle_notes || p.base_notes, ' ')) as search_text
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
         where bi.bundle_id = bu.id) as item_images
  from public.bundles bu
  left join public.categories c on c.id = bu.category_id
  cross join lateral public.bundle_pricing(bu.id) bp
 where public.is_live(bu.is_active, bu.starts_at, bu.ends_at);

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

-- Public checkout / order-page settings (no internal thresholds)
create or replace view public.public_store_settings as
select store_name, bacs_enabled, bacs_title, bacs_description, bacs_instructions, bank_payment_hours,
       cod_enabled, cod_title, cod_description, cod_instructions, cod_fee, cod_max_order_value,
       store_phone, store_whatsapp, store_email, store_address, default_hero_media_id
  from public.store_settings where id = 1;

-- ---------------------------------------------------------------------------
-- Customers (own rows only)
-- ---------------------------------------------------------------------------
create or replace view public.my_order_summary with (security_invoker = true) as
select count(*)::int as total_orders,
       coalesce(sum(total) filter (where status = 'completed'), 0) as total_spent,
       count(*) filter (where status in ('pending', 'on_hold', 'processing', 'shipped'))::int as in_progress,
       min(created_at) as first_order_at,
       max(created_at) as last_order_at
  from public.orders where user_id = auth.uid();

create or replace view public.my_order_history with (security_invoker = true) as
select o.id, o.order_number, o.created_at, o.status, o.payment_method, o.payment_status, o.total,
       (select coalesce(sum(quantity), 0) from public.order_items oi where oi.order_id = o.id and oi.parent_item_id is null)::int as item_count,
       (select string_agg(product_name, ' ') from public.order_items oi where oi.order_id = o.id) as product_names
  from public.orders o where o.user_id = auth.uid();

create or replace view public.my_purchased_products with (security_invoker = true) as
select oi.product_id, oi.variant_id, max(oi.product_name) as product_name, max(oi.brand_name) as brand_name, oi.size_ml,
       count(distinct o.id)::int as times_bought, sum(oi.quantity)::int as total_quantity,
       max(o.created_at) as last_bought_at,
       (array_agg(oi.unit_price order by o.created_at desc) filter (where oi.parent_item_id is null))[1] as last_price_paid,
       max(p.slug) as slug,
       (select storage_path from public.product_images i where i.product_id = oi.product_id order by sort_order limit 1) as image_path,
       (select effective_price from public.store_variants sv where sv.id = oi.variant_id) as current_price,
       coalesce((select stock_qty > 0 from public.store_variants sv where sv.id = oi.variant_id), false) as in_stock
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  left join public.products p on p.id = oi.product_id
 where o.user_id = auth.uid() and o.status in ('delivered', 'completed') and oi.variant_id is not null
 group by oi.product_id, oi.variant_id, oi.size_ml;

-- ---------------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------------
create or replace view public.admin_customer_stats with (security_invoker = true) as
select pr.id, pr.full_name, pr.email, pr.phone, pr.role, pr.created_at, pr.failed_cod_count, pr.marketing_opt_in, pr.deleted_at,
       count(o.id)::int as total_orders,
       count(o.id) filter (where o.status = 'completed')::int as completed_orders,
       count(o.id) filter (where o.status = 'cancelled')::int as cancelled_orders,
       count(o.id) filter (where o.status = 'returned' or o.failure_reason is not null)::int as returned_orders,
       coalesce(sum(o.total) filter (where o.status = 'completed'), 0) as total_spent,
       coalesce(avg(o.total) filter (where o.status = 'completed'), 0)::numeric(10,2) as avg_order_value,
       min(o.created_at) as first_order_at,
       max(o.created_at) as last_order_at
  from public.profiles pr
  left join public.orders o on o.user_id = pr.id
 where public.is_admin() and not pr.is_anonymous
 group by pr.id;

create or replace view public.admin_cart_lines with (security_invoker = true) as
select ci.id, ci.user_id, ci.variant_id, ci.bundle_id, ci.quantity, ci.added_at, ci.updated_at,
       coalesce(p.name || ' ' || pv.size_ml || 'ml', bu.name) as item_name,
       ci.bundle_id is not null as is_bundle,
       private.cart_price(ci.variant_id, ci.bundle_id) as unit_price,
       private.cart_price(ci.variant_id, ci.bundle_id) * ci.quantity as line_value
  from public.cart_items ci
  left join public.product_variants pv on pv.id = ci.variant_id
  left join public.products p on p.id = pv.product_id
  left join public.bundles bu on bu.id = ci.bundle_id
 where public.is_admin() and ci.state = 'active';

create or replace view public.admin_active_carts with (security_invoker = true) as
select l.user_id,
       case when pr.is_anonymous then private.guest_label(pr.id) else coalesce(pr.full_name, pr.email) end as customer_name,
       pr.email, pr.phone, pr.is_anonymous,
       sum(l.quantity)::int as item_count,
       sum(l.line_value) as cart_value,
       max(l.updated_at) as last_activity,
       string_agg(l.item_name || ' ×' || l.quantity, ', ' order by l.added_at) as items
  from public.admin_cart_lines l
  join public.profiles pr on pr.id = l.user_id
 group by l.user_id, pr.id;

create or replace view public.admin_abandoned_carts with (security_invoker = true) as
select c.* from public.admin_active_carts c
 where c.last_activity < now() - make_interval(hours => (select abandoned_cart_hours from public.store_settings where id = 1));

create or replace view public.admin_cart_feed with (security_invoker = true) as
select e.id, e.created_at, e.action, e.quantity_before, e.quantity_after, e.price_at_time, e.user_id, e.order_id,
       e.variant_id, e.bundle_id, e.bundle_id is not null as is_bundle,
       case when pr.is_anonymous then private.guest_label(pr.id) else coalesce(pr.full_name, pr.email, 'Customer') end as customer_name,
       pr.email, pr.is_anonymous,
       coalesce(p.name, bu.name) as item_name, b.name as brand_name, pv.size_ml, p.id as product_id
  from public.cart_events e
  join public.profiles pr on pr.id = e.user_id
  left join public.product_variants pv on pv.id = e.variant_id
  left join public.products p on p.id = pv.product_id
  left join public.brands b on b.id = p.brand_id
  left join public.bundles bu on bu.id = e.bundle_id
 where public.is_admin();

create or replace view public.admin_product_cart_stats with (security_invoker = true) as
with ev as (
  select coalesce(pv.product_id, e.bundle_id) as item_id, e.bundle_id is not null as is_bundle, e.action
    from public.cart_events e left join public.product_variants pv on pv.id = e.variant_id
),
ords as (
  select coalesce(oi.product_id, oi.bundle_id) as item_id, count(distinct oi.order_id) as orders, sum(oi.quantity) as qty
    from public.order_items oi join public.orders o on o.id = oi.order_id
   where oi.parent_item_id is null and o.status <> 'cancelled'
   group by 1
)
select i.item_id, i.is_bundle, coalesce(p.name, bu.name) as item_name, b.name as brand_name,
       count(*) filter (where i.action = 'add')::int as adds,
       count(*) filter (where i.action = 'remove')::int as removes,
       coalesce(max(o.orders), 0)::int as orders,
       coalesce(max(o.qty), 0)::int as ordered_qty,
       case when count(*) filter (where i.action = 'add') = 0 then 0
            else round(100.0 * coalesce(max(o.orders), 0) / count(*) filter (where i.action = 'add'), 1) end as conversion_rate
  from ev i
  left join public.products p on p.id = i.item_id and not i.is_bundle
  left join public.brands b on b.id = p.brand_id
  left join public.bundles bu on bu.id = i.item_id and i.is_bundle
  left join ords o on o.item_id = i.item_id
 where public.is_admin() and i.item_id is not null
 group by i.item_id, i.is_bundle, p.name, bu.name, b.name;

create or replace view public.admin_sales_summary with (security_invoker = true) as
select (created_at at time zone 'Asia/Colombo')::date as day,
       count(*)::int as orders,
       count(*) filter (where status not in ('cancelled'))::int as active_orders,
       coalesce(sum(total) filter (where status not in ('cancelled')), 0) as revenue,
       coalesce(sum(total) filter (where payment_status = 'paid'), 0) as paid_revenue
  from public.orders
 where public.is_admin()
 group by 1;

-- Quantities in unconfirmed orders (pending / on_hold), per variant
create or replace view public.admin_variant_awaiting with (security_invoker = true) as
select oi.variant_id, sum(oi.quantity)::int as awaiting_qty, count(distinct o.id)::int as orders
  from public.order_items oi join public.orders o on o.id = oi.order_id
 where public.is_admin() and o.status in ('pending', 'on_hold') and oi.variant_id is not null
 group by oi.variant_id;

-- Unconfirmed orders whose items no longer have enough stock to be confirmed
create or replace view public.admin_stock_warnings with (security_invoker = true) as
select o.id as order_id, o.order_number, o.status, o.payment_status, o.created_at,
       string_agg(p.name || ' ' || pv.size_ml || 'ml (need ' || n.qty || ', have ' || pv.stock_qty || ')', ', ') as shortages
  from public.orders o
  cross join lateral (
    select oi.variant_id, sum(oi.quantity)::int as qty from public.order_items oi
     where oi.order_id = o.id and oi.variant_id is not null group by oi.variant_id) n
  join public.product_variants pv on pv.id = n.variant_id
  join public.products p on p.id = pv.product_id
 where public.is_admin() and o.status in ('pending', 'on_hold') and pv.stock_qty < n.qty
 group by o.id;

-- Order list with the flags the admin needs
create or replace view public.admin_orders with (security_invoker = true) as
select o.*,
       coalesce(pr.full_name, o.shipping_name) as customer_name, pr.email as customer_email,
       case when o.status = 'cancelled' then 0 else greatest(o.total - o.amount_received, 0) end as balance_due,
       (select coalesce(sum(quantity), 0) from public.order_items oi where oi.order_id = o.id and oi.parent_item_id is null)::int as item_count,
       (o.payment_method = 'cod' and o.status = 'pending'
         and (o.created_at < now() - make_interval(hours => s.cod_confirm_hours) or o.cod_call_attempts >= s.cod_max_call_attempts)) as cod_needs_attention,
       (o.payment_method = 'cod' and o.status = 'delivered' and o.payment_status = 'unpaid'
         and o.delivered_at < now() - make_interval(days => s.cod_remit_alert_days)) as cod_remit_overdue,
       case when o.status = 'delivered' then extract(day from now() - o.delivered_at)::int end as days_since_delivery
  from public.orders o
  left join public.profiles pr on pr.id = o.user_id
  cross join public.store_settings s
 where public.is_admin() and s.id = 1;

-- Where each media asset is used (blocks deleting in-use images)
create or replace view public.admin_media_usage with (security_invoker = true) as
select m.id as media_id, u.kind, u.label
  from public.media_assets m
  join lateral (
    select 'Hero banner' as kind, h.internal_name as label from public.hero_banners h where m.id in (h.desktop_media_id, h.mobile_media_id)
    union all
    select 'Promotion', pr.name from public.promotions pr where m.id in (pr.desktop_media_id, pr.mobile_media_id)
    union all
    select 'Homepage section', coalesce(hs.title, hs.type) from public.home_sections hs where hs.config::text like '%' || m.id::text || '%'
    union all
    select 'Default banner', 'Store settings' from public.store_settings ss where ss.default_hero_media_id = m.id
  ) u on true
 where public.is_admin();
