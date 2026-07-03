import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

// Units a livestock item can be sold in, in display order.
export const UNIT_ORDER = ['kg', 'portion', 'full', 'half', 'quarter'] as const;
export type Unit = (typeof UNIT_ORDER)[number];

export const UNIT_LABELS: Record<Unit, string> = {
  kg: 'KG',
  portion: 'Portion',
  full: 'Full',
  half: 'Half',
  quarter: 'Quarter',
};

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
  preparation_prices: Record<string, number>;
  is_available: boolean;
  created_at: string;
};

// Returns the price for a given unit on a livestock item (0 if not set).
export function priceForUnit(l: Livestock, unit: Unit): number {
  switch (unit) {
    case 'kg': return l.price_per_kg ?? 0;
    case 'portion': return l.price_per_portion ?? 0;
    case 'full': return l.price_full ?? 0;
    case 'half': return l.price_half ?? 0;
    case 'quarter': return l.price_quarter ?? 0;
  }
}

// The units that actually have a price / are enabled for a livestock item, in order.
export function availableUnits(l: Livestock): Unit[] {
  return UNIT_ORDER.filter((u) => {
    if (u === 'kg' || u === 'portion') {
      return (l.unit_options ?? []).includes(u) && priceForUnit(l, u) > 0;
    }
    return priceForUnit(l, u) > 0;
  });
}

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

export type DeliveryLocation = {
  id: string;
  name: string;
  fee: number;
  is_active: boolean;
  created_at: string;
};

export type Order = {
  id: string;
  order_number: string;
  access_token: string;
  user_id: string | null;
  customer_type: string;
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
  delivery_location_id: string | null;
  delivery_location_name: string;
  pickup_time: string;
  payment_method: string;
  payment_reference: string;
  payment_proof_url: string;
  payment_status: string;
  order_status: string;
  requires_confirmation: boolean;
  points_earned: number;
  preparation_type: string;
  portion_size: string;
  customer_comment: string;
  customer_confirmed: boolean;
  customer_confirmed_at: string | null;
  notes: string;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  order_id: string;
  livestock_id: string | null;
  livestock_name: string;
  livestock_image: string;
  unit: string;
  unit_price: number;
  quantity: number;
  preparation_types: string[];
  portion_size: string;
  subtotal: number;
  created_at: string;
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

export type Profile = {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  is_admin: boolean;
  points: number;
  created_at: string;
};

export type Notification = {
  id: string;
  recipient_type: 'user' | 'admin';
  user_id: string | null;
  title: string;
  body: string;
  type: string;
  order_id: string | null;
  is_read: boolean;
  created_at: string;
};

export type Message = {
  id: string;
  user_id: string;
  sender: 'user' | 'admin';
  body: string;
  is_read: boolean;
  created_at: string;
};

export type CartItem = {
  id: string;
  livestock_id: string;
  livestock_name: string;
  livestock_image: string;
  livestock_type: string;
  quantity: number;
  unit: Unit;
  unit_price: number;
  preparation_types: string[];
  portion_size?: string;
  subtotal: number;
  added_at: string;
};

export type UserData = { id: string; email: string; name: string; phone?: string; points?: number };

// ---- Auth helpers -------------------------------------------------------

function isEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
}

// Normalise a phone number to E.164-ish (default Nigeria +234 when a local
// 0-prefixed number is entered).
export function normalizePhone(raw: string): string {
  let p = raw.replace(/[^\d+]/g, '');
  if (p.startsWith('+')) return p;
  if (p.startsWith('0')) return '+234' + p.slice(1);
  if (p.startsWith('234')) return '+' + p;
  return p;
}

// Phone logins are authenticated as an internal email so no SMS provider /
// OTP is ever required. The real phone number is kept on the profile.
const PHONE_EMAIL_DOMAIN = 'phone.koyanfresh.app';
function phoneToEmail(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, '');
  return `p${digits}@${PHONE_EMAIL_DOMAIN}`;
}

export async function signUpUser(params: {
  identifier: string; // email or phone
  password: string;
  fullName: string;
}) {
  const { identifier, password, fullName } = params;
  if (isEmail(identifier)) {
    return supabase.auth.signUp({
      email: identifier.trim(),
      password,
      options: { data: { full_name: fullName } },
    });
  }
  const phone = normalizePhone(identifier);
  return supabase.auth.signUp({
    email: phoneToEmail(phone),
    password,
    options: { data: { full_name: fullName, phone } },
  });
}

export async function signInUser(identifier: string, password: string) {
  if (isEmail(identifier)) {
    return supabase.auth.signInWithPassword({ email: identifier.trim(), password });
  }
  return supabase.auth.signInWithPassword({ email: phoneToEmail(identifier), password });
}

export async function sendPasswordReset(email: string) {
  return supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: window.location.origin,
  });
}

export async function signOutUser() {
  return supabase.auth.signOut();
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  return data ?? null;
}
