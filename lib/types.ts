export type OrderStatus = 'pending' | 'on_hold' | 'processing' | 'shipped' | 'delivered' | 'completed' | 'returned' | 'cancelled';
export type PaymentStatus = 'unpaid' | 'payment_notified' | 'partially_paid' | 'paid' | 'refund_pending' | 'refunded';
export type PaymentMethod = 'bank_transfer' | 'cod';

export interface StoreProduct {
  id: string;
  name: string;
  slug: string;
  gender: 'men' | 'women' | 'unisex';
  concentration: string;
  description: string | null;
  top_notes: string[];
  middle_notes: string[];
  base_notes: string[];
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  seo_title: string | null;
  seo_description: string | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_slug: string | null;
  category_id: string | null;
  category_name: string | null;
  category_slug: string | null;
  image_path: string | null;
  image_alt: string | null;
  default_variant_id: string;
  default_size_ml: number;
  price: number;
  regular_price: number;
  compare_at_price: number | null;
  badge_text: string | null;
  promotion_id: string | null;
  promo_ends_at: string | null;
  show_countdown: boolean;
  min_price: number;
  max_price: number;
  sizes: number[];
  variant_count: number;
  in_stock: boolean;
  on_sale: boolean;
  sales_count: number;
  badge?: string | null;
}

export interface StoreVariant {
  id: string;
  product_id: string;
  size_ml: number;
  sku: string;
  stock_qty: number;
  compare_at_price: number | null;
  price: number;
  effective_price: number;
  discount_amount: number;
  promotion_id: string | null;
  promotion_slug: string | null;
  badge_text: string | null;
  promo_ends_at: string | null;
  show_countdown: boolean;
}

export interface StoreBundle {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category_id: string | null;
  category_slug: string | null;
  max_per_order: number | null;
  seo_title: string | null;
  seo_description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  updated_at: string;
  price: number;
  effective_price: number;
  badge_text: string | null;
  promo_ends_at: string | null;
  items_value: number;
  you_save: number;
  available: number;
  image_path: string | null;
  item_images: (string | null)[] | null;
}

export interface CartLine {
  id: string;
  kind: 'variant' | 'bundle';
  variant_id?: string;
  bundle_id?: string;
  quantity: number;
  added_at: string;
  price_at_add: number | null;
  name: string;
  slug: string;
  brand: string | null;
  size_ml: number | null;
  image_path: string | null;
  unit_price: number;
  base_price: number;
  badge_text: string | null;
  stock: number;
  max_per_order?: number | null;
  available: boolean;
  items: { name: string; size_ml: number; quantity: number }[];
}

export interface CartOrder {
  order_id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: PaymentStatus;
  payment_method: PaymentMethod;
  total: number;
  amount_received: number;
  payment_due_at: string | null;
  tracking_number: string | null;
  courier_name: string | null;
  created_at: string;
  items: { name: string; size_ml: number | null; quantity: number; is_bundle: boolean }[];
}

export interface Cart {
  items: CartLine[];
  orders: CartOrder[];
  subtotal: number;
  count: number;
}

export interface BankAccount {
  id: string;
  account_name: string;
  account_number: string;
  bank_name: string;
  branch: string | null;
  branch_code: string | null;
  swift: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface PublicSettings {
  store_name: string;
  bacs_enabled: boolean;
  bacs_title: string;
  bacs_description: string;
  bacs_instructions: string;
  bank_payment_hours: number;
  cod_enabled: boolean;
  cod_title: string;
  cod_description: string;
  cod_instructions: string;
  cod_fee: number;
  cod_max_order_value: number | null;
  store_phone: string | null;
  store_whatsapp: string | null;
  store_email: string | null;
  store_address: string | null;
  default_hero_media_id: string | null;
  store_hours?: string | null;
  instagram_url?: string | null;
  instagram_handle?: string | null;
  facebook_url?: string | null;
  tiktok_url?: string | null;
  maps_url?: string | null;
  announcement_short?: string | null;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  guest_email: string | null;
  status: OrderStatus;
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  subtotal: number;
  delivery_fee: number;
  cod_fee: number;
  discount: number;
  total: number;
  amount_received: number;
  overpaid_amount: number;
  delivery_method_name: string | null;
  shipping_name: string | null;
  shipping_phone: string | null;
  shipping_line1: string | null;
  shipping_line2: string | null;
  shipping_city: string | null;
  shipping_district: string | null;
  shipping_postal_code: string | null;
  customer_note: string | null;
  courier_name: string | null;
  tracking_number: string | null;
  payment_due_at: string | null;
  payment_notified_at: string | null;
  payment_customer_note: string | null;
  is_overdue: boolean;
  stock_issue: boolean;
  stock_reduced_at: string | null;
  cod_confirmed_at: string | null;
  cod_call_attempts: number;
  cod_amount_to_collect: number | null;
  failure_reason: string | null;
  refund_reference: string | null;
  refunded_at: string | null;
  restocked_at: string | null;
  paid_at: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  variant_id: string | null;
  bundle_id: string | null;
  parent_item_id: string | null;
  product_id: string | null;
  product_name: string;
  brand_name: string | null;
  size_ml: number | null;
  sku: string | null;
  image_path: string | null;
  original_unit_price: number;
  discount_amount: number;
  promotion_id: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface MediaAsset {
  id: string;
  storage_path: string;
  file_name: string;
  alt_text: string | null;
  width: number | null;
  height: number | null;
  size_bytes: number | null;
  created_at: string;
}
