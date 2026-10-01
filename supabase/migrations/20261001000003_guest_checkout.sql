-- Guest checkout: visitors with a guest (anonymous) session can place orders without an account.
-- They give an email for the confirmation; it is kept on the order (guests have no profile email).
-- If the guest later signs in or registers, their guest orders move into the account with the cart.

alter table public.orders add column guest_email text;

-- Order emails go to the account email, or the guest's email
create or replace function private.queue_email(p_template text, p_order_id uuid, p_payload jsonb default '{}')
returns void
language sql security definer set search_path = ''
as $$
  insert into public.email_outbox (template, order_id, to_email, payload)
  select p_template, o.id, coalesce(pr.email, o.guest_email), coalesce(p_payload, '{}')
    from public.orders o left join public.profiles pr on pr.id = o.user_id
   where o.id = p_order_id;
$$;

-- New p_email parameter (guests only)
drop function public.place_order(text, jsonb, uuid, text, text, numeric);

create or replace function public.place_order(
  p_checkout_token     text,
  p_address            jsonb,
  p_delivery_method_id uuid,
  p_payment_method     text,
  p_note               text default null,
  p_expected_total     numeric default null,
  p_email              text default null
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
  v_email text;
begin
  if v_uid is null then
    raise exception 'Please log in to place your order';
  end if;
  select * into v_profile from public.profiles where id = v_uid;
  if v_profile.id is null or v_profile.deleted_at is not null then
    raise exception 'Please log in or create an account to place your order';
  end if;
  -- Guests (no account) give an email for the order confirmation
  if v_profile.is_anonymous then
    v_email := lower(trim(p_email));
    if coalesce(v_email, '') !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
      raise exception 'Please enter a valid email address';
    end if;
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
    -- Guests start with a fresh profile each time, so refused parcels are counted by mobile number
    if s.cod_max_failed is not null and v_profile.is_anonymous and (
         select count(*) from public.orders o
          where o.payment_method = 'cod' and o.status = 'returned' and o.failure_reason is not null
            and right(o.shipping_phone, 9) = right(regexp_replace(p_address ->> 'phone', '\s', '', 'g'), 9)
       ) >= s.cod_max_failed then
      raise exception 'Cash on Delivery isn''t available for this mobile number. Please pay by bank transfer.';
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
    customer_note, guest_email, payment_due_at
  ) values (
    private.next_order_number(), v_uid, p_checkout_token, v_status, p_payment_method, 'unpaid',
    v_subtotal, v_delivery, v_cod_fee, 0, v_total,
    m.id, m.name,
    trim(p_address ->> 'full_name'), regexp_replace(p_address ->> 'phone', '\s', '', 'g'),
    trim(p_address ->> 'line1'), nullif(trim(p_address ->> 'line2'), ''), trim(p_address ->> 'city'),
    trim(p_address ->> 'district'), nullif(trim(p_address ->> 'postal_code'), ''),
    nullif(trim(p_note), ''), v_email,
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
  -- Orders placed as a guest move into the account too (with their locked cart lines, for cancellations)
  update public.cart_items set user_id = v_uid where user_id = v_guest and state = 'ordered';
  update public.orders set user_id = v_uid where user_id = v_guest;
  -- Cart history follows the customer so the monitor shows who it really was
  update public.cart_events set user_id = v_uid where user_id = v_guest;
  perform set_config('app.skip_cart_events', 'off', true);
  perform set_config('app.system_cart_change', 'off', true);
  return v_moved;
end;
$$;

-- o.* gained guest_email, so the view is rebuilt
drop view public.admin_orders;
create view public.admin_orders with (security_invoker = true) as
select o.*,
       coalesce(pr.full_name, o.shipping_name) as customer_name, coalesce(pr.email, o.guest_email) as customer_email,
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

grant select on public.admin_orders to authenticated;
revoke select on public.admin_orders from anon;
