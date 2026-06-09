import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Livestock = {
  id: string;
  name: string;
  description: string;
  type: string;
  image_url: string;
  logo_url: string;
  price_per_kg: number;
  price_per_portion: number | null;
  price_full: number | null;
  price_half: number | null;
  price_quarter: number | null;
  available_kg: number;
  available_portions: number;
  unit_options: string[];
  is_available: boolean;
  created_at: string;
};

export type DeliverySlot = {
  id: string;
  slot_date: string;
  slot_label: string;
  max_orders: number;
  current_orders: number;
  is_active: boolean;
};

export type BankAccount = {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  sort_code: string;
  is_active: boolean;
};

export type Order = {
  id: string;
  order_number: string;
  access_token: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  customer_whatsapp: string;
  livestock_id: string;
  livestock_name: string;
  quantity: number;
  unit: string;
  unit_price: number;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  fulfillment_type: string;
  delivery_address: string;
  delivery_slot_id: string | null;
  delivery_date: string | null;
  delivery_slot_label: string;
  payment_method: string;
  payment_reference: string;
  payment_proof_url: string;
  payment_status: string;
  order_status: string;
  preparation_type: string;
  portion_size: string;
  customer_comment: string;
  customer_confirmed: boolean;
  customer_confirmed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type OrderUpdate = {
  id: string;
  order_id: string;
  status: string;
  message: string;
  created_by: string;
  created_at: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  email: string;
  whatsapp: string;
  notes: string;
  created_at: string;
};

export type AdminSetting = {
  id: string;
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
};
