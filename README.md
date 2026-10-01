# The Fragrance Store

E-commerce site for original perfumes in Sri Lanka, built from the spec (v2.0).

**Stack:** Next.js 15 (App Router, TypeScript) + Supabase (Postgres, Auth, Storage, Realtime, pg_cron).
**Design:** the layout, components and motion of the existing thefragrancestore.lk site (spec 18), in the spec 15 colours:
Dark Green `#183F32`, Deep Forest `#12352B`, Cream `#F5F0E6`, Warm Beige `#DCCFB8`, Gold / Tan `#B89B63`, Dark Text `#1D2924`.
**Payments:** Direct bank transfer (WooCommerce BACS model) and cash on delivery. No online card payments.

## What's in the box

| Area | Where |
|---|---|
| Database: tables, triggers, pricing, RPCs, views, RLS, storage, cron | `supabase/migrations/` (apply in order) |
| Sample data (catalogue, delivery methods, default homepage) | `supabase/seed.sql` |
| Database scenario tests (runs on plain Postgres with Supabase stubs) | `supabase/tests/run.sh` |
| Storefront: home (CMS), shop, category, brand, product, promotions, bundles, info pages | `app/(store)/` |
| Cart, checkout, Order Received, My Account | `app/(shop-private)/` |
| Login, register, password reset | `app/(auth)/`, `app/auth/callback` |
| Admin panel | `app/admin/` |
| Revalidation, email processing, Draft Mode preview | `app/api/` |
| Server Actions | `lib/actions/` |
| Emails (Resend) | `lib/email/` |

All money, stock and status rules run **inside the database** (`place_order`, `confirm_order`,
`record_bank_payment`, `cancel_order` …). Prices shown in the browser are never trusted.

## Design (spec 18)

- `app/styles.css` and `app/shop.css` are the original site's stylesheets with every rule and class kept. Only the colours
  were swapped to the spec 15 palette by `scripts/apply-palette.py` (re-run it if the original CSS changes).
  Small gold labels on Dark Green use a lighter gold tint, and labels on Warm Beige use Dark Green, to meet the spec 15 contrast rules.
  `app/theme.css` maps the self-hosted `next/font` families (Cormorant Garamond, Jost, Nunito, Antonio) onto the
  same `--serif / --sans / --logo / --poster` variables. `app/store.css` adds screens the original didn't have
  (promotions, listing filters, product page, cart, account extras), using only the existing variables and patterns.
- The original markup is now React components in `components/site/`: `Hero` (wipe with gold light line, ghost word,
  tint glow, mouse depth, spotlight, particles, Now Featuring card, thumbnail rail), `Effects` (preloader, scroll
  progress, gold cursor, reveal on scroll, parallax, counters), `SiteNav` (glass pill + full-screen menu),
  `ProductCard` (3D tilt + shine), `ProductModal` (bottom sheet on phones), `BagDrawer`, `Sections` (marquee,
  collections, signatures, story, notes pyramid, testimonials, gallery, visit). The same timings and state classes are used.
- The homepage is still built from CMS sections, so every block is editable in Admin → Content → Homepage. Hero slides
  have a ghost word, glow tint and "Now Featuring" product.
- Tailwind is **not used on the storefront**. The admin panel still uses it (`app/admin/admin.css`), with its colour and
  font tokens pointed at the same palette (`tailwind.config.ts`), and with heavy motion off.
- Payment choices are Cash on delivery and Bank transfer only. The original's "Pay online (PayHere)" option was removed.
- **Demo mode:** with no `NEXT_PUBLIC_SUPABASE_URL`, the storefront runs on built-in sample data (`lib/demo.ts`,
  the current catalogue with its real photos in `public/images`). The bag works in the browser. Sign-in, orders,
  My Account and Admin need Supabase.

## Setup

### 1. Supabase project

1. Create a project at [supabase.com](https://supabase.com) (region: Singapore/Mumbai is closest to Sri Lanka).
2. **Database → Extensions:** enable `pg_cron` and `pg_net`.
3. Run the migrations in order in the SQL editor (or `supabase db push` with the Supabase CLI):
   `supabase/migrations/20260929000001_schema.sql` … `…000008_design_theme.sql`.
4. Optional: run `supabase/seed.sql` for sample products. **Replace the sample bank account** in
   Admin → Settings → Bank transfer before launch.
5. Tell the database where the site is, and the shared secret (same value as `REVALIDATE_SECRET`):
   ```sql
   insert into private.app_config (key, value) values
     ('site_url', 'https://your-domain.lk'),
     ('revalidate_secret', '<long random string>')
   on conflict (key) do update set value = excluded.value;
   ```
6. **Authentication → Sign In / Providers:** enable **Email** and **Allow anonymous sign-ins**
   (guests get a temporary ID only when they first add to cart).
7. **Authentication → URL configuration:** set Site URL to your domain and add
   `https://your-domain.lk/auth/callback` (and `http://localhost:3000/auth/callback`) to Redirect URLs.
8. **First admin:** sign up on the site, then in the SQL editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@example.com';
   ```
   After that, admins promote others from Admin → Settings → Admin users.

### 2. Run locally

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev                  # http://localhost:3000, admin at /admin
```

### 3. Deploy (Vercel)

Import the repo in Vercel and set the environment variables from `.env.example`:
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL`,
`REVALIDATE_SECRET`, and optionally `RESEND_API_KEY` + `EMAIL_FROM` for emails.
Then submit `https://your-domain.lk/sitemap.xml` in Google Search Console.

No Supabase service-role key is needed anywhere.

## How the moving parts connect

- **Caching:** public pages use a cookie-less Supabase client and are cached (tags `catalog`, `cms`,
  `bundles`, `settings`; 5-minute safety expiry). Admin saves call `revalidateTag`/`revalidatePath`,
  so changes are live within seconds.
- **Scheduled content:** `pg_cron` runs `cms_schedule_tick()` every 5 minutes. When a banner, section,
  announcement, promotion or bundle starts or ends, it POSTs to `/api/revalidate` with the secret.
- **Hourly job:** `process_overdue_orders()` sends payment reminders, flags overdue bank transfers,
  auto-cancels unpaid ones (only if switched on), and clears delivered orders from carts.
- **Emails:** database functions write to `email_outbox`. The `/api/emails/process` route (kicked by
  Server Actions and every minute by `pg_cron`) renders and sends them via Resend. Without
  `RESEND_API_KEY`, jobs are marked `skipped`, and in-panel alerts still work.
- **Realtime:** the admin panel subscribes to `admin_alerts`, `orders` and `cart_events`
  (new orders, "I've made the payment", live cart feed).
- **Guest carts:** a guest gets an anonymous session on first add-to-cart. At login or sign-up a
  one-time token moves the cart **and its cart history** to the account.
- **English / Sinhala (storefront only):** `next-intl`. English is at the plain URLs (`/shop`), Sinhala
  under `/si` (`/si/shop`); the button in the nav switches the current page. All storefront routes live in
  `app/[locale]/`. Interface text is in `messages/en.json` and `messages/si.json` (same keys in both).
  Shop content (products, categories, bundles, promotions, homepage sections, announcement, delivery
  methods, payment texts) gets its Sinhala version from an `i18n` jsonb column, e.g.
  `{"si": {"description": "…"}}`; anything left out shows in English (`lib/i18n-content.ts`).
  Database error messages shown to customers are translated in `lib/db-errors.ts`. The admin panel,
  emails and invoices stay English.

## Decisions where the spec left room

- **Admin-only notes** live in separate tables (`order_notes`, `customer_admin_notes`) rather than
  `admin_note` columns. Customers can read their own `orders`/`profiles` rows, so a column would
  leak to them. Separate tables with admin-only RLS keep the notes private.
- **Customer self-cancel** follows `04-checkout-orders-stock.md`: bank orders while *On hold*, COD
  while *Pending*. (`07-customer-profile.md` also mentions *Processing*; that stage has stock
  reduced and possibly money received, so it is left to the admin.)
- **"Price updated" at checkout:** the browser sends the total it displayed. If `place_order`
  calculates a different total (e.g. a promotion just ended), it refuses with `PRICE_CHANGED` and
  the cart shows the new price before the customer can order.
- **Account deletion** erases personal details, anonymises the shipping details on past orders, and
  deletes the auth user. The anonymised profile stays, so order history remains linked.
- **Returns policy wording** in `app/(store)/returns-policy` is a sensible default. Confirm it
  (spec open decision #6).
- **Bundle preview:** unpublished bundles can't be previewed on the storefront yet (the page 404s
  until the bundle is live). Promotions and homepage content preview fully in Draft Mode.

## Testing the database logic

```bash
# needs a local Postgres (15+ recommended); creates and drops a database called fs_test
PGHOST=127.0.0.1 PGPORT=5432 PGUSER=postgres ./supabase/tests/run.sh
```

The scenarios cover guest cart and merge, promotion pricing, bundles and combined stock checks,
duplicate-order protection, price-change detection, bank transfer (part/full payment, stock
reduced on confirm, "paid — out of stock"), COD (confirm, ship, deliver, courier remittance),
cancellations releasing items to the cart, returns and restock, refunds, invalid status jumps,
RLS isolation between customers, protected profile fields, overdue/auto-cancel, and account deletion.
