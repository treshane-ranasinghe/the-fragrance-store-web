\set ON_ERROR_STOP 1
\pset pager off
insert into auth.users (id, email, is_anonymous) values
 ('11111111-1111-4111-8111-111111111111', null, true),
 ('22222222-2222-4222-8222-222222222222', 'cust@example.com', false),
 ('33333333-3333-4333-8333-333333333333', 'admin@example.com', false),
 ('44444444-4444-4444-8444-444444444444', 'other@example.com', false);
update public.profiles set role='admin' where id='33333333-3333-4333-8333-333333333333';
insert into private.app_config values ('revalidate_secret','s3cret');
-- test setup: one out-of-stock size, and a delivery method without COD
update product_variants set stock_qty = 0 where sku = 'MB-EXP-100';
update delivery_methods set cod_allowed = false where name like 'Collect%';

create or replace function pg_temp.as_user(u text) returns void language sql as $$
  select set_config('request.jwt.claims', json_build_object('sub', u)::text, false) $$;

-- expect-error helper
create or replace function pg_temp.expect_error(q text, pattern text) returns text language plpgsql as $$
begin
  execute q;
  raise exception 'EXPECTED ERROR BUT SUCCEEDED: %', q;
exception when others then
  if sqlerrm like 'EXPECTED ERROR%' then raise; end if;
  if sqlerrm not ilike '%' || pattern || '%' then raise exception 'wrong error for %: %', q, sqlerrm; end if;
  return 'ok (' || sqlerrm || ')';
end $$;

\echo '--- anon catalogue'
set role anon;
select name, price, regular_price, badge_text, in_stock, sales_count from store_products order by name;
select name, price, effective_price, you_save, available from store_bundles;
select * from public_store_settings \gx
reset role;

\echo '--- guest cart'
select pg_temp.as_user('11111111-1111-4111-8111-111111111111');
set role authenticated;
select add_to_cart('00000000-0000-4000-d000-000000000051', null, 2);   -- Eros 50 (promo)
select add_to_cart('00000000-0000-4000-d000-000000000051', null, 1);   -- +1 = 3
select add_to_cart(null, '00000000-0000-4000-e000-000000000001', 1);   -- bundle
select pg_temp.expect_error($$select add_to_cart('00000000-0000-4000-d000-000000000032', null, 5)$$, 'Only 2 left');
select pg_temp.expect_error($$select add_to_cart('00000000-0000-4000-d000-000000000062', null, 1)$$, 'out of stock');
select (get_cart())->'subtotal' as guest_subtotal, (get_cart())->'count' as cnt;
select create_cart_transfer_token() as tok \gset
select pg_temp.expect_error($$select place_order('tok-guest-123', '{}', null, 'cod')$$, 'log in');
reset role;

\echo '--- customer merges guest cart'
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
set role authenticated;
select add_to_cart('00000000-0000-4000-d000-000000000051', null, 1);
select merge_guest_cart(:'tok') as moved;
select merge_guest_cart(:'tok') as moved_again;
select l->>'name' name, l->>'quantity' qty, l->>'unit_price' price from jsonb_array_elements((get_cart())->'items') l;
select count(*) as events_now_mine from cart_events;  -- RLS: customer can't read events
reset role;
select user_id, action, quantity_before, quantity_after from cart_events order by id;

\echo '--- checkout options'
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
set role authenticated;
select id as std from delivery_methods where name like 'Island-wide%' \gset
select id as exp from delivery_methods where name like 'Collect%' \gset
select checkout_options(:'std') \gx
select (checkout_options(:'exp'))->'cod' as express_cod;
select pg_temp.expect_error(format($$select place_order('tok-aaaa-1111', '{"full_name":"Nimal Perera","phone":"0771234567","line1":"12 Galle Rd","city":"Colombo","district":"Colombo"}', %L, 'bank_transfer', null, 1)$$, :'std'), 'PRICE_CHANGED');
select pg_temp.expect_error(format($$select place_order('tok-aaaa-1111', '{"full_name":"Nimal Perera","phone":"12345","line1":"12 Galle Rd","city":"Colombo","district":"Colombo"}', %L, 'bank_transfer')$$, :'std'), 'mobile number');
select pg_temp.expect_error(format($$select place_order('tok-aaaa-1111', '{"full_name":"Nimal Perera","phone":"0771234567","line1":"12 Galle Rd","city":"Colombo","district":"Colombo"}', %L, 'cod')$$, :'exp'), 'Collect from the boutique');
select ((checkout_options(:'std'))->>'subtotal')::numeric + ((checkout_options(:'std'))->>'delivery_fee')::numeric as expected \gset
select place_order('tok-aaaa-1111', '{"full_name":"Nimal Perera","phone":"077 123 4567","line1":"12 Galle Rd","city":"Colombo","district":"Colombo"}', :'std', 'bank_transfer', 'Please gift wrap', :expected) as o1;
select place_order('tok-aaaa-1111', '{"full_name":"Nimal Perera","phone":"0771234567","line1":"12 Galle Rd","city":"Colombo","district":"Colombo"}', :'std', 'bank_transfer') as o1_dup;
select order_number, status, payment_status, subtotal, delivery_fee, total, payment_due_at > now() as due_set from orders;
select product_name, parent_item_id is not null as is_item_line, original_unit_price, discount_amount, unit_price, quantity, line_total from order_items order by parent_item_id nulls first;
select jsonb_array_length((get_cart())->'items') as active_items, (get_cart())->'orders'->0->>'status' as ordered_badge;
with u as (update cart_items set quantity = 9 returning 1) select count(*) as cart_rows_updated_should_be_0 from u;
select id as o1id from orders limit 1 \gset
select notify_payment(:'o1id', 'Paid via app');
select pg_temp.expect_error(format($$select record_bank_payment(%L, 100, current_date, 'x')$$, :'o1id'), 'Only admins');
with u as (update orders set status='processing', total=1 returning 1) select count(*) as order_rows_updated_should_be_0 from u;
reset role;
select status, payment_status from orders;

\echo '--- other customer sees nothing'
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
set role authenticated;
select (select count(*) from orders) orders, (select count(*) from order_items) items, (select count(*) from cart_items) cart, (select count(*) from admin_orders) admin_orders;
select pg_temp.expect_error(format($$select cancel_order(%L, 'x')$$, :'o1id'), 'not found');
update profiles set role = 'admin' where id = '44444444-4444-4444-8444-444444444444';
select role from profiles;
reset role;

\echo '--- admin: part then full bank payment'
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
set role authenticated;
select total as o1total from orders where id = :'o1id' \gset
select stock_qty as eros_before from product_variants where id='00000000-0000-4000-d000-000000000051' \gset
select record_bank_payment(:'o1id', 10000, current_date, 'REF1');
select record_bank_payment(:'o1id', :o1total - 10000, current_date, 'REF2');
select status, payment_status, amount_received, stock_reduced_at is not null reduced from orders where id=:'o1id';
select :eros_before as eros_before, stock_qty as eros_after from product_variants where id='00000000-0000-4000-d000-000000000051';
select sku, stock_qty from product_variants where sku in ('BOSS-ELX-100','AZZ-TMW-100');
select pg_temp.expect_error(format($$update orders set status='delivered' where id=%L$$, :'o1id'), 'cannot change');
select mark_shipped(:'o1id', 'Domex', 'DX123');
select mark_delivered(:'o1id');
select status, payment_status, completed_at is not null from orders where id=:'o1id';
select from_status, to_status, note from order_status_history where order_id=:'o1id' order by id;
reset role;

\echo '--- COD flow'
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
set role authenticated;
select add_to_cart('00000000-0000-4000-d000-000000000021', null, 1);
select place_order('tok-cod-00001', '{"full_name":"Nimal","phone":"+94771234567","line1":"1 Road","city":"Kandy","district":"Kandy"}', :'std', 'cod') ->> 'order_id' as o2 \gset
select status, payment_status, total from orders where id=:'o2';
reset role;
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
set role authenticated;
select log_cod_call(:'o2', 'confirmed', 'ok');
select confirm_order(:'o2');
select mark_shipped(:'o2', 'Koombiyo', 'K1');
select cod_amount_to_collect from orders where id=:'o2';
select mark_delivered(:'o2');
select status, payment_status from orders where id=:'o2';
select pg_temp.expect_error(format($$select record_cod_remittance(array[%L]::uuid[], 'Koombiyo', 'R1', 1, current_date)$$, :'o2'), 'differs');
select record_cod_remittance(array[:'o2']::uuid[], 'Koombiyo', 'R1', 1000, current_date, 'fees deducted') is not null as remitted;
select status, payment_status, amount_received from orders where id=:'o2';
reset role;

\echo '--- customer cancels pending COD -> items back in cart'
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
set role authenticated;
select add_to_cart('00000000-0000-4000-d000-000000000041', null, 1);
select place_order('tok-cod-00002', '{"full_name":"Nimal","phone":"0771234567","line1":"1 Road","city":"Kandy","district":"Kandy"}', :'std', 'cod') ->> 'order_id' as o3 \gset
select add_to_cart('00000000-0000-4000-d000-000000000041', null, 1);
select cancel_order(:'o3', 'Changed my mind');
select l->>'name', l->>'quantity' from jsonb_array_elements((get_cart())->'items') l;
select * from my_order_summary;
select order_number, status, item_count from my_order_history order by created_at;
select product_name, times_bought, total_quantity, current_price, in_stock from my_purchased_products;
select buy_again(:'o1id');
reset role;

\echo '--- returned + restock, stock issue on paid bank order'
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
set role authenticated;
delete from cart_items where state='active';
select add_to_cart('00000000-0000-4000-d000-000000000032', null, 2);  -- BR540, 2 in stock
select place_order('tok-bank-0003', '{"full_name":"Nimal","phone":"0771234567","line1":"1 Road","city":"Kandy","district":"Kandy"}', :'std', 'bank_transfer') ->> 'order_id' as o4 \gset
reset role;
update product_variants set stock_qty = 1 where sku='JPG-LME-125';
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
set role authenticated;
select * from admin_stock_warnings;
select record_bank_payment(:'o4', 230450, current_date, 'R');
select status, payment_status, stock_issue from orders where id=:'o4';
select pg_temp.expect_error(format($$select confirm_order(%L)$$, :'o4'), 'Not enough stock');
update product_variants set stock_qty = 3 where sku='JPG-LME-125';
select confirm_order(:'o4');
select mark_shipped(:'o4', 'Domex', null);
select mark_delivery_failed(:'o4', 'Refused');
select restock_order(:'o4', false);
select status, payment_status from orders where id=:'o4';
select stock_qty as br540 from product_variants where sku='JPG-LME-125';
select record_refund(:'o4', 'RF-1');
select payment_status from orders where id=:'o4';
reset role;

\echo '--- admin views'
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
set role authenticated;
select full_name, total_orders, total_spent from admin_customer_stats;
select customer_name, item_count, cart_value from admin_active_carts;
select item_name, is_bundle, adds, removes, orders, conversion_rate from admin_product_cart_stats order by item_name;
select * from admin_sales_summary;
select order_number, status, balance_due, cod_needs_attention from admin_orders order by created_at;
select action, customer_name, item_name from admin_cart_feed order by id desc limit 5;
select type, message from admin_alerts order by id;
select claim_email_jobs('s3cret', 50) -> 'jobs' -> 0 ->> 'template' as first_email;
select template, status from email_outbox order by id;
select pg_temp.expect_error($$select claim_email_jobs('nope')$$, 'Invalid secret');
reset role;

\echo '--- jobs'
select process_overdue_orders();
select cms_schedule_tick();
set role anon;
select pg_temp.expect_error($$select process_overdue_orders()$$, 'permission denied');
reset role;

\echo '--- delete account'
select pg_temp.as_user('22222222-2222-4222-8222-222222222222');
set role authenticated;
select delete_my_account();
reset role;
select full_name, email, deleted_at is not null from profiles where id='22222222-2222-4222-8222-222222222222';
select count(*) as orders_kept, max(shipping_name) from orders;
select count(*) as auth_rows from auth.users where id='22222222-2222-4222-8222-222222222222';
\echo ALL DONE
\echo '--- profile protection'
select pg_temp.as_user('44444444-4444-4444-8444-444444444444');
set role authenticated;
update profiles set full_name = 'Kamal', role = 'admin', failed_cod_count = 0 where id = '44444444-4444-4444-8444-444444444444';
select full_name, role from profiles;
reset role;
update auth.users set email = 'kamal2@example.com' where id = '44444444-4444-4444-8444-444444444444';
select email from profiles where id = '44444444-4444-4444-8444-444444444444';
\echo '--- insights rpc + overdue/auto-cancel'
select pg_temp.as_user('33333333-3333-4333-8333-333333333333');
set role authenticated;
select item_name, adds, orders, conversion_rate from admin_cart_insights(null, null, 'registered') order by item_name;
reset role;
insert into auth.users (id, email) values ('55555555-5555-4555-8555-555555555555', 'late@example.com');
select pg_temp.as_user('55555555-5555-4555-8555-555555555555');
set role authenticated;
select add_to_cart('00000000-0000-4000-d000-000000000051', null, 1);
select id as std from delivery_methods where name like 'Island-wide%' \gset
select place_order('tok-late-0001', '{"full_name":"Late Payer","phone":"0771112222","line1":"1 Rd","city":"Galle","district":"Galle"}', :'std', 'bank_transfer') ->> 'order_id' as o9 \gset
reset role;
update orders set payment_due_at = now() - interval '30 hours' where id = :'o9';
update store_settings set auto_cancel_unpaid = true;
select set_config('request.jwt.claims', '', false);
select process_overdue_orders();
select status, payment_status, is_overdue from orders where id = :'o9';
select state, count(*) from cart_items where user_id = '55555555-5555-4555-8555-555555555555' group by state;
select template from email_outbox where order_id = :'o9' order by id;
\echo DONE2
