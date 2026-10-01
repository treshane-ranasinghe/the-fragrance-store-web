-- Helpers, pricing, availability and triggers

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and deleted_at is null
  );
$$;

create or replace function private.require_admin()
returns void
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can do this' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.is_live(p_active boolean, p_starts timestamptz, p_ends timestamptz)
returns boolean
language sql stable set search_path = ''
as $$
  select coalesce(p_active, false)
     and (p_starts is null or p_starts <= now())
     and (p_ends is null or p_ends > now());
$$;

create or replace function private.touch_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['categories','brands','products','product_variants','promotions','bundles',
                           'hero_banners','announcements','home_sections','cart_items','orders','store_settings']
  loop
    execute format('create trigger %I_touch before update on public.%I for each row execute function private.touch_updated_at()', t, t);
  end loop;
end $$;

create or replace function private.app_config_value(p_key text)
returns text
language sql stable security definer set search_path = ''
as $$
  select value from private.app_config where key = p_key;
$$;

create or replace function private.check_secret(p_secret text)
returns void
language plpgsql stable security definer set search_path = ''
as $$
declare v text := private.app_config_value('revalidate_secret');
begin
  if v is null or p_secret is null or p_secret <> v then
    raise exception 'Invalid secret' using errcode = '42501';
  end if;
end;
$$;

create or replace function private.guest_label(p_user_id uuid)
returns text
language sql immutable set search_path = ''
as $$
  select 'Guest #' || upper(substr(replace(p_user_id::text, '-', ''), 1, 4));
$$;

-- ---------------------------------------------------------------------------
-- Profiles: create on sign-up, protect privileged columns, handle deletion
-- ---------------------------------------------------------------------------
create or replace function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, phone, is_anonymous)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    coalesce(new.is_anonymous, false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- Keeps email / anonymous flag in sync (e.g. email change confirmed, guest upgraded)
create or replace function private.handle_user_updated()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('app.system_profile_change', 'on', true);
  update public.profiles
     set email = new.email,
         is_anonymous = coalesce(new.is_anonymous, false)
   where id = new.id and deleted_at is null;
  return new;
end;
$$;

create trigger on_auth_user_updated
  after update of email, is_anonymous on auth.users
  for each row execute function private.handle_user_updated();

create or replace function private.handle_user_deleted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('app.system_profile_change', 'on', true);
  -- Guests with no orders are removed completely; everyone else is anonymised
  if exists (select 1 from public.orders where user_id = old.id) then
    update public.profiles
       set full_name = 'Deleted customer', email = null, phone = null, date_of_birth = null,
           avatar_path = null, marketing_opt_in = false, deleted_at = coalesce(deleted_at, now())
     where id = old.id;
  else
    delete from public.profiles where id = old.id;
  end if;
  perform set_config('app.system_profile_change', 'off', true);
  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function private.handle_user_deleted();

create or replace function private.protect_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  -- Trusted internal changes (account deletion, email sync)
  if current_setting('app.system_profile_change', true) = 'on' then
    return new;
  end if;
  -- auth.uid() is null for the SQL editor / service role: allowed (first admin is set manually)
  if auth.uid() is not null and not public.is_admin() then
    new.role := old.role;
    new.is_anonymous := old.is_anonymous;
    new.failed_cod_count := old.failed_cod_count;
    new.deleted_at := old.deleted_at;
    new.email := old.email;
    new.created_at := old.created_at;
  end if;
  -- An admin cannot remove their own admin role (avoids locking everyone out)
  if auth.uid() = old.id and old.role = 'admin' and new.role <> 'admin' then
    raise exception 'You cannot remove your own admin role';
  end if;
  return new;
end;
$$;

create trigger profiles_protect
  before update on public.profiles
  for each row execute function private.protect_profile();

create or replace function private.single_default_address()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.is_default then
    update public.addresses set is_default = false
     where user_id = new.user_id and id <> new.id and is_default;
  elsif not exists (select 1 from public.addresses where user_id = new.user_id and id <> new.id) then
    new.is_default := true;
  end if;
  return new;
end;
$$;

create trigger addresses_single_default
  before insert or update of is_default on public.addresses
  for each row execute function private.single_default_address();

-- ---------------------------------------------------------------------------
-- Pricing: one function used everywhere (product pages, cart, place_order)
-- ---------------------------------------------------------------------------

-- Best live promotion for a variant (lowest price wins, no stacking)
create or replace function public.variant_pricing(p_variant_id uuid)
returns table (
  base_price       numeric,
  compare_at_price numeric,
  effective_price  numeric,
  discount_amount  numeric,
  promotion_id     uuid,
  promotion_slug   text,
  badge_text       text,
  promo_ends_at    timestamptz,
  show_countdown   boolean
)
language sql stable security definer set search_path = ''
as $$
  with v as (
    select pv.id, pv.price, pv.compare_at_price, pv.product_id, p.brand_id, p.category_id
      from public.product_variants pv
      join public.products p on p.id = pv.product_id
     where pv.id = p_variant_id
  ),
  candidates as (
    select pr.id, pr.slug, pr.badge_text, pr.ends_at, pr.show_countdown,
           greatest(0, round(case when pr.discount_type = 'percent'
                                  then v.price - v.price * pr.discount_value / 100
                                  else v.price - pr.discount_value end, 2)) as promo_price
      from v
      join public.promotions pr on public.is_live(pr.is_active, pr.starts_at, pr.ends_at)
     where exists (
             select 1 from public.promotion_targets t
              where t.promotion_id = pr.id and not t.is_exclusion
                and (t.target_type = 'all'
                  or (t.target_type = 'category' and t.target_id = v.category_id)
                  or (t.target_type = 'brand'    and t.target_id = v.brand_id)
                  or (t.target_type = 'product'  and t.target_id = v.product_id)
                  or (t.target_type = 'variant'  and t.target_id = v.id)))
       and not exists (
             select 1 from public.promotion_targets t
              where t.promotion_id = pr.id and t.is_exclusion
                and ((t.target_type = 'category' and t.target_id = v.category_id)
                  or (t.target_type = 'brand'    and t.target_id = v.brand_id)
                  or (t.target_type = 'product'  and t.target_id = v.product_id)
                  or (t.target_type = 'variant'  and t.target_id = v.id)))
  ),
  best as (
    select c.* from candidates c, v where c.promo_price < v.price
     order by c.promo_price, c.ends_at limit 1
  )
  select v.price,
         v.compare_at_price,
         coalesce(b.promo_price, v.price),
         coalesce(v.price - b.promo_price, 0),
         b.id, b.slug, b.badge_text, b.ends_at, coalesce(b.show_countdown, false)
    from v left join best b on true;
$$;

create or replace function public.effective_price(p_variant_id uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select effective_price from public.variant_pricing(p_variant_id);
$$;

-- Sum of the items' current (effective) prices, used for "You save"
create or replace function public.bundle_items_value(p_bundle_id uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select coalesce(sum(public.effective_price(bi.variant_id) * bi.quantity), 0)
    from public.bundle_items bi where bi.bundle_id = p_bundle_id;
$$;

-- Bundle price, lowered only by live promotions that have "Include bundles" ticked
create or replace function public.bundle_pricing(p_bundle_id uuid)
returns table (
  base_price       numeric,
  effective_price  numeric,
  discount_amount  numeric,
  promotion_id     uuid,
  badge_text       text,
  promo_ends_at    timestamptz,
  items_value      numeric
)
language sql stable security definer set search_path = ''
as $$
  with b as (select id, price, category_id from public.bundles where id = p_bundle_id),
  candidates as (
    select pr.id, pr.badge_text, pr.ends_at,
           greatest(0, round(case when pr.discount_type = 'percent'
                                  then b.price - b.price * pr.discount_value / 100
                                  else b.price - pr.discount_value end, 2)) as promo_price
      from b
      join public.promotions pr on pr.include_bundles and public.is_live(pr.is_active, pr.starts_at, pr.ends_at)
     where exists (select 1 from public.promotion_targets t
                    where t.promotion_id = pr.id and not t.is_exclusion
                      and (t.target_type = 'all' or (t.target_type = 'category' and t.target_id = b.category_id)))
       and not exists (select 1 from public.promotion_targets t
                        where t.promotion_id = pr.id and t.is_exclusion
                          and t.target_type = 'category' and t.target_id = b.category_id)
  ),
  best as (select c.* from candidates c, b where c.promo_price < b.price order by c.promo_price limit 1)
  select b.price,
         coalesce(best.promo_price, b.price),
         coalesce(b.price - best.promo_price, 0),
         best.id, best.badge_text, best.ends_at,
         public.bundle_items_value(b.id)
    from b left join best on true;
$$;

-- How many complete sets can be made from current stock (0 if any item is out or hidden)
create or replace function public.bundle_availability(p_bundle_id uuid)
returns int
language sql stable security definer set search_path = ''
as $$
  select case
           when count(*) = 0 then 0
           when bool_or(not pv.is_active or not p.is_active or p.deleted_at is not null) then 0
           else coalesce(min(pv.stock_qty / bi.quantity), 0)
         end::int
    from public.bundle_items bi
    join public.product_variants pv on pv.id = bi.variant_id
    join public.products p on p.id = pv.product_id
   where bi.bundle_id = p_bundle_id;
$$;

-- ---------------------------------------------------------------------------
-- Cart: set price when added, protect ordered items, log every change
-- ---------------------------------------------------------------------------
create or replace function private.cart_items_before()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    new.price_at_add := case when new.variant_id is not null
                             then public.effective_price(new.variant_id)
                             else (select effective_price from public.bundle_pricing(new.bundle_id)) end;
    return new;
  end if;
  -- UPDATE: customers may only change the quantity of active items
  if current_setting('app.system_cart_change', true) is distinct from 'on' then
    if old.state = 'ordered' then
      raise exception 'Ordered items cannot be changed';
    end if;
    if new.user_id <> old.user_id or new.state <> old.state
       or new.variant_id is distinct from old.variant_id or new.bundle_id is distinct from old.bundle_id
       or new.order_id is distinct from old.order_id then
      raise exception 'Only the quantity of a cart item can be changed';
    end if;
  end if;
  return new;
end;
$$;

create trigger cart_items_before_write
  before insert or update on public.cart_items
  for each row execute function private.cart_items_before();

create or replace function private.cart_items_before_delete()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if old.state = 'ordered' and current_setting('app.system_cart_change', true) is distinct from 'on' then
    raise exception 'Ordered items cannot be removed';
  end if;
  return old;
end;
$$;

create trigger cart_items_before_delete
  before delete on public.cart_items
  for each row execute function private.cart_items_before_delete();

create or replace function private.cart_price(p_variant_id uuid, p_bundle_id uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select case when p_variant_id is not null then public.effective_price(p_variant_id)
              else (select effective_price from public.bundle_pricing(p_bundle_id)) end;
$$;

create or replace function private.log_cart_event()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_action text;
  v_order_status text;
begin
  if current_setting('app.skip_cart_events', true) = 'on' then
    return null;
  end if;

  if tg_op = 'INSERT' then
    if new.state = 'active' then
      insert into public.cart_events (user_id, variant_id, bundle_id, action, quantity_before, quantity_after, price_at_time)
      values (new.user_id, new.variant_id, new.bundle_id, 'add', 0, new.quantity, private.cart_price(new.variant_id, new.bundle_id));
    end if;
    return null;
  end if;

  if tg_op = 'DELETE' then
    if old.state = 'ordered' then
      select status into v_order_status from public.orders where id = old.order_id;
      v_action := case when v_order_status in ('delivered', 'completed') then 'completed' else 'remove' end;
    else
      v_action := 'remove';
    end if;
    insert into public.cart_events (user_id, variant_id, bundle_id, action, quantity_before, quantity_after, price_at_time, order_id)
    values (old.user_id, old.variant_id, old.bundle_id, v_action, old.quantity, 0, private.cart_price(old.variant_id, old.bundle_id), old.order_id);
    return null;
  end if;

  -- UPDATE
  if old.state = 'active' and new.state = 'ordered' then
    v_action := 'checked_out';
  elsif old.state = 'ordered' and new.state = 'active' then
    v_action := 'released';
  elsif new.quantity <> old.quantity then
    v_action := 'update_qty';
  else
    return null;
  end if;
  insert into public.cart_events (user_id, variant_id, bundle_id, action, quantity_before, quantity_after, price_at_time, order_id)
  values (new.user_id, new.variant_id, new.bundle_id, v_action, old.quantity, new.quantity,
          private.cart_price(new.variant_id, new.bundle_id), coalesce(new.order_id, old.order_id));
  return null;
end;
$$;

create trigger cart_items_log
  after insert or update or delete on public.cart_items
  for each row execute function private.log_cart_event();

-- ---------------------------------------------------------------------------
-- Orders: allowed status changes are enforced here (04-checkout-orders-stock.md)
-- ---------------------------------------------------------------------------
create or replace function private.check_order_transition()
returns trigger
language plpgsql set search_path = ''
as $$
declare ok boolean;
begin
  if new.status = old.status then
    return new;
  end if;
  ok := case old.status
    when 'pending'    then new.status in ('processing', 'cancelled')
    when 'on_hold'    then new.status in ('processing', 'cancelled')
    when 'processing' then new.status in ('shipped', 'cancelled')
    when 'shipped'    then new.status in ('delivered', 'returned')
    when 'returned'   then new.status in ('cancelled')
    when 'delivered'  then new.status in ('completed')
    else false
  end;
  if not ok then
    raise exception 'Order status cannot change from % to %', old.status, new.status;
  end if;
  if old.status = 'on_hold' and new.status = 'processing' and new.payment_status <> 'paid' then
    raise exception 'A bank transfer order can only move to processing once it is paid';
  end if;
  if new.status = 'processing' and new.stock_reduced_at is null then
    raise exception 'Stock must be reduced before an order moves to processing (use confirm_order)';
  end if;
  if old.status = 'delivered' and new.status = 'completed' and new.payment_status <> 'paid' then
    raise exception 'An order can only be completed once it is paid';
  end if;
  return new;
end;
$$;

create trigger orders_check_transition
  before update of status on public.orders
  for each row execute function private.check_order_transition();

create or replace function private.next_order_number()
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  y int := extract(year from now() at time zone 'Asia/Colombo')::int;
  n int;
begin
  insert into private.order_counters (year, last) values (y, 1)
  on conflict (year) do update set last = private.order_counters.last + 1
  returning last into n;
  return 'FS-' || y || '-' || lpad(n::text, 5, '0');
end;
$$;

-- Keep live pages in sync: product slug rename → 301 redirect row
create or replace function private.product_slug_redirect()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.slug <> old.slug then
    delete from public.product_slug_redirects where old_slug = new.slug;
    insert into public.product_slug_redirects (old_slug, product_id) values (old.slug, new.id)
    on conflict (old_slug) do update set product_id = excluded.product_id;
  end if;
  return new;
end;
$$;

create trigger products_slug_redirect
  after update of slug on public.products
  for each row execute function private.product_slug_redirect();

-- Promotions: lowest normal price among the variants a promotion targets.
-- The admin save action blocks fixed discounts larger than this.
create or replace function public.promotion_min_target_price(p_promotion_id uuid)
returns numeric
language sql stable security definer set search_path = ''
as $$
  select min(pv.price)
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
   where pv.is_active and p.deleted_at is null
     and exists (select 1 from public.promotion_targets t
                  where t.promotion_id = p_promotion_id and not t.is_exclusion
                    and (t.target_type = 'all'
                      or (t.target_type = 'category' and t.target_id = p.category_id)
                      or (t.target_type = 'brand'    and t.target_id = p.brand_id)
                      or (t.target_type = 'product'  and t.target_id = p.id)
                      or (t.target_type = 'variant'  and t.target_id = pv.id)))
     and not exists (select 1 from public.promotion_targets t
                  where t.promotion_id = p_promotion_id and t.is_exclusion
                    and ((t.target_type = 'category' and t.target_id = p.category_id)
                      or (t.target_type = 'brand'    and t.target_id = p.brand_id)
                      or (t.target_type = 'product'  and t.target_id = p.id)
                      or (t.target_type = 'variant'  and t.target_id = pv.id)));
$$;

-- Bundles: block a bundle price higher than buying the items separately
create or replace function public.check_bundle_price(p_bundle_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_price numeric;
  v_items numeric;
begin
  select price into v_price from public.bundles where id = p_bundle_id;
  select coalesce(sum(pv.price * bi.quantity), 0) into v_items
    from public.bundle_items bi join public.product_variants pv on pv.id = bi.variant_id
   where bi.bundle_id = p_bundle_id;
  return jsonb_build_object(
    'price', v_price,
    'items_value', v_items,
    'saving', v_items - v_price,
    'ok', v_items = 0 or v_price <= v_items,
    'low_saving', v_items > 0 and (v_items - v_price) < v_items * 0.05
  );
end;
$$;
