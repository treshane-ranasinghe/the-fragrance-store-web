-- Sample data: the current thefragrancestore.lk catalogue, delivery methods and the default homepage.
-- Run once on a fresh database, after all migrations. Replace the bank account and prices before launch.
-- Images point at /images/... files shipped in the Next.js public folder; upload real ones in the admin later.

insert into public.categories (id, name, slug, subtitle, image_url, sort_order, intro_text) values
  ('00000000-0000-4000-a000-000000000001', 'Pour Homme', 'men', 'Woods, leather & spice', '/images/products/montblanc-explorer.jpg', 1,
   'Men''s perfumes in Sri Lanka — authentic designer fragrances built on woods, leather and spice.'),
  ('00000000-0000-4000-a000-000000000002', 'Pour Femme', 'women', 'Florals, musks & gourmands', '/images/products/lattafa-khamrah.jpg', 2,
   'Women''s perfumes in Sri Lanka — florals, musks and gourmands, every bottle 100% original.'),
  ('00000000-0000-4000-a000-000000000003', 'Arabian & Oud', 'arabian', 'Rare, opulent, unforgettable', '/images/products/lattafa-asad-bourbon.jpg', 3,
   'Arabian and oud fragrances — rare, opulent and unforgettable.'),
  ('00000000-0000-4000-a000-000000000004', 'Gift Sets', 'gift-sets', 'Two scents, one special price', '/images/azzaro-gold.jpg', 4,
   'Gift sets and bundles — the easiest way to give something memorable.');

insert into public.brands (id, name, slug, sort_order) values
  ('00000000-0000-4000-b000-000000000001', 'Hugo Boss', 'hugo-boss', 1),
  ('00000000-0000-4000-b000-000000000002', 'Azzaro', 'azzaro', 2),
  ('00000000-0000-4000-b000-000000000003', 'Jean Paul Gaultier', 'jean-paul-gaultier', 3),
  ('00000000-0000-4000-b000-000000000004', 'Lattafa', 'lattafa', 4),
  ('00000000-0000-4000-b000-000000000005', 'Montblanc', 'montblanc', 5);

insert into public.products (id, name, slug, brand_id, category_id, gender, concentration, badge, description, top_notes, middle_notes, base_notes, is_featured) values
  ('00000000-0000-4000-c000-000000000001', 'Boss Bottled Elixir', 'hugo-boss-bottled-elixir',
   '00000000-0000-4000-b000-000000000001', '00000000-0000-4000-a000-000000000001', 'men', 'Parfum', 'Bestseller',
   'A richer, deeper take on an icon — warm spice and smooth vanilla wrapped in precious woods. Made for evenings that matter.',
   '{Apple,Cinnamon}', '{Cloves}', '{Vanilla,"Woody Notes",Rum}', true),
  ('00000000-0000-4000-c000-000000000002', 'The Most Wanted Parfum', 'azzaro-the-most-wanted-parfum',
   '00000000-0000-4000-b000-000000000002', '00000000-0000-4000-a000-000000000001', 'men', 'Parfum', 'Signature',
   'Magnetic and daring. A fiery ginger opening melts into a sensual trail of bourbon vanilla and woods.',
   '{Ginger}', '{"Woodsy Notes"}', '{"Bourbon Vanilla"}', true),
  ('00000000-0000-4000-c000-000000000003', 'Le Male Elixir', 'jean-paul-gaultier-le-male-elixir',
   '00000000-0000-4000-b000-000000000003', '00000000-0000-4000-a000-000000000001', 'men', 'Parfum', 'Icon',
   'The legendary sailor, dipped in gold. Fresh lavender and mint over a glowing heart of honey, tonka and tobacco.',
   '{Mint,Lavender}', '{Vanilla,Benzoin}', '{"Tonka Bean",Honey,Tobacco}', true),
  ('00000000-0000-4000-c000-000000000004', 'Khamrah', 'lattafa-khamrah',
   '00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000003', 'unisex', 'EDP', 'Arabian',
   'An opulent Arabian gourmand — spiced dates and praline glowing over amberwood and vanilla. Unisex and unforgettable.',
   '{Cinnamon,Nutmeg,Bergamot}', '{Dates,Praline,Tuberose}', '{Vanilla,"Tonka Bean",Amberwood,Myrrh}', true),
  ('00000000-0000-4000-c000-000000000005', 'Asad Bourbon', 'lattafa-asad-bourbon',
   '00000000-0000-4000-b000-000000000004', '00000000-0000-4000-a000-000000000003', 'men', 'EDP', 'New',
   'A bold, bourbon-warm Arabian — smooth spice and sweet amber poured over deep, resinous woods.',
   '{"Pink Pepper",Lavender}', '{"Bourbon Vanilla",Coffee}', '{Amber,Vetiver,Patchouli}', true),
  ('00000000-0000-4000-c000-000000000006', 'Explorer', 'montblanc-explorer',
   '00000000-0000-4000-b000-000000000005', '00000000-0000-4000-a000-000000000001', 'men', 'EDP', null,
   'An invitation to adventure — bergamot and pink pepper over vetiver, leather and a warm woody trail.',
   '{Bergamot,"Pink Pepper","Clary Sage"}', '{Vetiver,Leather}', '{Patchouli,Ambroxan,Akigalawood}', false);

insert into public.product_variants (id, product_id, size_ml, sku, price, stock_qty) values
  ('00000000-0000-4000-d000-000000000011', '00000000-0000-4000-c000-000000000001', 50,  'BOSS-ELX-50',   38500, 6),
  ('00000000-0000-4000-d000-000000000012', '00000000-0000-4000-c000-000000000001', 100, 'BOSS-ELX-100',  52500, 4),
  ('00000000-0000-4000-d000-000000000021', '00000000-0000-4000-c000-000000000002', 50,  'AZZ-TMW-50',    34500, 5),
  ('00000000-0000-4000-d000-000000000022', '00000000-0000-4000-c000-000000000002', 100, 'AZZ-TMW-100',   46000, 3),
  ('00000000-0000-4000-d000-000000000031', '00000000-0000-4000-c000-000000000003', 75,  'JPG-LME-75',    41000, 4),
  ('00000000-0000-4000-d000-000000000032', '00000000-0000-4000-c000-000000000003', 125, 'JPG-LME-125',   54500, 2),
  ('00000000-0000-4000-d000-000000000041', '00000000-0000-4000-c000-000000000004', 100, 'LAT-KHM-100',   14500, 12),
  ('00000000-0000-4000-d000-000000000051', '00000000-0000-4000-c000-000000000005', 100, 'LAT-ASB-100',   12900, 9),
  ('00000000-0000-4000-d000-000000000061', '00000000-0000-4000-c000-000000000006', 60,  'MB-EXP-60',     24500, 5),
  ('00000000-0000-4000-d000-000000000062', '00000000-0000-4000-c000-000000000006', 100, 'MB-EXP-100',    32000, 3);

insert into public.product_images (product_id, storage_path, alt_text, sort_order) values
  ('00000000-0000-4000-c000-000000000001', '/images/products/boss-bottled-elixir.jpg', 'Hugo Boss Bottled Elixir', 0),
  ('00000000-0000-4000-c000-000000000002', '/images/products/azzaro-most-wanted-parfum.jpg', 'Azzaro The Most Wanted Parfum', 0),
  ('00000000-0000-4000-c000-000000000003', '/images/products/jpg-le-male-elixir.jpg', 'Jean Paul Gaultier Le Male Elixir', 0),
  ('00000000-0000-4000-c000-000000000004', '/images/products/lattafa-khamrah.jpg', 'Lattafa Khamrah', 0),
  ('00000000-0000-4000-c000-000000000005', '/images/products/lattafa-asad-bourbon.jpg', 'Lattafa Asad Bourbon', 0),
  ('00000000-0000-4000-c000-000000000006', '/images/products/montblanc-explorer.jpg', 'Montblanc Explorer', 0);

insert into public.delivery_methods (name, description, fee, free_over, cod_allowed, requires_address, sort_order) values
  ('Island-wide delivery', '2 – 4 working days, carefully packed', 450, 25000, true, true, 1),
  ('Collect from the boutique', 'Ready within 24 hours — Colombo', 0, null, true, false, 2);

insert into public.bank_accounts (account_name, account_number, bank_name, branch, sort_order) values
  ('The Fragrance Store (Pvt) Ltd', '0000000000 (replace me)', 'Commercial Bank', 'Colombo', 1);

update public.store_settings set
  cod_max_order_value = 150000,
  store_phone = '+94 XX XXX XXXX', store_whatsapp = '94XXXXXXXXX', store_email = 'hello@thefragrancestore.lk',
  store_address = E'No. 00, Your Street,\nColombo 00, Sri Lanka',
  instagram_url = 'https://www.instagram.com/', instagram_handle = '@thefragrancestore.lk',
  facebook_url = 'https://www.facebook.com/', tiktok_url = 'https://www.tiktok.com/',
  maps_url = 'https://maps.google.com/?q=The+Fragrance+Store+Colombo',
  announcement_short = 'Authentic only · Island-wide delivery'
 where id = 1;

-- Gift set: Boss Bottled Elixir 100 ml + The Most Wanted 100 ml (items Rs. 98,500 → Rs. 89,000)
insert into public.bundles (id, name, slug, description, category_id, price, max_per_order, is_active) values
  ('00000000-0000-4000-e000-000000000001', 'The Evening Duo', 'the-evening-duo',
   'Two after-dark icons, together: Boss Bottled Elixir 100 ml and Azzaro The Most Wanted Parfum 100 ml. Gift-wrapped at no extra cost.',
   '00000000-0000-4000-a000-000000000004', 89000, 2, true);
insert into public.bundle_items (bundle_id, variant_id, quantity) values
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-d000-000000000012', 1),
  ('00000000-0000-4000-e000-000000000001', '00000000-0000-4000-d000-000000000022', 1);

-- A live promotion: 10% off Lattafa for 30 days
insert into public.promotions (id, name, slug, description, discount_type, discount_value, badge_text, show_countdown, starts_at, ends_at, is_active) values
  ('00000000-0000-4000-f000-000000000001', 'Arabian Nights', 'arabian-nights', 'Ten percent off every Lattafa fragrance, for a limited time.',
   'percent', 10, 'Lattafa −10%', true, now() - interval '1 hour', now() + interval '30 days', true);
insert into public.promotion_targets (promotion_id, target_type, target_id) values
  ('00000000-0000-4000-f000-000000000001', 'brand', '00000000-0000-4000-b000-000000000004');

-- Media library entries for the shipped images
insert into public.media_assets (id, storage_path, file_name, alt_text) values
  ('00000000-0000-4000-9000-000000000001', '/images/hero.jpg', 'hero.jpg', 'Hugo Boss Bottled Elixir'),
  ('00000000-0000-4000-9000-000000000002', '/images/azzaro-gold.jpg', 'azzaro-gold.jpg', 'Azzaro The Most Wanted'),
  ('00000000-0000-4000-9000-000000000003', '/images/products/lattafa-asad-bourbon.jpg', 'lattafa-asad-bourbon.jpg', 'Lattafa Asad Bourbon'),
  ('00000000-0000-4000-9000-000000000004', '/images/products/lattafa-khamrah.jpg', 'lattafa-khamrah.jpg', 'Lattafa Khamrah'),
  ('00000000-0000-4000-9000-000000000005', '/images/products/montblanc-explorer.jpg', 'montblanc-explorer.jpg', 'Montblanc Explorer');

-- Hero slides (ghost word + glow tint + featured product)
insert into public.hero_banners (internal_name, desktop_media_id, alt_text, ghost_word, tint, feature_product_id, sort_order) values
  ('Boss Elixir',  '00000000-0000-4000-9000-000000000001', 'Hugo Boss Bottled Elixir', 'ELIXIR',   '#C6A566', '00000000-0000-4000-c000-000000000001', 1),
  ('Most Wanted',  '00000000-0000-4000-9000-000000000002', 'Azzaro The Most Wanted',  'WANTED',   '#E8D5A8', '00000000-0000-4000-c000-000000000002', 2),
  ('Asad Bourbon', '00000000-0000-4000-9000-000000000003', 'Lattafa Asad Bourbon',    'ASAD',     '#B8913F', '00000000-0000-4000-c000-000000000005', 3),
  ('Khamrah',      '00000000-0000-4000-9000-000000000004', 'Lattafa Khamrah',         'KHAMRAH',  '#DCCFB8', '00000000-0000-4000-c000-000000000004', 4),
  ('Explorer',     '00000000-0000-4000-9000-000000000005', 'Montblanc Explorer',      'EXPLORER', '#E8D5A8', '00000000-0000-4000-c000-000000000006', 5);

-- Default homepage (the original thefragrancestore.lk layout, built from CMS sections)
insert into public.announcements (text, background) values
  ('Authentic fragrances only  ·  Island-wide delivery across Sri Lanka  ·  Enquire on WhatsApp', 'gold');

insert into public.home_sections (type, title, subtitle, config, background, sort_order) values
  ('hero', null, null, '{}', 'green', 1),
  ('marquee', null, null, '{"words":["Oud","Amber","Rose de Mai","Sandalwood","Bergamot","Vetiver","Iris","Musk","Leather","Saffron"]}', 'green', 2),
  ('category_tiles', 'Find the scent that *speaks for you*', 'Curated Collections',
   '{"category_ids":["00000000-0000-4000-a000-000000000001","00000000-0000-4000-a000-000000000002","00000000-0000-4000-a000-000000000003"]}', 'cream', 3),
  ('product_row', 'Our most *coveted* bottles', 'The Signatures', '{"source":"featured","limit":6,"layout":"grid","filters":true,"view_all":"/shop"}', 'green', 4),
  ('promo_banner', null, null, '{"promotion_id":"00000000-0000-4000-f000-000000000001","countdown":true,"button_text":"Shop the offer"}', 'green', 5),
  ('image_text', 'A house built on *trust & taste*', 'Our Story',
   '{"media_id":"00000000-0000-4000-9000-000000000002","image_side":"left","heading":"A house built on *trust & taste*","body":"The Fragrance Store was founded on a simple belief: that everyone in Sri Lanka deserves access to genuine, world-class perfumery — without compromise. Every bottle we offer is sourced from trusted distributors and inspected by hand.","button_text":"Read our story","button_link":"/our-story","badge_number":100,"badge_text":"Authentic\nGuaranteed","pillars":[{"icon":"star","title":"Authentic Only","text":"Sealed, original bottles from verified sources."},{"icon":"truck","title":"Island-wide Delivery","text":"Carefully packed and delivered to your door."},{"icon":"chat","title":"Personal Consultation","text":"Expert guidance to find your signature."}]}', 'cream', 6),
  ('bundle_showcase', 'Two icons, *one gift*', 'Gift Sets', '{"source":"all"}', 'green', 8),
  ('testimonials', 'Loved by our *clientele*', 'Kind Words',
   '{"quotes":[{"text":"The only place in Colombo I trust for genuine perfumes. The consultation helped me find a scent I now can''t live without.","author":"Customer name, Colombo"},{"text":"Beautifully packaged, delivered to Kandy within two days, and completely authentic. A truly premium experience.","author":"Customer name, Kandy"},{"text":"They sourced a rare niche fragrance I had been searching for for months. Exceptional service from start to finish.","author":"Customer name, Galle"}]}', 'beige', 9),
  ('gallery', null, 'Follow the House', '{}', 'green', 10);
