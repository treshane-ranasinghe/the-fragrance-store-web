-- Server-side functions (RPC). All money, stock and status rules live here.

-- ---------------------------------------------------------------------------
-- Internal helpers
-- ---------------------------------------------------------------------------
create or replace function private.log_status(p_order_id uuid, p_from text, p_to text, p_note text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.order_status_history (order_id, from_status, to_status, changed_by, note)
  values (p_order_id, p_from, p_to, auth.uid(), p_note);
$$;

create or replace function private.alert_admin(p_type text, p_order_id uuid, p_message text)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.admin_alerts (type, order_id, message) values (p_type, p_order_id, p_message);
$$;

create or replace function private.queue_email(p_template text, p_order_id uuid, p_payload jsonb default '{}')
returns void
language sql security definer set search_path = ''
as $$
  insert into public.email_outbox (template, order_id, to_email, payload)
  select p_template, o.id, pr.email, coalesce(p_payload, '{}')
    from public.orders o left join public.profiles pr on pr.id = o.user_id
   where o.id = p_order_id;
$$;

-- Stock each order needs, per variant (loose items + bundle item lines)
create or replace function private.order_stock_needs(p_order_id uuid)
returns table (variant_id uuid, qty int)
language sql stable security definer set search_path = ''
as $$
  select oi.variant_id, sum(oi.quantity)::int
    from public.order_items oi
   where oi.order_id = p_order_id and oi.variant_id is not null
   group by oi.variant_id;
$$;

-- Put an order's items back into the customer's active cart (after a cancel).
-- Items now out of stock or hidden are removed; same product already in the cart → merged.
create or replace function private.release_order_items(p_order_id uuid)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  v_existing uuid;
  v_ok boolean;
  v_removed int := 0;
begin
  perform set_config('app.system_cart_change', 'on', true);
  for r in select * from public.cart_items where order_id = p_order_id and state = 'ordered' loop
    if r.variant_id is not null then
      select pv.is_active and p.is_active and p.deleted_at is null and pv.stock_qty > 0 into v_ok
        from public.product_variants pv join public.products p on p.id = pv.product_id
       where pv.id = r.variant_id;
      select id into v_existing from public.cart_items
       where user_id = r.user_id and variant_id = r.variant_id and state = 'active';
    else
      select public.is_live(b.is_active, b.starts_at, b.ends_at) and public.bundle_availability(b.id) > 0 into v_ok
        from public.bundles b where b.id = r.bundle_id;
      select id into v_existing from public.cart_items
       where user_id = r.user_id and bundle_id = r.bundle_id and state = 'active';
    end if;

    if not coalesce(v_ok, false) then
      delete from public.cart_items where id = r.id;
      v_removed := v_removed + 1;
    elsif v_existing is not null then
      update public.cart_items set quantity = quantity + r.quantity where id = v_existing;
      delete from public.cart_items where id = r.id;
    else
      update public.cart_items set state = 'active', order_id = null where id = r.id;
    end if;
  end loop;
  perform set_config('app.system_cart_change', 'off', true);
  return v_removed;
end;
$$;

-- Remove an order's ordered items from the cart (delivered / returned)
create or replace function private.remove_order_items(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('app.system_cart_change', 'on', true);
  delete from public.cart_items where order_id = p_order_id and state = 'ordered';
  perform set_config('app.system_cart_change', 'off', true);
end;
$$;

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------
create or replace function public.add_to_cart(p_variant_id uuid default null, p_bundle_id uuid default null, p_quantity int default 1)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_stock int;
  v_ok boolean;
  v_max int;
  v_current int;
  v_new int;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Please start a session first';
  end if;
  if num_nonnulls(p_variant_id, p_bundle_id) <> 1 or p_quantity is null or p_quantity < 1 then
    raise exception 'Invalid cart item';
  end if;
  -- Profile row may lag behind a brand-new anonymous session
  insert into public.profiles (id, is_anonymous) values (v_uid, coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false))
  on conflict (id) do nothing;

  if p_variant_id is not null then
    select pv.stock_qty, pv.is_active and p.is_active and p.deleted_at is null, p.name || ' ' || pv.size_ml || 'ml'
      into v_stock, v_ok, v_name
      from public.product_variants pv join public.products p on p.id = pv.product_id
     where pv.id = p_variant_id;
    select quantity into v_current from public.cart_items
     where user_id = v_uid and variant_id = p_variant_id and state = 'active';
  else
    select public.is_live(b.is_active, b.starts_at, b.ends_at), public.bundle_availability(b.id), b.max_per_order, b.name
      into v_ok, v_stock, v_max, v_name
      from public.bundles b where b.id = p_bundle_id;
    select quantity into v_current from public.cart_items
     where user_id = v_uid and bundle_id = p_bundle_id and state = 'active';
  end if;

  if not coalesce(v_ok, false) then
    raise exception 'This item is no longer available';
  end if;
  v_new := coalesce(v_current, 0) + p_quantity;
  if v_max is not null and v_new > v_max then
    raise exception 'You can buy up to % of %', v_max, v_name;
  end if;
  if v_stock < v_new then
    if v_stock <= 0 then
      raise exception '% is out of stock', v_name;
    end if;
    raise exception 'Only % left of %', v_stock, v_name;
  end if;

  if v_current is null then
    insert into public.cart_items (user_id, variant_id, bundle_id, quantity)
    values (v_uid, p_variant_id, p_bundle_id, p_quantity);
  elsif p_variant_id is not null then
    update public.cart_items set quantity = v_new where user_id = v_uid and variant_id = p_variant_id and state = 'active';
  else
    update public.cart_items set quantity = v_new where user_id = v_uid and bundle_id = p_bundle_id and state = 'active';
  end if;
  return jsonb_build_object('quantity', v_new, 'name', v_name);
end;
$$;

create or replace function public.set_cart_quantity(p_item_id uuid, p_quantity int)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  r public.cart_items;
  v_stock int;
  v_max int;
begin
  select * into r from public.cart_items where id = p_item_id and user_id = auth.uid() and state = 'active';
  if not found then
    raise exception 'Cart item not found';
  end if;
  if p_quantity <= 0 then
    delete from public.cart_items where id = r.id;
    return;
  end if;
  if r.variant_id is not null then
    select stock_qty into v_stock from public.product_variants where id = r.variant_id;
  else
    select public.bundle_availability(id), max_per_order into v_stock, v_max from public.bundles where id = r.bundle_id;
  end if;
  if v_max is not null and p_quantity > v_max then
    raise exception 'You can buy up to % of this set', v_max;
  end if;
  if p_quantity > v_stock then
    raise exception 'Only % left', v_stock;
  end if;
  update public.cart_items set quantity = p_quantity where id = r.id;
end;
$$;

-- Customer has seen the "price changed" notice: store today's prices
create or replace function public.acknowledge_cart_prices()
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  update public.cart_items
     set price_at_add = private.cart_price(variant_id, bundle_id)
   where user_id = auth.uid() and state = 'active';
end;
$$;

-- Everything the cart page needs in one call
create or replace function public.get_cart()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_active jsonb;
  v_ordered jsonb;
begin
  if v_uid is null then
    return jsonb_build_object('items', '[]'::jsonb, 'orders', '[]'::jsonb, 'subtotal', 0, 'count', 0);
  end if;

  select coalesce(jsonb_agg(line order by line ->> 'added_at'), '[]'::jsonb) into v_active
    from (
      select jsonb_build_object(
               'id', ci.id,
               'kind', 'variant',
               'variant_id', ci.variant_id,
               'quantity', ci.quantity,
               'added_at', ci.added_at,
               'price_at_add', ci.price_at_add,
               'name', p.name,
               'slug', p.slug,
               'brand', b.name,
               'size_ml', pv.size_ml,
               'image_path', (select storage_path from public.product_images i where i.product_id = p.id order by sort_order limit 1),
               'unit_price', vp.effective_price,
               'base_price', vp.base_price,
               'badge_text', vp.badge_text,
               'stock', pv.stock_qty,
               'available', pv.is_active and p.is_active and p.deleted_at is null and pv.stock_qty > 0,
               'items', '[]'::jsonb
             ) as line
        from public.cart_items ci
        join public.product_variants pv on pv.id = ci.variant_id
        join public.products p on p.id = pv.product_id
        left join public.brands b on b.id = p.brand_id
        cross join lateral public.variant_pricing(pv.id) vp
       where ci.user_id = v_uid and ci.state = 'active'
      union all
      select jsonb_build_object(
               'id', ci.id,
               'kind', 'bundle',
               'bundle_id', ci.bundle_id,
               'quantity', ci.quantity,
               'added_at', ci.added_at,
               'price_at_add', ci.price_at_add,
               'name', bu.name,
               'slug', bu.slug,
               'brand', 'Bundle',
               'size_ml', null,
               'image_path', coalesce(
                  (select storage_path from public.bundle_images i where i.bundle_id = bu.id order by sort_order limit 1),
                  (select pi.storage_path from public.bundle_items bi join public.product_variants v2 on v2.id = bi.variant_id
                     join public.product_images pi on pi.product_id = v2.product_id where bi.bundle_id = bu.id
                    order by pi.sort_order limit 1)),
               'unit_price', bp.effective_price,
               'base_price', bp.base_price,
               'badge_text', bp.badge_text,
               'stock', public.bundle_availability(bu.id),
               'max_per_order', bu.max_per_order,
               'available', public.is_live(bu.is_active, bu.starts_at, bu.ends_at) and public.bundle_availability(bu.id) > 0,
               'items', (select coalesce(jsonb_agg(jsonb_build_object('name', p2.name, 'size_ml', v2.size_ml, 'quantity', bi.quantity)), '[]'::jsonb)
                           from public.bundle_items bi join public.product_variants v2 on v2.id = bi.variant_id
                           join public.products p2 on p2.id = v2.product_id where bi.bundle_id = bu.id)
             )
        from public.cart_items ci
        join public.bundles bu on bu.id = ci.bundle_id
        cross join lateral public.bundle_pricing(bu.id) bp
       where ci.user_id = v_uid and ci.state = 'active'
    ) lines;

  select coalesce(jsonb_agg(jsonb_build_object(
           'order_id', o.id,
           'order_number', o.order_number,
           'status', o.status,
           'payment_status', o.payment_status,
           'payment_method', o.payment_method,
           'total', o.total,
           'amount_received', o.amount_received,
           'payment_due_at', o.payment_due_at,
           'tracking_number', o.tracking_number,
           'courier_name', o.courier_name,
           'created_at', o.created_at,
           'items', (select jsonb_agg(jsonb_build_object('name', oi.product_name, 'size_ml', oi.size_ml, 'quantity', oi.quantity, 'is_bundle', oi.bundle_id is not null))
                       from public.order_items oi where oi.order_id = o.id and oi.parent_item_id is null)
         ) order by o.created_at desc), '[]'::jsonb) into v_ordered
    from public.orders o
   where o.user_id = v_uid
     and exists (select 1 from public.cart_items ci where ci.order_id = o.id and ci.state = 'ordered');

  return jsonb_build_object(
    'items', v_active,
    'orders', v_ordered,
    'subtotal', (select coalesce(sum((l ->> 'unit_price')::numeric * (l ->> 'quantity')::int), 0) from jsonb_array_elements(v_active) l),
    'count', (select coalesce(sum((l ->> 'quantity')::int), 0) from jsonb_array_elements(v_active) l)
  );
end;
$$;

-- Guest cart → account. Step 1 (as the guest): get a one-time token.
create or replace function public.create_cart_transfer_token()
returns text
language plpgsql security definer set search_path = ''
as $$
declare v_token text;
begin
  if auth.uid() is null or not exists (select 1 from public.profiles where id = auth.uid() and is_anonymous) then
    return null;
  end if;
  if not exists (select 1 from public.cart_items where user_id = auth.uid()) then
    return null;
  end if;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  insert into private.cart_merge_tokens (token, guest_user_id) values (v_token, auth.uid());
  return v_token;
end;
$$;

-- Step 2 (as the logged-in customer): move the guest cart and its history
create or replace function public.merge_guest_cart(p_token text)
returns int
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_guest uuid;
  r record;
  v_existing uuid;
  v_moved int := 0;
begin
  if v_uid is null then
    raise exception 'Not logged in';
  end if;
  delete from private.cart_merge_tokens
   where token = p_token and created_at > now() - interval '7 days'
  returning guest_user_id into v_guest;
  if v_guest is null or v_guest = v_uid then
    return 0;
  end if;

  perform set_config('app.skip_cart_events', 'on', true);
  perform set_config('app.system_cart_change', 'on', true);
  for r in select * from public.cart_items where user_id = v_guest and state = 'active' loop
    select id into v_existing from public.cart_items
     where user_id = v_uid and state = 'active'
       and variant_id is not distinct from r.variant_id and bundle_id is not distinct from r.bundle_id;
    if v_existing is not null then
      update public.cart_items set quantity = quantity + r.quantity where id = v_existing;
      delete from public.cart_items where id = r.id;
    else
      update public.cart_items set user_id = v_uid where id = r.id;
    end if;
    v_moved := v_moved + 1;
  end loop;
  -- Cart history follows the customer so the monitor shows who it really was
  update public.cart_events set user_id = v_uid where user_id = v_guest;
  perform set_config('app.skip_cart_events', 'off', true);
  perform set_config('app.system_cart_change', 'off', true);
  return v_moved;
end;
$$;

-- ---------------------------------------------------------------------------
-- Checkout
-- ---------------------------------------------------------------------------

-- Which payment methods can be used for this cart + delivery method (shown at checkout)
create or replace function public.checkout_options(p_delivery_method_id uuid)
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  s public.store_settings;
  m public.delivery_methods;
  v_subtotal numeric;
  v_delivery numeric;
  v_total numeric;
  v_cod_ok boolean;
  v_cod_reason text;
  v_failed int;
begin
  select * into s from public.store_settings where id = 1;
  select * into m from public.delivery_methods where id = p_delivery_method_id and is_active;
  v_subtotal := (public.get_cart() ->> 'subtotal')::numeric;
  v_delivery := case when m.id is null then 0
                     when m.free_over is not null and v_subtotal >= m.free_over then 0
                     else m.fee end;
  v_total := v_subtotal + v_delivery + s.cod_fee;
  select failed_cod_count into v_failed from public.profiles where id = auth.uid();

  v_cod_ok := s.cod_enabled;
  if not s.cod_enabled then
    v_cod_reason := 'Cash on Delivery is not available right now.';
  elsif m.id is not null and not m.cod_allowed then
    v_cod_ok := false;
    v_cod_reason := 'Cash on Delivery isn''t available for ' || m.name || '.';
  elsif s.cod_max_order_value is not null and v_total > s.cod_max_order_value then
    v_cod_ok := false;
    v_cod_reason := 'Cash on Delivery is available for orders up to Rs. ' || to_char(s.cod_max_order_value, 'FM999,999,990.00') || '.';
  elsif s.cod_max_failed is not null and coalesce(v_failed, 0) >= s.cod_max_failed then
    v_cod_ok := false;
    v_cod_reason := 'Cash on Delivery isn''t available on this account. Please pay by bank transfer.';
  end if;

  return jsonb_build_object(
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery,
    'cod_fee', s.cod_fee,
    'bank', jsonb_build_object('enabled', s.bacs_enabled, 'title', s.bacs_title, 'description', s.bacs_description),
    'cod', jsonb_build_object('enabled', v_cod_ok, 'title', s.cod_title, 'description', s.cod_description, 'reason', v_cod_reason)
  );
end;
$$;

create or replace function public.place_order(
  p_checkout_token     text,
  p_address            jsonb,
  p_delivery_method_id uuid,
  p_payment_method     text,
  p_note               text default null,
  p_expected_total     numeric default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  s public.store_settings;
  m public.delivery_methods;
  v_existing public.orders;
  v_order public.orders;
  r record;
  v_subtotal numeric := 0;
  v_delivery numeric;
  v_cod_fee numeric := 0;
  v_total numeric;
  v_status text;
  v_main_id uuid;
  v_count int;
begin
  if v_uid is null then
    raise exception 'Please log in to place your order';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is null or v_profile.is_anonymous or v_profile.deleted_at is not null then
    raise exception 'Please log in or create an account to place your order';
  end if;

  -- 1. Stop double orders
  if p_checkout_token is null or length(p_checkout_token) < 8 then
    raise exception 'Invalid checkout session, please refresh the page';
  end if;
  select * into v_existing from public.orders where checkout_token = p_checkout_token;
  if v_existing.id is not null then
    if v_existing.user_id <> v_uid then
      raise exception 'Invalid checkout session, please refresh the page';
    end if;
    return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number, 'duplicate', true);
  end if;

  -- Serialise checkouts for this customer (double-click with different tokens)
  perform 1 from public.profiles where id = v_uid for update;

  -- Address
  if coalesce(trim(p_address ->> 'full_name'), '') = '' or coalesce(trim(p_address ->> 'line1'), '') = ''
     or coalesce(trim(p_address ->> 'city'), '') = '' or coalesce(trim(p_address ->> 'district'), '') = '' then
    raise exception 'Please complete your delivery address';
  end if;
  if coalesce(regexp_replace(p_address ->> 'phone', '\s', '', 'g'), '') !~ '^(07[0-9]{8}|\+947[0-9]{8})$' then
    raise exception 'Please enter a valid Sri Lankan mobile number (07XXXXXXXX)';
  end if;

  select * into s from public.store_settings where id = 1;
  select * into m from public.delivery_methods where id = p_delivery_method_id and is_active;
  if m.id is null then
    raise exception 'Please choose a delivery method';
  end if;
  if p_payment_method not in ('bank_transfer', 'cod') then
    raise exception 'Please choose a payment method';
  end if;

  -- 2. Check the cart
  select count(*) into v_count from public.cart_items where user_id = v_uid and state = 'active';
  if v_count = 0 then
    raise exception 'Your cart is empty';
  end if;

  for r in
    select ci.*, p.name, p.is_active and p.deleted_at is null and pv.is_active as ok
      from public.cart_items ci
      join public.product_variants pv on pv.id = ci.variant_id
      join public.products p on p.id = pv.product_id
     where ci.user_id = v_uid and ci.state = 'active'
  loop
    if not r.ok then
      raise exception '% is no longer available. Please remove it from your cart.', r.name;
    end if;
  end loop;
  for r in
    select ci.*, b.name, b.max_per_order, public.is_live(b.is_active, b.starts_at, b.ends_at) as ok
      from public.cart_items ci join public.bundles b on b.id = ci.bundle_id
     where ci.user_id = v_uid and ci.state = 'active'
  loop
    if not r.ok then
      raise exception '% is no longer available. Please remove it from your cart.', r.name;
    end if;
    if r.max_per_order is not null and r.quantity > r.max_per_order then
      raise exception 'You can buy up to % of %', r.max_per_order, r.name;
    end if;
  end loop;

  -- 3. Check stock (no reduction). Bundles expand into their items, combined with loose items.
  for r in
    with needs as (
      select ci.variant_id, ci.quantity as qty from public.cart_items ci
       where ci.user_id = v_uid and ci.state = 'active' and ci.variant_id is not null
      union all
      select bi.variant_id, ci.quantity * bi.quantity from public.cart_items ci
        join public.bundle_items bi on bi.bundle_id = ci.bundle_id
       where ci.user_id = v_uid and ci.state = 'active' and ci.bundle_id is not null
    )
    select n.variant_id, sum(n.qty) as qty, pv.stock_qty, pv.is_active and p.is_active and p.deleted_at is null as ok,
           p.name || ' ' || pv.size_ml || 'ml' as label
      from needs n
      join public.product_variants pv on pv.id = n.variant_id
      join public.products p on p.id = pv.product_id
     group by n.variant_id, pv.stock_qty, pv.is_active, p.is_active, p.deleted_at, p.name, pv.size_ml
  loop
    if not r.ok then
      raise exception '% is no longer available', r.label;
    end if;
    if r.stock_qty < r.qty then
      if r.stock_qty = 0 then
        raise exception '% is out of stock', r.label;
      end if;
      raise exception 'Only % left of %', r.stock_qty, r.label;
    end if;
  end loop;

  -- 4. Recalculate prices from the database
  select coalesce(sum(private.cart_price(variant_id, bundle_id) * quantity), 0) into v_subtotal
    from public.cart_items where user_id = v_uid and state = 'active';
  v_delivery := case when m.free_over is not null and v_subtotal >= m.free_over then 0 else m.fee end;

  -- 5. Payment method allowed?
  if p_payment_method = 'bank_transfer' then
    if not s.bacs_enabled then
      raise exception 'Bank transfer is not available right now';
    end if;
  else
    v_cod_fee := s.cod_fee;
    if not s.cod_enabled then
      raise exception 'Cash on Delivery is not available right now';
    end if;
    if not m.cod_allowed then
      raise exception 'Cash on Delivery isn''t available for %', m.name;
    end if;
    if s.cod_max_order_value is not null and (v_subtotal + v_delivery + v_cod_fee) > s.cod_max_order_value then
      raise exception 'Cash on Delivery is only available for orders up to Rs. %', to_char(s.cod_max_order_value, 'FM999,999,990.00');
    end if;
    if s.cod_max_failed is not null and v_profile.failed_cod_count >= s.cod_max_failed then
      raise exception 'Cash on Delivery isn''t available on this account. Please pay by bank transfer.';
    end if;
  end if;

  v_total := v_subtotal + v_delivery + v_cod_fee;

  -- Prices changed since the customer looked (e.g. a promotion ended)?
  if p_expected_total is not null and abs(p_expected_total - v_total) >= 0.01 then
    raise exception 'PRICE_CHANGED: Prices in your cart have been updated. The new total is Rs. %. Please review your order.',
      to_char(v_total, 'FM999,999,990.00');
  end if;

  -- 6. Create the order
  v_status := case when p_payment_method = 'bank_transfer' then 'on_hold' else 'pending' end;
  insert into public.orders (
    order_number, user_id, checkout_token, status, payment_method, payment_status,
    subtotal, delivery_fee, cod_fee, discount, total,
    delivery_method_id, delivery_method_name,
    shipping_name, shipping_phone, shipping_line1, shipping_line2, shipping_city, shipping_district, shipping_postal_code,
    customer_note, payment_due_at
  ) values (
    private.next_order_number(), v_uid, p_checkout_token, v_status, p_payment_method, 'unpaid',
    v_subtotal, v_delivery, v_cod_fee, 0, v_total,
    m.id, m.name,
    trim(p_address ->> 'full_name'), regexp_replace(p_address ->> 'phone', '\s', '', 'g'),
    trim(p_address ->> 'line1'), nullif(trim(p_address ->> 'line2'), ''), trim(p_address ->> 'city'),
    trim(p_address ->> 'district'), nullif(trim(p_address ->> 'postal_code'), ''),
    nullif(trim(p_note), ''),
    -- 10. Bank payment deadline
    case when p_payment_method = 'bank_transfer' then now() + make_interval(hours => s.bank_payment_hours) end
  ) returning * into v_order;

  -- 7. Snapshot each item
  for r in
    select ci.quantity, pv.id as variant_id, p.id as product_id, p.name, b.name as brand, pv.size_ml, pv.sku,
           (select storage_path from public.product_images i where i.product_id = p.id order by sort_order limit 1) as image_path,
           vp.base_price, vp.discount_amount, vp.promotion_id, vp.effective_price
      from public.cart_items ci
      join public.product_variants pv on pv.id = ci.variant_id
      join public.products p on p.id = pv.product_id
      left join public.brands b on b.id = p.brand_id
      cross join lateral public.variant_pricing(pv.id) vp
     where ci.user_id = v_uid and ci.state = 'active'
  loop
    insert into public.order_items (order_id, variant_id, product_id, product_name, brand_name, size_ml, sku, image_path,
                                    original_unit_price, discount_amount, promotion_id, unit_price, quantity, line_total)
    values (v_order.id, r.variant_id, r.product_id, r.name, r.brand, r.size_ml, r.sku, r.image_path,
            r.base_price, r.discount_amount, r.promotion_id, r.effective_price, r.quantity, r.effective_price * r.quantity);
  end loop;

  for r in
    select ci.quantity, bu.id as bundle_id, bu.name, bp.base_price, bp.discount_amount, bp.promotion_id, bp.effective_price,
           (select storage_path from public.bundle_images i where i.bundle_id = bu.id order by sort_order limit 1) as image_path
      from public.cart_items ci
      join public.bundles bu on bu.id = ci.bundle_id
      cross join lateral public.bundle_pricing(bu.id) bp
     where ci.user_id = v_uid and ci.state = 'active'
  loop
    insert into public.order_items (order_id, bundle_id, product_name, brand_name, image_path, original_unit_price,
                                    discount_amount, promotion_id, unit_price, quantity, line_total)
    values (v_order.id, r.bundle_id, r.name, 'Bundle', r.image_path, r.base_price, r.discount_amount, r.promotion_id,
            r.effective_price, r.quantity, r.effective_price * r.quantity)
    returning id into v_main_id;

    -- Item lines (for packing and stock; no separate price)
    insert into public.order_items (order_id, variant_id, bundle_id, parent_item_id, product_id, product_name, brand_name,
                                    size_ml, sku, image_path, quantity)
    select v_order.id, pv.id, r.bundle_id, v_main_id, p.id, p.name, b.name, pv.size_ml, pv.sku,
           (select storage_path from public.product_images i where i.product_id = p.id order by sort_order limit 1),
           bi.quantity * r.quantity
      from public.bundle_items bi
      join public.product_variants pv on pv.id = bi.variant_id
      join public.products p on p.id = pv.product_id
      left join public.brands b on b.id = p.brand_id
     where bi.bundle_id = r.bundle_id;
  end loop;

  -- 8. Stock is NOT reduced here (see confirm_order)
  -- 9. Lock the cart items to the order
  perform set_config('app.system_cart_change', 'on', true);
  update public.cart_items set state = 'ordered', order_id = v_order.id
   where user_id = v_uid and state = 'active';
  perform set_config('app.system_cart_change', 'off', true);

  perform private.log_status(v_order.id, null, v_status, 'Order placed');

  -- Keep the profile's name / phone filled for next time
  update public.profiles
     set full_name = coalesce(nullif(full_name, ''), trim(p_address ->> 'full_name')),
         phone = coalesce(nullif(phone, ''), regexp_replace(p_address ->> 'phone', '\s', '', 'g'))
   where id = v_uid;

  if p_payment_method = 'bank_transfer' then
    perform private.alert_admin('new_order', v_order.id, 'New bank transfer order ' || v_order.order_number || ' (Rs. ' || to_char(v_total, 'FM999,999,990.00') || ')');
    perform private.queue_email('order_on_hold', v_order.id);
  else
    perform private.alert_admin('new_cod_order', v_order.id, 'COD order to confirm: ' || v_order.order_number || ' (Rs. ' || to_char(v_total, 'FM999,999,990.00') || ')');
    perform private.queue_email('order_received_cod', v_order.id);
  end if;

  -- 11. Return the order number
  return jsonb_build_object('order_id', v_order.id, 'order_number', v_order.order_number, 'duplicate', false);
exception
  when unique_violation then
    -- Same checkout token arrived twice at the same moment
    select * into v_existing from public.orders where checkout_token = p_checkout_token and user_id = v_uid;
    if v_existing.id is not null then
      return jsonb_build_object('order_id', v_existing.id, 'order_number', v_existing.order_number, 'duplicate', true);
    end if;
    raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer actions on an order
-- ---------------------------------------------------------------------------
create or replace function public.notify_payment(p_order_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  select * into o from public.orders where id = p_order_id and user_id = auth.uid() for update;
  if o.id is null then
    raise exception 'Order not found';
  end if;
  if o.payment_method <> 'bank_transfer' or o.status <> 'on_hold' or o.payment_status not in ('unpaid', 'partially_paid') then
    raise exception 'This order is not waiting for a bank transfer';
  end if;
  update public.orders
     set payment_status = case when payment_status = 'unpaid' then 'payment_notified' else payment_status end,
         payment_notified_at = now(),
         payment_customer_note = nullif(trim(p_note), '')
   where id = o.id;
  perform private.alert_admin('payment_notified', o.id, 'Customer says they have paid for ' || o.order_number || ' — please check the bank account');
end;
$$;

-- ---------------------------------------------------------------------------
-- Confirm (stock is reduced here) — admin only
-- ---------------------------------------------------------------------------

-- Returns null on success, otherwise the reason it could not confirm (no exception,
-- so record_bank_payment can keep the payment and flag the order instead)
create or replace function private.try_confirm_order(p_order_id uuid)
returns text
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
  r record;
  v_short text := '';
begin
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    return 'Order not found';
  end if;
  if o.status not in ('pending', 'on_hold') then
    return 'Only pending or on-hold orders can be confirmed';
  end if;
  if o.status = 'on_hold' and o.payment_status <> 'paid' then
    return 'The full payment has not been recorded yet';
  end if;

  -- Lock the variant rows so two admins can't confirm the last bottle twice
  for r in
    select n.variant_id, n.qty, pv.stock_qty, p.name || ' ' || pv.size_ml || 'ml' as label
      from private.order_stock_needs(o.id) n
      join public.product_variants pv on pv.id = n.variant_id
      join public.products p on p.id = pv.product_id
     order by n.variant_id
       for update of pv
  loop
    if r.stock_qty < r.qty then
      v_short := v_short || case when v_short = '' then '' else ', ' end || r.label || ' (need ' || r.qty || ', have ' || r.stock_qty || ')';
    end if;
  end loop;
  if v_short <> '' then
    return 'Not enough stock: ' || v_short;
  end if;

  update public.product_variants pv set stock_qty = pv.stock_qty - n.qty
    from private.order_stock_needs(o.id) n where pv.id = n.variant_id;

  update public.orders
     set stock_reduced_at = now(), stock_issue = false, status = 'processing',
         cod_confirmed_at = case when payment_method = 'cod' then now() else cod_confirmed_at end
   where id = o.id;
  perform private.log_status(o.id, o.status, 'processing',
    case when o.payment_method = 'cod' then 'Order confirmed' else 'Payment received' end);
  perform private.queue_email(case when o.payment_method = 'cod' then 'order_confirmed' else 'order_processing' end, o.id);
  return null;
end;
$$;

create or replace function public.confirm_order(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_err text;
begin
  perform private.require_admin();
  v_err := private.try_confirm_order(p_order_id);
  if v_err is not null then
    raise exception '%', v_err;
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Cancel
-- ---------------------------------------------------------------------------
create or replace function private.do_cancel_order(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
  v_removed int;
begin
  select * into o from public.orders where id = p_order_id for update;
  -- Return stock only if it was reduced
  if o.stock_reduced_at is not null and o.restocked_at is null then
    update public.product_variants pv set stock_qty = pv.stock_qty + n.qty
      from private.order_stock_needs(o.id) n where pv.id = n.variant_id;
    update public.orders set restocked_at = now() where id = o.id;
  end if;
  update public.orders
     set status = 'cancelled', cancelled_at = now(), is_overdue = false,
         payment_status = case when amount_received > 0 then 'refund_pending'
                               when payment_status = 'payment_notified' then 'unpaid'
                               else payment_status end
   where id = o.id;
  perform private.log_status(o.id, o.status, 'cancelled', p_reason);
  v_removed := private.release_order_items(o.id);
  perform private.queue_email('order_cancelled', o.id, jsonb_build_object('reason', p_reason));
  return jsonb_build_object('released', true, 'removed_items', v_removed, 'refund_pending', o.amount_received > 0);
end;
$$;

create or replace function public.cancel_order(p_order_id uuid, p_reason text)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Please give a reason for cancelling';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null then
    raise exception 'Order not found';
  end if;

  if public.is_admin() then
    if o.status not in ('pending', 'on_hold', 'processing') then
      raise exception 'Orders that have been shipped cannot be cancelled. Mark the delivery as failed instead.';
    end if;
  else
    if o.user_id is distinct from auth.uid() then
      raise exception 'Order not found';
    end if;
    if not ((o.payment_method = 'bank_transfer' and o.status = 'on_hold')
         or (o.payment_method = 'cod' and o.status = 'pending')) then
      raise exception 'This order can no longer be cancelled online. Please contact us.';
    end if;
  end if;
  return private.do_cancel_order(o.id, trim(p_reason));
end;
$$;

-- ---------------------------------------------------------------------------
-- Bank transfer (05-bank-transfer.md)
-- ---------------------------------------------------------------------------
create or replace function public.record_bank_payment(
  p_order_id uuid, p_amount numeric, p_received_on date, p_bank_reference text, p_note text default null
)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
  v_received numeric;
  v_err text;
begin
  perform private.require_admin();
  if p_amount is null or p_amount <= 0 then
    raise exception 'Enter the amount received';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.payment_method <> 'bank_transfer' then
    raise exception 'Bank transfer order not found';
  end if;
  if o.status <> 'on_hold' or o.payment_status not in ('unpaid', 'payment_notified', 'partially_paid') then
    raise exception 'This order is not waiting for a payment';
  end if;

  insert into public.order_payments (order_id, amount, method, bank_reference, received_on, note, recorded_by)
  values (o.id, p_amount, 'bank_transfer', nullif(trim(p_bank_reference), ''), coalesce(p_received_on, current_date), nullif(trim(p_note), ''), auth.uid());
  v_received := o.amount_received + p_amount;

  if v_received >= o.total then
    update public.orders
       set amount_received = v_received, payment_status = 'paid', paid_at = now(), is_overdue = false,
           overpaid_amount = v_received - o.total
     where id = o.id;
    v_err := private.try_confirm_order(o.id);
    if v_err is not null then
      -- Money is in the account but stock ran out: stay On hold, flagged
      update public.orders set stock_issue = true where id = o.id;
      perform private.log_status(o.id, 'on_hold', 'on_hold', 'Paid — out of stock: ' || v_err);
      perform private.alert_admin('stock_issue', o.id, o.order_number || ' is paid but out of stock — action needed');
      return jsonb_build_object('payment_status', 'paid', 'status', 'on_hold', 'stock_issue', true, 'message', v_err);
    end if;
    return jsonb_build_object('payment_status', 'paid', 'status', 'processing', 'stock_issue', false,
                              'overpaid', v_received - o.total);
  end if;

  update public.orders set amount_received = v_received, payment_status = 'partially_paid' where id = o.id;
  perform private.log_status(o.id, 'on_hold', 'on_hold', 'Part payment of Rs. ' || to_char(p_amount, 'FM999,999,990.00') || ' received');
  perform private.queue_email('payment_partial', o.id, jsonb_build_object('amount', p_amount, 'balance', o.total - v_received));
  return jsonb_build_object('payment_status', 'partially_paid', 'status', 'on_hold', 'balance', o.total - v_received);
end;
$$;

create or replace function public.mark_payment_not_found(p_order_id uuid, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
  v_hours int;
begin
  perform private.require_admin();
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.payment_status <> 'payment_notified' then
    raise exception 'This order is not marked as "payment made" by the customer';
  end if;
  select bank_recheck_hours into v_hours from public.store_settings where id = 1;
  update public.orders
     set payment_status = 'unpaid',
         payment_due_at = greatest(coalesce(payment_due_at, now()), now()) + make_interval(hours => v_hours),
         is_overdue = false, reminder_sent_at = null
   where id = o.id;
  perform private.log_status(o.id, o.status, o.status, 'Payment not found yet' || coalesce(': ' || nullif(trim(p_note), ''), ''));
  perform private.queue_email('payment_not_found', o.id, jsonb_build_object('note', p_note));
end;
$$;

create or replace function public.record_refund(p_order_id uuid, p_reference text, p_date date default current_date)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  perform private.require_admin();
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.payment_status <> 'refund_pending' then
    raise exception 'This order has no refund pending';
  end if;
  update public.orders
     set payment_status = 'refunded', refund_reference = nullif(trim(p_reference), ''),
         refunded_at = coalesce(p_date::timestamptz, now())
   where id = o.id;
  perform private.log_status(o.id, o.status, o.status, 'Refund recorded' || coalesce(' (' || nullif(trim(p_reference), '') || ')', ''));
end;
$$;

-- ---------------------------------------------------------------------------
-- Cash on delivery (06-cash-on-delivery.md)
-- ---------------------------------------------------------------------------
create or replace function public.log_cod_call(p_order_id uuid, p_result text, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  insert into public.cod_call_logs (order_id, called_by, result, note)
  values (p_order_id, auth.uid(), p_result, nullif(trim(p_note), ''));
  update public.orders set cod_call_attempts = cod_call_attempts + 1 where id = p_order_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Shipping & delivery (both methods)
-- ---------------------------------------------------------------------------
create or replace function public.mark_shipped(p_order_id uuid, p_courier text, p_tracking text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  perform private.require_admin();
  if coalesce(trim(p_courier), '') = '' then
    raise exception 'Enter the courier name';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.status <> 'processing' then
    raise exception 'Only processing orders can be shipped';
  end if;
  update public.orders
     set status = 'shipped', shipped_at = now(), courier_name = trim(p_courier),
         tracking_number = nullif(trim(p_tracking), ''),
         cod_amount_to_collect = case when payment_method = 'cod' then total - amount_received end
   where id = o.id;
  perform private.log_status(o.id, 'processing', 'shipped', 'Shipped with ' || trim(p_courier) || coalesce(' — ' || nullif(trim(p_tracking), ''), ''));
  perform private.queue_email('order_shipped', o.id);
end;
$$;

create or replace function public.mark_delivered(p_order_id uuid)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  perform private.require_admin();
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.status <> 'shipped' then
    raise exception 'Only shipped orders can be marked as delivered';
  end if;
  update public.orders set status = 'delivered', delivered_at = now() where id = o.id;
  perform private.log_status(o.id, 'shipped', 'delivered', 'Delivered');
  -- Bank orders are already paid → completed automatically
  if o.payment_status = 'paid' then
    update public.orders set status = 'completed', completed_at = now() where id = o.id;
    perform private.log_status(o.id, 'delivered', 'completed', 'Completed (already paid)');
  end if;
end;
$$;

create or replace function public.mark_delivery_failed(p_order_id uuid, p_reason text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  perform private.require_admin();
  if coalesce(trim(p_reason), '') = '' then
    raise exception 'Please give the reason';
  end if;
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.status <> 'shipped' then
    raise exception 'Only shipped orders can be marked as failed';
  end if;
  update public.orders set status = 'returned', failure_reason = trim(p_reason) where id = o.id;
  perform private.log_status(o.id, 'shipped', 'returned', 'Delivery failed: ' || trim(p_reason));
  if o.payment_method = 'cod' then
    update public.profiles set failed_cod_count = failed_cod_count + 1 where id = o.user_id;
    perform private.alert_admin('cod_refused', o.id, 'COD parcel ' || o.order_number || ' was refused / not delivered');
  end if;
end;
$$;

create or replace function public.restock_order(p_order_id uuid, p_damaged boolean default false)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  perform private.require_admin();
  select * into o from public.orders where id = p_order_id for update;
  if o.id is null or o.status <> 'returned' then
    raise exception 'Only returned orders can be restocked';
  end if;
  if not p_damaged and o.stock_reduced_at is not null and o.restocked_at is null then
    update public.product_variants pv set stock_qty = pv.stock_qty + n.qty
      from private.order_stock_needs(o.id) n where pv.id = n.variant_id;
  end if;
  update public.orders
     set status = 'cancelled', cancelled_at = now(), restocked_at = now(),
         payment_status = case when amount_received > 0 then 'refund_pending' else payment_status end
   where id = o.id;
  perform private.log_status(o.id, 'returned', 'cancelled',
    case when p_damaged then 'Parcel back — damaged, not restocked' else 'Parcel back — restocked' end);
  -- Not put back in the cart: the customer refused it
  perform private.remove_order_items(o.id);
end;
$$;

create or replace function public.record_cod_remittance(
  p_order_ids uuid[], p_courier text, p_reference text, p_amount numeric, p_date date, p_note text default null
)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_due numeric;
  v_count int;
  v_id uuid;
  o public.orders;
begin
  perform private.require_admin();
  if p_order_ids is null or cardinality(p_order_ids) = 0 then
    raise exception 'Select at least one order';
  end if;
  select count(*), coalesce(sum(total - amount_received), 0) into v_count, v_due
    from public.orders
   where id = any(p_order_ids) and payment_method = 'cod' and status = 'delivered' and payment_status = 'unpaid';
  if v_count <> cardinality(p_order_ids) then
    raise exception 'Some selected orders are not delivered, unpaid COD orders';
  end if;
  if p_amount is null or p_amount < 0 then
    raise exception 'Enter the amount received';
  end if;
  if abs(p_amount - v_due) >= 0.01 and coalesce(trim(p_note), '') = '' then
    raise exception 'The amount differs from the total due (Rs. %). Please add a note, e.g. courier fee.', to_char(v_due, 'FM999,999,990.00');
  end if;

  insert into public.cod_remittances (courier_name, reference, amount_received, received_on, note, recorded_by)
  values (coalesce(nullif(trim(p_courier), ''), 'Courier'), nullif(trim(p_reference), ''), p_amount, coalesce(p_date, current_date), nullif(trim(p_note), ''), auth.uid())
  returning id into v_id;

  for o in select * from public.orders where id = any(p_order_ids) for update loop
    insert into public.order_payments (order_id, amount, method, bank_reference, received_on, note, recorded_by)
    values (o.id, o.total - o.amount_received, 'cod', nullif(trim(p_reference), ''), coalesce(p_date, current_date), 'Courier remittance', auth.uid());
    update public.orders
       set amount_received = total, payment_status = 'paid', paid_at = now(),
           status = 'completed', completed_at = now(), cod_remittance_id = v_id
     where id = o.id;
    perform private.log_status(o.id, 'delivered', 'completed', 'COD cash received from courier');
    perform private.queue_email('order_completed', o.id);
  end loop;
  return v_id;
end;
$$;

-- Generic admin status change: routes to the right function so side effects always run
create or replace function public.update_order_status(p_order_id uuid, p_new_status text, p_note text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
declare o public.orders;
begin
  perform private.require_admin();
  select * into o from public.orders where id = p_order_id;
  if o.id is null then
    raise exception 'Order not found';
  end if;
  case p_new_status
    when 'processing' then perform public.confirm_order(p_order_id);
    when 'cancelled'  then
      if o.status = 'returned' then perform public.restock_order(p_order_id, false);
      else perform public.cancel_order(p_order_id, coalesce(p_note, 'Cancelled by admin'));
      end if;
    when 'shipped'    then perform public.mark_shipped(p_order_id, coalesce(o.courier_name, 'Courier'), o.tracking_number);
    when 'delivered'  then perform public.mark_delivered(p_order_id);
    when 'returned'   then perform public.mark_delivery_failed(p_order_id, coalesce(p_note, 'Returned'));
    when 'completed'  then
      update public.orders set status = 'completed', completed_at = now() where id = p_order_id;
      perform private.log_status(p_order_id, o.status, 'completed', p_note);
    else raise exception 'Unknown status %', p_new_status;
  end case;
end;
$$;

-- ---------------------------------------------------------------------------
-- Customer account
-- ---------------------------------------------------------------------------
create or replace function public.buy_again(p_order_id uuid)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  r record;
  r2 record;
  v_added jsonb := '[]';
  v_skipped jsonb := '[]';
  v_qty int;
  v_avail int;
  v_ok boolean;
  v_in_cart int;
begin
  if not exists (select 1 from public.orders where id = p_order_id and user_id = auth.uid()) then
    raise exception 'Order not found';
  end if;

  for r in
    select oi.* from public.order_items oi
     where oi.order_id = p_order_id and (oi.parent_item_id is null)
  loop
    if r.bundle_id is not null then
      select public.is_live(b.is_active, b.starts_at, b.ends_at), public.bundle_availability(b.id) into v_ok, v_avail
        from public.bundles b where b.id = r.bundle_id;
      select coalesce(sum(quantity), 0) into v_in_cart from public.cart_items
       where user_id = auth.uid() and bundle_id = r.bundle_id and state = 'active';
      v_qty := least(r.quantity, coalesce(v_avail, 0) - v_in_cart);
      if coalesce(v_ok, false) and v_qty > 0 then
        perform public.add_to_cart(null, r.bundle_id, v_qty);
        v_added := v_added || jsonb_build_object('name', r.product_name, 'quantity', v_qty);
        continue;
      end if;
      -- Bundle no longer live: offer the individual items instead
      for r2 in select * from public.order_items where parent_item_id = r.id loop
        select pv.is_active and p.is_active and p.deleted_at is null, pv.stock_qty into v_ok, v_avail
          from public.product_variants pv join public.products p on p.id = pv.product_id where pv.id = r2.variant_id;
        select coalesce(sum(quantity), 0) into v_in_cart from public.cart_items
         where user_id = auth.uid() and variant_id = r2.variant_id and state = 'active';
        v_qty := least(r2.quantity, coalesce(v_avail, 0) - v_in_cart);
        if coalesce(v_ok, false) and v_qty > 0 then
          perform public.add_to_cart(r2.variant_id, null, v_qty);
          v_added := v_added || jsonb_build_object('name', r2.product_name || ' ' || r2.size_ml || 'ml', 'quantity', v_qty, 'from_bundle', true);
        else
          v_skipped := v_skipped || jsonb_build_object('name', r2.product_name || ' ' || r2.size_ml || 'ml',
                         'reason', case when coalesce(v_ok, false) then 'Out of stock' else 'No longer available' end);
        end if;
      end loop;
    else
      select pv.is_active and p.is_active and p.deleted_at is null, pv.stock_qty into v_ok, v_avail
        from public.product_variants pv join public.products p on p.id = pv.product_id where pv.id = r.variant_id;
      select coalesce(sum(quantity), 0) into v_in_cart from public.cart_items
       where user_id = auth.uid() and variant_id = r.variant_id and state = 'active';
      v_qty := least(r.quantity, coalesce(v_avail, 0) - v_in_cart);
      if coalesce(v_ok, false) and v_qty > 0 then
        perform public.add_to_cart(r.variant_id, null, v_qty);
        v_added := v_added || jsonb_build_object('name', r.product_name || ' ' || r.size_ml || 'ml', 'quantity', v_qty);
      else
        v_skipped := v_skipped || jsonb_build_object('name', r.product_name || coalesce(' ' || r.size_ml || 'ml', ''),
                       'reason', case when coalesce(v_ok, false) then 'Out of stock' else 'No longer available' end);
      end if;
    end if;
  end loop;
  return jsonb_build_object('added', v_added, 'skipped', v_skipped);
end;
$$;

create or replace function public.delete_my_account()
returns void
language plpgsql security definer set search_path = ''
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not logged in';
  end if;
  if public.is_admin() then
    raise exception 'Admin accounts cannot be deleted here. Ask another admin to remove your admin role first.';
  end if;
  delete from public.addresses where user_id = v_uid;
  perform set_config('app.system_cart_change', 'on', true);
  delete from public.cart_items where user_id = v_uid and state = 'active';
  perform set_config('app.system_cart_change', 'off', true);
  -- Orders are kept for the store's records, anonymised
  update public.orders
     set shipping_name = 'Deleted customer', shipping_phone = null, shipping_line1 = null, shipping_line2 = null,
         shipping_postal_code = null, customer_note = null, payment_customer_note = null
   where user_id = v_uid;
  perform set_config('app.system_profile_change', 'on', true);
  update public.profiles
     set full_name = 'Deleted customer', email = null, phone = null, date_of_birth = null, avatar_path = null,
         marketing_opt_in = false, deleted_at = now()
   where id = v_uid;
  delete from storage.objects where bucket_id = 'avatars' and (storage.foldername(name))[1] = v_uid::text;
  delete from auth.users where id = v_uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin users
-- ---------------------------------------------------------------------------
create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.require_admin();
  if p_role not in ('customer', 'admin') then
    raise exception 'Unknown role';
  end if;
  if exists (select 1 from public.profiles where id = p_user_id and (is_anonymous or deleted_at is not null)) then
    raise exception 'Only registered customers can become admins';
  end if;
  update public.profiles set role = p_role where id = p_user_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Scheduled job (hourly): reminders, overdue flags, auto-cancel, cart clean-up
-- ---------------------------------------------------------------------------
create or replace function public.process_overdue_orders()
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare
  s public.store_settings;
  o public.orders;
  v_reminders int := 0;
  v_overdue int := 0;
  v_cancelled int := 0;
  v_cleared int := 0;
begin
  -- Only callable by pg_cron / service role (no user) or an admin
  if auth.uid() is not null and not public.is_admin() then
    raise exception 'Not allowed';
  end if;
  select * into s from public.store_settings where id = 1;

  -- Reminder 24 h before the deadline (once)
  if s.payment_reminder_enabled then
    for o in select * from public.orders
              where payment_method = 'bank_transfer' and status = 'on_hold' and payment_status = 'unpaid'
                and reminder_sent_at is null and payment_due_at > now() and payment_due_at - interval '24 hours' <= now()
    loop
      update public.orders set reminder_sent_at = now() where id = o.id;
      perform private.queue_email('payment_reminder', o.id);
      v_reminders := v_reminders + 1;
    end loop;
  end if;

  -- Overdue tag
  update public.orders set is_overdue = true
   where payment_method = 'bank_transfer' and status = 'on_hold' and payment_status = 'unpaid'
     and payment_due_at < now() and not is_overdue;
  get diagnostics v_overdue = row_count;

  -- Auto-cancel (off by default). Never for payment_notified / partially_paid.
  if s.auto_cancel_unpaid then
    for o in select * from public.orders
              where payment_method = 'bank_transfer' and status = 'on_hold' and payment_status = 'unpaid'
                and payment_due_at + make_interval(hours => s.bank_grace_hours) < now()
    loop
      perform private.do_cancel_order(o.id, 'Automatically cancelled: payment not received by the deadline');
      v_cancelled := v_cancelled + 1;
    end loop;
  end if;

  -- Delivered orders leave the cart after N days
  perform set_config('app.system_cart_change', 'on', true);
  delete from public.cart_items ci
   using public.orders ord
   where ci.order_id = ord.id and ci.state = 'ordered'
     and ord.status in ('delivered', 'completed')
     and coalesce(ord.delivered_at, ord.completed_at) < now() - make_interval(days => s.cart_keep_days_after_delivery);
  get diagnostics v_cleared = row_count;
  perform set_config('app.system_cart_change', 'off', true);

  -- Old unused merge tokens
  delete from private.cart_merge_tokens where created_at < now() - interval '7 days';

  return jsonb_build_object('reminders', v_reminders, 'overdue', v_overdue, 'cancelled', v_cancelled, 'cart_cleared', v_cleared);
end;
$$;

-- ---------------------------------------------------------------------------
-- Email outbox access for the Next.js email route (secret-protected)
-- ---------------------------------------------------------------------------
create or replace function public.claim_email_jobs(p_secret text, p_limit int default 20)
returns jsonb
language plpgsql security definer set search_path = ''
as $$
declare v_jobs jsonb;
begin
  perform private.check_secret(p_secret);
  with picked as (
    select id from public.email_outbox
     where status = 'pending' or (status = 'failed' and attempts < 3)
     order by created_at
     limit p_limit
       for update skip locked
  ), upd as (
    update public.email_outbox e set status = 'sending', attempts = attempts + 1
      from picked where e.id = picked.id
    returning e.*
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', u.id,
           'template', u.template,
           'to_email', u.to_email,
           'payload', u.payload,
           'order', to_jsonb(o) - 'checkout_token',
           'customer_name', pr.full_name,
           'items', (select jsonb_agg(to_jsonb(oi) order by oi.parent_item_id nulls first, oi.product_name)
                       from public.order_items oi where oi.order_id = o.id)
         )), '[]'::jsonb) into v_jobs
    from upd u
    left join public.orders o on o.id = u.order_id
    left join public.profiles pr on pr.id = o.user_id;

  return jsonb_build_object(
    'jobs', v_jobs,
    'settings', (select to_jsonb(s) from public.store_settings s where id = 1),
    'bank_accounts', (select coalesce(jsonb_agg(to_jsonb(b) order by sort_order), '[]'::jsonb) from public.bank_accounts b where is_active)
  );
end;
$$;

create or replace function public.complete_email_job(p_secret text, p_id bigint, p_status text, p_error text default null)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.check_secret(p_secret);
  update public.email_outbox
     set status = p_status, last_error = p_error, sent_at = case when p_status = 'sent' then now() end
   where id = p_id;
end;
$$;
