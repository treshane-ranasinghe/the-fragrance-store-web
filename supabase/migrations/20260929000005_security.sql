-- Row Level Security, grants, storage buckets, realtime (12-security.md)

-- ---------------------------------------------------------------------------
-- Private schema: callable from views only where needed; never exposed via API
-- ---------------------------------------------------------------------------
grant usage on schema private to anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function private.cart_price(uuid, uuid) to anon, authenticated;
grant execute on function private.guest_label(uuid) to authenticated;
grant execute on function private.product_sales_qty(uuid) to anon, authenticated;

-- Jobs and secret-protected functions: not callable by signed-in users
revoke execute on function public.process_overdue_orders() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Admin: full access to every public table
do $$
declare t text;
begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('create policy admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Catalogue: read active items only
-- ---------------------------------------------------------------------------
create policy public_read on public.categories for select to anon, authenticated using (is_active);
create policy public_read on public.brands for select to anon, authenticated using (is_active);
create policy public_read on public.products for select to anon, authenticated using (is_active and deleted_at is null);
create policy public_read on public.product_variants for select to anon, authenticated
  using (is_active and exists (select 1 from public.products p where p.id = product_id and p.is_active and p.deleted_at is null));
create policy public_read on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and p.is_active and p.deleted_at is null));
create policy public_read on public.product_slug_redirects for select to anon, authenticated using (true);

-- CMS: read live items only (active and within start/end dates)
create policy public_read on public.hero_banners for select to anon, authenticated using (public.is_live(is_active, starts_at, ends_at));
create policy public_read on public.announcements for select to anon, authenticated using (public.is_live(is_active, starts_at, ends_at));
create policy public_read on public.home_sections for select to anon, authenticated using (public.is_live(is_active, starts_at, ends_at));
-- Ended promotions stay reachable ("This offer has ended"), but drafts / scheduled ones don't
create policy public_read on public.promotions for select to anon, authenticated using (is_active and starts_at <= now());
create policy public_read on public.promotion_targets for select to anon, authenticated
  using (exists (select 1 from public.promotions p where p.id = promotion_id and p.is_active and p.starts_at <= now()));
create policy public_read on public.bundles for select to anon, authenticated using (public.is_live(is_active, starts_at, ends_at));
create policy public_read on public.bundle_items for select to anon, authenticated
  using (exists (select 1 from public.bundles b where b.id = bundle_id and public.is_live(b.is_active, b.starts_at, b.ends_at)));
create policy public_read on public.bundle_images for select to anon, authenticated
  using (exists (select 1 from public.bundles b where b.id = bundle_id and public.is_live(b.is_active, b.starts_at, b.ends_at)));
create policy public_read on public.media_assets for select to anon, authenticated using (true);

-- Checkout configuration
create policy public_read on public.delivery_methods for select to anon, authenticated using (is_active);
create policy public_read on public.bank_accounts for select to anon, authenticated using (is_active);
-- store_settings: admin only (public fields via public_store_settings view)

-- ---------------------------------------------------------------------------
-- Customer data: own rows only
-- ---------------------------------------------------------------------------
create policy own_read on public.profiles for select to authenticated using (id = auth.uid());
create policy own_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy own_all on public.addresses for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy own_read on public.cart_items for select to authenticated using (user_id = auth.uid());
create policy own_insert on public.cart_items for insert to authenticated
  with check (user_id = auth.uid() and state = 'active' and order_id is null);
create policy own_update on public.cart_items for update to authenticated
  using (user_id = auth.uid() and state = 'active') with check (user_id = auth.uid() and state = 'active' and order_id is null);
create policy own_delete on public.cart_items for delete to authenticated using (user_id = auth.uid() and state = 'active');

-- cart_events: written by trigger only; admin reads (admin_all)

create policy own_read on public.orders for select to authenticated using (user_id = auth.uid());
create policy own_read on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy own_read on public.order_payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
create policy own_read on public.order_status_history for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and o.user_id = auth.uid()));
-- order_notes, customer_admin_notes, cod_call_logs, cod_remittances, admin_alerts, email_outbox: admin only

-- ---------------------------------------------------------------------------
-- Grants on views
-- ---------------------------------------------------------------------------
grant select on public.store_products, public.store_variants, public.store_bundles,
                public.live_hero_banners, public.live_announcement, public.live_home_sections,
                public.live_promotions, public.live_bundles, public.public_store_settings
  to anon, authenticated;
grant select on public.my_order_summary, public.my_order_history, public.my_purchased_products to authenticated;
grant select on public.admin_customer_stats, public.admin_cart_lines, public.admin_active_carts, public.admin_abandoned_carts,
                public.admin_cart_feed, public.admin_product_cart_stats, public.admin_sales_summary,
                public.admin_variant_awaiting, public.admin_stock_warnings, public.admin_orders, public.admin_media_usage
  to authenticated;
revoke select on public.admin_customer_stats, public.admin_cart_lines, public.admin_active_carts, public.admin_abandoned_carts,
                public.admin_cart_feed, public.admin_product_cart_stats, public.admin_sales_summary,
                public.admin_variant_awaiting, public.admin_stock_warnings, public.admin_orders, public.admin_media_usage,
                public.my_order_summary, public.my_order_history, public.my_purchased_products
  from anon;

-- ---------------------------------------------------------------------------
-- Storage buckets
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('product-images', 'product-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('cms-media', 'cms-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp', 'image/avif']),
  ('avatars', 'avatars', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "public read catalogue images" on storage.objects for select to anon, authenticated
  using (bucket_id in ('product-images', 'cms-media'));
create policy "admins manage catalogue images" on storage.objects for all to authenticated
  using (bucket_id in ('product-images', 'cms-media') and public.is_admin())
  with check (bucket_id in ('product-images', 'cms-media') and public.is_admin());

-- avatars/<user id>/<file>
create policy "own avatar read" on storage.objects for select to authenticated
  using (bucket_id = 'avatars' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));
create policy "own avatar insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "own avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- Realtime (live cart activity + new-order alerts in admin; RLS still applies)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.cart_events, public.admin_alerts, public.orders;
