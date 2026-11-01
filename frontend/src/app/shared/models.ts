export type Lang = 'fr' | 'ar';

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface Category {
  id: number;
  name_fr: string;
  name_ar: string | null;
  slug: string;
  description_fr: string | null;
  description_ar: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
  product_count?: number;
}

export interface Goal {
  slug: string;
  name_fr: string;
  name_ar: string;
  icon: string;
}

export interface Product {
  id: number;
  category_id: number;
  name_fr: string;
  name_ar: string | null;
  slug: string;
  brand: string | null;
  goal: string | null;
  short_description_fr: string | null;
  short_description_ar: string | null;
  full_description_fr: string | null;
  full_description_ar: string | null;
  nutrition_facts: string | null;
  usage_fr: string | null;
  usage_ar: string | null;
  weight_label: string | null;
  option_label: string | null;
  options: string[];
  price: string;
  compare_at_price: string | null;
  image_url: string | null;
  is_new: boolean;
  is_bestseller: boolean;
  free_delivery: boolean;
  stock_status: StockStatus;
  created_at: string;
}

export interface AdminProduct extends Product {
  is_active: boolean;
  stock_quantity: number | null;
  sort_order: number;
  updated_at: string;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface ProductQuery {
  category?: string;
  goal?: string;
  brand?: string;
  q?: string;
  min_price?: number;
  max_price?: number;
  on_sale?: boolean;
  in_stock?: boolean;
  is_new?: boolean;
  is_bestseller?: boolean;
  free_delivery?: boolean;
  sort?: string;
  page?: number;
  page_size?: number;
}

export interface SiteSettings {
  site_title: string;
  tagline_fr: string | null;
  tagline_ar: string | null;
  logo_url: string | null;
  contact_phone: string;
  contact_email: string;
  contact_address: string | null;
  whatsapp_number: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  announcement_fr: string | null;
  announcement_ar: string | null;
  delivery_fee: string;
  free_delivery_threshold: string | null;
  default_language: string;
  supported_languages: string;
}

export interface CartLineInput {
  product_id: number;
  quantity: number;
  option?: string | null;
}

export interface QuoteLine {
  product_id: number;
  slug: string | null;
  name_fr: string;
  name_ar: string | null;
  image_url: string | null;
  option: string | null;
  unit_price: string;
  compare_at_price: string | null;
  quantity: number;
  line_total: string;
  available: boolean;
  max_quantity: number | null;
  issue: string | null;
}

export interface Quote {
  lines: QuoteLine[];
  subtotal: string;
  delivery_fee: string;
  total: string;
  free_delivery: boolean;
  free_delivery_threshold: string | null;
  amount_to_free_delivery: string | null;
  all_available: boolean;
}

export interface OrderCreate {
  customer_name: string;
  phone_number: string;
  email?: string | null;
  address_line_1: string;
  address_line_2?: string | null;
  city: string;
  postal_code?: string | null;
  customer_note?: string | null;
  payment_method: 'CASH_ON_DELIVERY';
  consent: boolean;
  items: CartLineInput[];
}

export interface OrderItem {
  id: number;
  product_id: number | null;
  product_name_snapshot: string;
  option_label: string | null;
  image_url_snapshot: string | null;
  unit_price_snapshot: string;
  quantity: number;
  line_total: string;
}

export type OrderStatus = 'NEW' | 'CONFIRMED' | 'WAITING_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface OrderConfirmation {
  order_number: string;
  status: OrderStatus;
  payment_method: string;
  subtotal: string;
  delivery_fee: string;
  order_total: string;
  created_at: string;
  items: OrderItem[];
}

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  phone_number: string;
  email: string | null;
  address_line_1: string;
  address_line_2: string | null;
  city: string;
  postal_code: string | null;
  country: string;
  payment_method: string;
  status: OrderStatus;
  subtotal: string;
  delivery_fee: string;
  order_total: string;
  customer_note: string | null;
  admin_note: string | null;
  confirmed_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  anonymized_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
}

export interface AdminNotification {
  id: number;
  type: string;
  order_id: number | null;
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
}

export interface ContactMessage {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  subject: string | null;
  message: string;
  is_read: boolean;
  created_at: string;
}

export interface AuditLog {
  id: number;
  admin_email: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  detail: string | null;
  ip_address: string | null;
  created_at: string;
}

export interface DashboardStats {
  total_orders: number;
  orders_today: number;
  by_status: Record<OrderStatus, number>;
  revenue_total: string;
  revenue_month: string;
  average_basket: string;
  sales_last_14_days: { date: string; orders: number; revenue: string }[];
  top_products: { name: string; quantity: number; revenue: string }[];
  low_stock: { id: number; name_fr: string; image_url: string | null; stock_quantity: number }[];
  unread_notifications: number;
  unread_messages: number;
  active_products: number;
}

export interface SessionInfo {
  admin_name: string;
  email: string;
  csrf_token: string;
}
