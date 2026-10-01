-- The Fragrance Store — core schema
-- Spec: 11-database.md (+ extra fields from 04/05/06/17)

create extension if not exists pgcrypto with schema extensions;

-- Private schema: not exposed through the API (config, counters, cron state)
create schema if not exists private;
revoke all on schema private from public;

-- ---------------------------------------------------------------------------
-- Users
-- ---------------------------------------------------------------------------

-- No FK to auth.users on purpose: when a customer deletes their account the
-- auth user is removed but the anonymised profile stays so orders stay linked.
create table public.profiles (
  id                uuid primary key,
  full_name         text,
  email             text,
  phone             text,
  role              text not null default 'customer' check (role in ('customer', 'admin')),
  is_anonymous      boolean not null default false,
  date_of_birth     date,
  avatar_path       text,
  marketing_opt_in  boolean not null default false,
  failed_cod_count  int not null default 0,
  deleted_at        timestamptz,
  created_at        timestamptz not null default now()
);

-- Admin-only note about a customer (kept out of `profiles` so customers can
-- never read it, even though they can read their own profile row).
create table public.customer_admin_notes (
  user_id     uuid primary key references public.profiles (id) on delete cascade,
  note        text not null default '',
  updated_by  uuid references public.profiles (id),
  updated_at  timestamptz not null default now()
);

create table public.addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles (id) on delete cascade,
  full_name    text not null,
  phone        text not null,
  line1        text not null,
  line2        text,
  city         text not null,
  district     text not null,
  postal_code  text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index addresses_user_idx on public.addresses (user_id);

-- ---------------------------------------------------------------------------
-- Media library (CMS)
-- ---------------------------------------------------------------------------
create table public.media_assets (
  id            uuid primary key default gen_random_uuid(),
  storage_path  text not null unique,
  file_name     text not null,
  alt_text      text,
  width         int,
  height        int,
  size_bytes    bigint,
  uploaded_by   uuid references public.profiles (id),
  created_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  image_url        text,
  intro_text       text,
  seo_title        text,
  seo_description  text,
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.brands (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  logo_url         text,
  intro_text       text,
  seo_title        text,
  seo_description  text,
  sort_order       int not null default 0,
  is_active        boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.products (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  brand_id         uuid references public.brands (id),
  category_id      uuid references public.categories (id),
  gender           text not null default 'unisex' check (gender in ('men', 'women', 'unisex')),
  concentration    text not null default 'EDP' check (concentration in ('EDP', 'EDT', 'Parfum', 'Body Mist', 'Other')),
  description      text,
  top_notes        text[] not null default '{}',
  middle_notes     text[] not null default '{}',
  base_notes       text[] not null default '{}',
  is_featured      boolean not null default false,
  is_active        boolean not null default true,
  seo_title        text,
  seo_description  text,
  deleted_at       timestamptz,
  created_by       uuid references public.profiles (id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index products_brand_idx on public.products (brand_id);
create index products_category_idx on public.products (category_id);

create table public.product_variants (
  id                uuid primary key default gen_random_uuid(),
  product_id        uuid not null references public.products (id) on delete cascade,
  size_ml           int not null check (size_ml > 0),
  sku               text not null unique,
  price             numeric(10,2) not null check (price >= 0),
  compare_at_price  numeric(10,2) check (compare_at_price is null or compare_at_price >= 0),
  stock_qty         int not null default 0 check (stock_qty >= 0),
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index product_variants_product_idx on public.product_variants (product_id);

create table public.product_images (
  id            uuid primary key default gen_random_uuid(),
  product_id    uuid not null references public.products (id) on delete cascade,
  storage_path  text not null,
  alt_text      text,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);
create index product_images_product_idx on public.product_images (product_id);

create table public.product_slug_redirects (
  id          uuid primary key default gen_random_uuid(),
  old_slug    text not null unique,
  product_id  uuid not null references public.products (id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Promotions & bundles (17-cms-promotions-bundles.md)
-- ---------------------------------------------------------------------------
create table public.promotions (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  slug              text not null unique,
  description       text,
  desktop_media_id  uuid references public.media_assets (id),
  mobile_media_id   uuid references public.media_assets (id),
  discount_type     text not null check (discount_type in ('percent', 'amount')),
  discount_value    numeric(10,2) not null check (discount_value > 0),
  badge_text        text,
  show_countdown    boolean not null default false,
  include_bundles   boolean not null default false,
  seo_title         text,
  seo_description   text,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  is_active         boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (ends_at > starts_at),
  check (discount_type <> 'percent' or discount_value <= 100)
);

create table public.promotion_targets (
  id            uuid primary key default gen_random_uuid(),
  promotion_id  uuid not null references public.promotions (id) on delete cascade,
  target_type   text not null check (target_type in ('all', 'category', 'brand', 'product', 'variant')),
  target_id     uuid,
  is_exclusion  boolean not null default false,
  check ((target_type = 'all') = (target_id is null))
);
create index promotion_targets_promo_idx on public.promotion_targets (promotion_id);

create table public.bundles (
  id               uuid primary key default gen_random_uuid(),
  name             text not null,
  slug             text not null unique,
  description      text,
  category_id      uuid references public.categories (id),
  price            numeric(10,2) not null check (price >= 0),
  max_per_order    int check (max_per_order is null or max_per_order > 0),
  seo_title        text,
  seo_description  text,
  starts_at        timestamptz,
  ends_at          timestamptz,
  is_active        boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table public.bundle_items (
  id          uuid primary key default gen_random_uuid(),
  bundle_id   uuid not null references public.bundles (id) on delete cascade,
  variant_id  uuid not null references public.product_variants (id),
  quantity    int not null default 1 check (quantity > 0),
  unique (bundle_id, variant_id)
);

create table public.bundle_images (
  id            uuid primary key default gen_random_uuid(),
  bundle_id     uuid not null references public.bundles (id) on delete cascade,
  storage_path  text not null,
  alt_text      text,
  sort_order    int not null default 0
);

-- ---------------------------------------------------------------------------
-- CMS content
-- ---------------------------------------------------------------------------
create table public.hero_banners (
  id                   uuid primary key default gen_random_uuid(),
  internal_name        text not null,
  desktop_media_id     uuid not null references public.media_assets (id),
  mobile_media_id      uuid references public.media_assets (id),
  alt_text             text not null,
  eyebrow              text,
  headline             text,
  subheading           text,
  button1_text         text,
  button1_link_type    text check (button1_link_type in ('promotion', 'bundle', 'product', 'category', 'brand', 'url')),
  button1_link_target  text,
  button2_text         text,
  button2_link_type    text check (button2_link_type in ('promotion', 'bundle', 'product', 'category', 'brand', 'url')),
  button2_link_target  text,
  text_position        text not null default 'left' check (text_position in ('left', 'center', 'right')),
  overlay              text not null default 'medium' check (overlay in ('none', 'light', 'medium', 'dark')),
  text_colour          text not null default 'cream' check (text_colour in ('cream', 'dark')),
  sort_order           int not null default 0,
  starts_at            timestamptz,
  ends_at              timestamptz,
  is_active            boolean not null default true,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.announcements (
  id          uuid primary key default gen_random_uuid(),
  text        text not null check (char_length(text) <= 120),
  link_url    text,
  background  text not null default 'green' check (background in ('green', 'gold', 'beige')),
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.home_sections (
  id          uuid primary key default gen_random_uuid(),
  type        text not null check (type in ('hero', 'product_row', 'promo_banner', 'bundle_showcase', 'category_tiles', 'brand_strip', 'image_text', 'text', 'trust_badges')),
  title       text,
  subtitle    text,
  config      jsonb not null default '{}',
  background  text not null default 'cream' check (background in ('cream', 'beige', 'green')),
  spacing     text not null default 'medium' check (spacing in ('small', 'medium', 'large')),
  sort_order  int not null default 0,
  starts_at   timestamptz,
  ends_at     timestamptz,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
-- Only one hero section is allowed
create unique index home_sections_one_hero on public.home_sections (type) where type = 'hero';

-- ---------------------------------------------------------------------------
-- Settings, delivery, bank accounts
-- ---------------------------------------------------------------------------
create table public.delivery_methods (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  fee          numeric(10,2) not null default 0 check (fee >= 0),
  free_over    numeric(10,2) check (free_over is null or free_over >= 0),
  cod_allowed  boolean not null default true,
  sort_order   int not null default 0,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

create table public.bank_accounts (
  id              uuid primary key default gen_random_uuid(),
  account_name    text not null,
  account_number  text not null,
  bank_name       text not null,
  branch          text,
  branch_code     text,
  swift           text,
  sort_order      int not null default 0,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

create table public.store_settings (
  id                             int primary key default 1 check (id = 1),
  store_name                     text not null default 'The Fragrance Store',
  -- Direct bank transfer (WooCommerce BACS fields)
  bacs_enabled                   boolean not null default true,
  bacs_title                     text not null default 'Direct bank transfer',
  bacs_description               text not null default 'Make your payment directly into our bank account. Please use your Order ID as the payment reference. Your order will not be shipped until the funds have cleared in our account.',
  bacs_instructions              text not null default 'Please transfer the full amount to one of the bank accounts below and use your order number as the payment reference. We will start preparing your order as soon as the money reaches our account.',
  bank_payment_hours             int not null default 48 check (bank_payment_hours > 0),
  bank_recheck_hours             int not null default 24 check (bank_recheck_hours > 0),
  bank_grace_hours               int not null default 24 check (bank_grace_hours >= 0),
  payment_reminder_enabled       boolean not null default true,
  auto_cancel_unpaid             boolean not null default false,
  -- Cash on delivery
  cod_enabled                    boolean not null default true,
  cod_title                      text not null default 'Cash on delivery',
  cod_description                text not null default 'Pay with cash when your order is delivered.',
  cod_instructions               text not null default 'Pay with cash upon delivery.',
  cod_fee                        numeric(10,2) not null default 0 check (cod_fee >= 0),
  cod_max_order_value            numeric(10,2) check (cod_max_order_value is null or cod_max_order_value > 0),
  cod_max_failed                 int check (cod_max_failed is null or cod_max_failed > 0),
  cod_max_call_attempts          int not null default 3 check (cod_max_call_attempts > 0),
  cod_confirm_hours              int not null default 48 check (cod_confirm_hours > 0),
  cod_remit_alert_days           int not null default 7 check (cod_remit_alert_days > 0),
  -- Cart
  abandoned_cart_hours           int not null default 24 check (abandoned_cart_hours > 0),
  cart_keep_days_after_delivery  int not null default 3 check (cart_keep_days_after_delivery >= 0),
  -- Contact
  store_phone                    text,
  store_whatsapp                 text,
  store_email                    text,
  store_address                  text,
  default_hero_media_id          uuid references public.media_assets (id),
  updated_at                     timestamptz not null default now()
);
insert into public.store_settings (id) values (1);

-- ---------------------------------------------------------------------------
-- Cart
-- ---------------------------------------------------------------------------
create table public.cart_items (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  variant_id    uuid references public.product_variants (id) on delete cascade,
  bundle_id     uuid references public.bundles (id) on delete cascade,
  quantity      int not null check (quantity > 0),
  state         text not null default 'active' check (state in ('active', 'ordered')),
  order_id      uuid,
  price_at_add  numeric(10,2),
  added_at      timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  check (num_nonnulls(variant_id, bundle_id) = 1),
  check ((state = 'ordered') = (order_id is not null))
);
create unique index cart_items_active_variant on public.cart_items (user_id, variant_id) where state = 'active' and variant_id is not null;
create unique index cart_items_active_bundle on public.cart_items (user_id, bundle_id) where state = 'active' and bundle_id is not null;
create index cart_items_order_idx on public.cart_items (order_id);

create table public.cart_events (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  variant_id       uuid references public.product_variants (id) on delete set null,
  bundle_id        uuid references public.bundles (id) on delete set null,
  action           text not null check (action in ('add', 'remove', 'update_qty', 'checked_out', 'released', 'completed')),
  quantity_before  int not null default 0,
  quantity_after   int not null default 0,
  price_at_time    numeric(10,2),
  order_id         uuid,
  created_at       timestamptz not null default now()
);
create index cart_events_created_idx on public.cart_events (created_at desc);
create index cart_events_user_idx on public.cart_events (user_id);

-- One-time tokens that let a guest cart be moved into an account at login
create table private.cart_merge_tokens (
  token          text primary key,
  guest_user_id  uuid not null,
  created_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Orders
-- ---------------------------------------------------------------------------
create table private.order_counters (
  year  int primary key,
  last  int not null default 0
);

create table public.cod_remittances (
  id               uuid primary key default gen_random_uuid(),
  courier_name     text not null,
  reference        text,
  amount_received  numeric(10,2) not null,
  received_on      date not null,
  note             text,
  recorded_by      uuid references public.profiles (id),
  created_at       timestamptz not null default now()
);

create table public.orders (
  id                     uuid primary key default gen_random_uuid(),
  order_number           text not null unique,
  user_id                uuid references public.profiles (id),
  checkout_token         text unique,
  status                 text not null check (status in ('pending', 'on_hold', 'processing', 'shipped', 'delivered', 'completed', 'returned', 'cancelled')),
  payment_method         text not null check (payment_method in ('bank_transfer', 'cod')),
  payment_status         text not null default 'unpaid' check (payment_status in ('unpaid', 'payment_notified', 'partially_paid', 'paid', 'refund_pending', 'refunded')),
  subtotal               numeric(10,2) not null,
  delivery_fee           numeric(10,2) not null default 0,
  cod_fee                numeric(10,2) not null default 0,
  discount               numeric(10,2) not null default 0,
  total                  numeric(10,2) not null,
  amount_received        numeric(10,2) not null default 0,
  overpaid_amount        numeric(10,2) not null default 0,
  delivery_method_id     uuid references public.delivery_methods (id),
  delivery_method_name   text,
  shipping_name          text,
  shipping_phone         text,
  shipping_line1         text,
  shipping_line2         text,
  shipping_city          text,
  shipping_district      text,
  shipping_postal_code   text,
  customer_note          text,
  courier_name           text,
  tracking_number        text,
  payment_due_at         timestamptz,
  payment_notified_at    timestamptz,
  payment_customer_note  text,
  is_overdue             boolean not null default false,
  reminder_sent_at       timestamptz,
  stock_issue            boolean not null default false,
  stock_reduced_at       timestamptz,
  cod_confirmed_at       timestamptz,
  cod_call_attempts      int not null default 0,
  cod_amount_to_collect  numeric(10,2),
  cod_remittance_id      uuid references public.cod_remittances (id),
  failure_reason         text,
  refund_reference       text,
  refunded_at            timestamptz,
  restocked_at           timestamptz,
  paid_at                timestamptz,
  shipped_at             timestamptz,
  delivered_at           timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_status_idx on public.orders (status);

alter table public.cart_items
  add constraint cart_items_order_fk foreign key (order_id) references public.orders (id) on delete cascade;

create table public.order_items (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null references public.orders (id) on delete cascade,
  variant_id           uuid references public.product_variants (id) on delete set null,
  bundle_id            uuid references public.bundles (id) on delete set null,
  parent_item_id       uuid references public.order_items (id) on delete cascade,
  product_id           uuid references public.products (id) on delete set null,
  product_name         text not null,
  brand_name           text,
  size_ml              int,
  sku                  text,
  image_path           text,
  original_unit_price  numeric(10,2) not null default 0,
  discount_amount      numeric(10,2) not null default 0,
  promotion_id         uuid references public.promotions (id) on delete set null,
  unit_price           numeric(10,2) not null default 0,
  quantity             int not null check (quantity > 0),
  line_total           numeric(10,2) not null default 0
);
create index order_items_order_idx on public.order_items (order_id);
create index order_items_variant_idx on public.order_items (variant_id);

create table public.order_payments (
  id              uuid primary key default gen_random_uuid(),
  order_id        uuid not null references public.orders (id) on delete cascade,
  amount          numeric(10,2) not null,
  method          text not null check (method in ('bank_transfer', 'cod')),
  bank_reference  text,
  received_on     date not null default current_date,
  note            text,
  recorded_by     uuid references public.profiles (id),
  created_at      timestamptz not null default now()
);
create index order_payments_order_idx on public.order_payments (order_id);

create table public.order_status_history (
  id           bigint generated always as identity primary key,
  order_id     uuid not null references public.orders (id) on delete cascade,
  from_status  text,
  to_status    text not null,
  changed_by   uuid references public.profiles (id),
  note         text,
  created_at   timestamptz not null default now()
);
create index order_status_history_order_idx on public.order_status_history (order_id);

-- Admin-only internal notes on an order
create table public.order_notes (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  note        text not null,
  created_by  uuid references public.profiles (id),
  created_at  timestamptz not null default now()
);

create table public.cod_call_logs (
  id          uuid primary key default gen_random_uuid(),
  order_id    uuid not null references public.orders (id) on delete cascade,
  called_by   uuid references public.profiles (id),
  result      text not null check (result in ('confirmed', 'no_answer', 'wrong_number', 'cancel_requested')),
  note        text,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Notifications
-- ---------------------------------------------------------------------------
-- Real-time alerts shown in the admin panel
create table public.admin_alerts (
  id          bigint generated always as identity primary key,
  type        text not null,
  order_id    uuid references public.orders (id) on delete cascade,
  message     text not null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- Email outbox, processed by /api/emails/process (Resend)
create table public.email_outbox (
  id          bigint generated always as identity primary key,
  template    text not null,
  order_id    uuid references public.orders (id) on delete cascade,
  to_email    text,
  payload     jsonb not null default '{}',
  status      text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  attempts    int not null default 0,
  last_error  text,
  created_at  timestamptz not null default now(),
  sent_at     timestamptz
);
create index email_outbox_pending_idx on public.email_outbox (status, created_at);

-- ---------------------------------------------------------------------------
-- Private app config (site URL + shared secret for revalidation / emails)
-- ---------------------------------------------------------------------------
create table private.app_config (
  key    text primary key,
  value  text not null
);

create table private.cron_state (
  key    text primary key,
  value  timestamptz not null
);
