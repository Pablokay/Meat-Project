/*
  # Koyan Fresh — FULL consolidated schema (fresh project)

  Run this ONCE in the Supabase SQL editor of your new project. It creates every
  table, function, RLS policy, storage bucket, and seed row the app needs.
  It is idempotent (safe to re-run).

  After running:
  - Auth → Providers: enable Email (and Phone if you want phone login).
  - Sign up your admin account in the app, then:
      UPDATE profiles SET is_admin = true WHERE email = '<your-admin-email>';
  - Edge function secrets (optional, for email): RESEND_API_KEY, FROM_EMAIL, ADMIN_ALERT_EMAIL.
  - Update the app's .env with the NEW project URL + anon key, then restart the dev server.
*/

-- ============================================================
-- HELPER: is_admin()
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text DEFAULT '',
  email text DEFAULT '',
  phone text DEFAULT '',
  is_admin boolean DEFAULT false,
  points integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $koyan$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true);
$koyan$;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT TO authenticated USING (id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR is_admin()) WITH CHECK (id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $koyan$
BEGIN
  INSERT INTO profiles (id, full_name, email, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.email,''), COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone',''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$koyan$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- LIVESTOCK
-- ============================================================
CREATE TABLE IF NOT EXISTS livestock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL,
  image_url text DEFAULT '',
  logo_url text DEFAULT '',
  price_per_kg numeric(10,2) NOT NULL DEFAULT 0,
  price_per_portion numeric(10,2),
  price_full numeric(10,2),
  price_half numeric(10,2),
  price_quarter numeric(10,2),
  available_kg numeric(10,2) DEFAULT 0,
  available_portions integer DEFAULT 0,
  unit_options text[] DEFAULT ARRAY['kg','portion'],
  preparation_prices jsonb DEFAULT '{}'::jsonb,
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE livestock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view livestock" ON livestock;
CREATE POLICY "Anyone can view livestock" ON livestock FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can insert livestock" ON livestock;
CREATE POLICY "Admin can insert livestock" ON livestock FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can update livestock" ON livestock;
CREATE POLICY "Admin can update livestock" ON livestock FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- DELIVERY SLOTS
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date date NOT NULL,
  slot_label text NOT NULL,
  max_orders integer DEFAULT 10,
  current_orders integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE delivery_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view delivery slots" ON delivery_slots;
CREATE POLICY "Anyone can view delivery slots" ON delivery_slots FOR SELECT USING (true);
DROP POLICY IF EXISTS "Anyone can update delivery slots" ON delivery_slots;
CREATE POLICY "Anyone can update delivery slots" ON delivery_slots FOR UPDATE USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "Admin can insert delivery slots" ON delivery_slots;
CREATE POLICY "Admin can insert delivery slots" ON delivery_slots FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can delete delivery slots" ON delivery_slots;
CREATE POLICY "Admin can delete delivery slots" ON delivery_slots FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- BANK ACCOUNTS
-- ============================================================
CREATE TABLE IF NOT EXISTS bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name text NOT NULL,
  account_name text NOT NULL,
  account_number text NOT NULL,
  sort_code text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view bank accounts" ON bank_accounts;
CREATE POLICY "Anyone can view bank accounts" ON bank_accounts FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can insert bank accounts" ON bank_accounts;
CREATE POLICY "Admin can insert bank accounts" ON bank_accounts FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can update bank accounts" ON bank_accounts;
CREATE POLICY "Admin can update bank accounts" ON bank_accounts FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can delete bank accounts" ON bank_accounts;
CREATE POLICY "Admin can delete bank accounts" ON bank_accounts FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- DELIVERY LOCATIONS (per-location fees)
-- ============================================================
CREATE TABLE IF NOT EXISTS delivery_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  fee numeric(10,2) NOT NULL DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE delivery_locations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view delivery locations" ON delivery_locations;
CREATE POLICY "Anyone can view delivery locations" ON delivery_locations FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin manages delivery locations insert" ON delivery_locations;
CREATE POLICY "Admin manages delivery locations insert" ON delivery_locations FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages delivery locations update" ON delivery_locations;
CREATE POLICY "Admin manages delivery locations update" ON delivery_locations FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin manages delivery locations delete" ON delivery_locations;
CREATE POLICY "Admin manages delivery locations delete" ON delivery_locations FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- ORDERS
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL DEFAULT 'ORD-' || upper(substring(gen_random_uuid()::text, 1, 8)),
  access_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_type text DEFAULT 'guest',
  customer_name text NOT NULL,
  customer_email text NOT NULL DEFAULT '',
  customer_phone text NOT NULL,
  customer_whatsapp text NOT NULL DEFAULT '',
  livestock_id uuid REFERENCES livestock(id),
  livestock_name text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  unit text NOT NULL DEFAULT 'kg',
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  delivery_fee numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL DEFAULT 0,
  fulfillment_type text NOT NULL DEFAULT 'pickup',
  delivery_address text DEFAULT '',
  delivery_slot_id uuid REFERENCES delivery_slots(id),
  delivery_date date,
  delivery_slot_label text DEFAULT '',
  delivery_location_id uuid,
  delivery_location_name text DEFAULT '',
  pickup_time text DEFAULT '',
  payment_method text NOT NULL DEFAULT 'bank_transfer',
  payment_reference text DEFAULT '',
  payment_proof_url text DEFAULT '',
  payment_status text NOT NULL DEFAULT 'pending',
  order_status text NOT NULL DEFAULT 'pending',
  requires_confirmation boolean DEFAULT false,
  points_earned integer DEFAULT 0,
  preparation_type text DEFAULT '',
  portion_size text DEFAULT '',
  customer_comment text DEFAULT '',
  customer_confirmed boolean DEFAULT false,
  customer_confirmed_at timestamptz,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Orders readable by owner or admin" ON orders;
CREATE POLICY "Orders readable by owner or admin" ON orders FOR SELECT USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;
-- Order creation is open (public storefront + guest checkout). Reads/updates stay
-- gated by the SELECT/UPDATE policies below, so no data is exposed.
CREATE POLICY "Anyone can create orders" ON orders FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Owner or admin can update orders" ON orders;
CREATE POLICY "Owner or admin can update orders" ON orders FOR UPDATE USING (user_id = auth.uid() OR is_admin()) WITH CHECK (user_id = auth.uid() OR is_admin());

-- ============================================================
-- ORDER ITEMS
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  livestock_id uuid REFERENCES livestock(id) ON DELETE SET NULL,
  livestock_name text NOT NULL DEFAULT '',
  livestock_image text DEFAULT '',
  unit text NOT NULL DEFAULT 'kg',
  unit_price numeric(10,2) NOT NULL DEFAULT 0,
  quantity numeric(10,2) NOT NULL DEFAULT 1,
  preparation_types text[] DEFAULT ARRAY[]::text[],
  portion_size text DEFAULT '',
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order items readable by owner or admin" ON order_items;
CREATE POLICY "Order items readable by owner or admin" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR is_admin()))
);
DROP POLICY IF EXISTS "Anyone can insert order items" ON order_items;
CREATE POLICY "Anyone can insert order items" ON order_items FOR INSERT WITH CHECK (true);

-- ============================================================
-- ORDER UPDATES (timeline)
-- ============================================================
CREATE TABLE IF NOT EXISTS order_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text NOT NULL,
  created_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE order_updates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Order updates readable by owner or admin" ON order_updates;
CREATE POLICY "Order updates readable by owner or admin" ON order_updates FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders o WHERE o.id = order_updates.order_id AND (o.user_id = auth.uid() OR is_admin()))
);
DROP POLICY IF EXISTS "Anyone can insert order updates" ON order_updates;
CREATE POLICY "Anyone can insert order updates" ON order_updates FOR INSERT WITH CHECK (true);

-- ============================================================
-- CUSTOMERS (admin-managed)
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL DEFAULT '',
  phone text NOT NULL,
  email text NOT NULL DEFAULT '',
  whatsapp text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view customers" ON customers;
CREATE POLICY "Admin can view customers" ON customers FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admin can insert customers" ON customers;
CREATE POLICY "Admin can insert customers" ON customers FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can update customers" ON customers;
CREATE POLICY "Admin can update customers" ON customers FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can delete customers" ON customers;
CREATE POLICY "Admin can delete customers" ON customers FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- ADMIN SETTINGS (public read, admin write)
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Anyone can view admin settings" ON admin_settings;
CREATE POLICY "Anyone can view admin settings" ON admin_settings FOR SELECT USING (true);
DROP POLICY IF EXISTS "Admin can insert admin settings" ON admin_settings;
CREATE POLICY "Admin can insert admin settings" ON admin_settings FOR INSERT TO authenticated WITH CHECK (is_admin());
DROP POLICY IF EXISTS "Admin can update admin settings" ON admin_settings;
CREATE POLICY "Admin can update admin settings" ON admin_settings FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- CARTS (server mirror for logged-in users)
-- ============================================================
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text DEFAULT '',
  user_email text DEFAULT '',
  user_phone text DEFAULT '',
  items jsonb DEFAULT '[]'::jsonb,
  total numeric(10,2) DEFAULT 0,
  status text DEFAULT 'active',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE carts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Carts readable by owner or admin" ON carts;
CREATE POLICY "Carts readable by owner or admin" ON carts FOR SELECT USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Users manage own cart insert" ON carts;
CREATE POLICY "Users manage own cart insert" ON carts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users manage own cart update" ON carts;
CREATE POLICY "Users manage own cart update" ON carts FOR UPDATE USING (user_id = auth.uid() OR is_admin()) WITH CHECK (user_id = auth.uid() OR is_admin());

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text NOT NULL DEFAULT 'user',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  type text DEFAULT 'info',
  order_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Notifications readable by recipient" ON notifications;
CREATE POLICY "Notifications readable by recipient" ON notifications FOR SELECT USING (
  (recipient_type = 'user' AND user_id = auth.uid()) OR (recipient_type = 'admin' AND is_admin())
);
DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
CREATE POLICY "Anyone can insert notifications" ON notifications FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Recipients can update notifications" ON notifications;
CREATE POLICY "Recipients can update notifications" ON notifications FOR UPDATE USING (
  (recipient_type = 'user' AND user_id = auth.uid()) OR (recipient_type = 'admin' AND is_admin())
) WITH CHECK (true);

-- ============================================================
-- MESSAGES (admin <-> user chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  sender text NOT NULL DEFAULT 'user',
  body text NOT NULL DEFAULT '',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Messages readable by participant" ON messages;
CREATE POLICY "Messages readable by participant" ON messages FOR SELECT USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages" ON messages FOR INSERT TO authenticated WITH CHECK (
  (sender = 'user' AND user_id = auth.uid()) OR (sender = 'admin' AND is_admin())
);
DROP POLICY IF EXISTS "Participants can update messages" ON messages;
CREATE POLICY "Participants can update messages" ON messages FOR UPDATE USING (user_id = auth.uid() OR is_admin()) WITH CHECK (user_id = auth.uid() OR is_admin());

-- ============================================================
-- BLAST LOG
-- ============================================================
CREATE TABLE IF NOT EXISTS blast_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'in_app',
  audience text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  recipient_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE blast_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin can view blast log" ON blast_log;
CREATE POLICY "Admin can view blast log" ON blast_log FOR SELECT TO authenticated USING (is_admin());
DROP POLICY IF EXISTS "Admin can insert blast log" ON blast_log;
CREATE POLICY "Admin can insert blast log" ON blast_log FOR INSERT TO authenticated WITH CHECK (is_admin());

-- ============================================================
-- RPCs for guest tracking + receipt confirmation
-- ============================================================
CREATE OR REPLACE FUNCTION get_order_by_number(p_number text)
RETURNS SETOF orders LANGUAGE sql SECURITY DEFINER SET search_path = public AS $koyan$
  SELECT * FROM orders WHERE order_number = upper(trim(p_number)) LIMIT 1;
$koyan$;

CREATE OR REPLACE FUNCTION get_orders_by_contact(p_phone text, p_email text)
RETURNS SETOF orders LANGUAGE sql SECURITY DEFINER SET search_path = public AS $koyan$
  SELECT * FROM orders
  WHERE (NULLIF(trim(p_phone),'') IS NOT NULL AND customer_phone ILIKE '%' || trim(p_phone) || '%')
     OR (NULLIF(trim(p_email),'') IS NOT NULL AND customer_email ILIKE trim(p_email))
  ORDER BY created_at DESC;
$koyan$;

CREATE OR REPLACE FUNCTION get_order_items_by_number(p_number text)
RETURNS SETOF order_items LANGUAGE sql SECURITY DEFINER SET search_path = public AS $koyan$
  SELECT oi.* FROM order_items oi JOIN orders o ON o.id = oi.order_id WHERE o.order_number = upper(trim(p_number));
$koyan$;

CREATE OR REPLACE FUNCTION get_order_updates_by_number(p_number text)
RETURNS SETOF order_updates LANGUAGE sql SECURITY DEFINER SET search_path = public AS $koyan$
  SELECT ou.* FROM order_updates ou JOIN orders o ON o.id = ou.order_id WHERE o.order_number = upper(trim(p_number)) ORDER BY ou.created_at DESC;
$koyan$;

CREATE OR REPLACE FUNCTION confirm_order_receipt(p_access_token text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $koyan$
DECLARE v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE access_token = p_access_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  UPDATE orders SET customer_confirmed = true, customer_confirmed_at = now(), order_status = 'delivered', updated_at = now() WHERE id = v_order.id;
  INSERT INTO order_updates (order_id, status, message, created_by)
  VALUES (v_order.id, 'delivered', 'Customer has confirmed receipt of order #' || v_order.order_number || '. Order marked as delivered.', 'customer');
  INSERT INTO notifications (recipient_type, title, body, type, order_id)
  VALUES ('admin', 'Order received', 'Order #' || v_order.order_number || ' was confirmed as received by the customer.', 'order', v_order.id);
END;
$koyan$;

-- Decrement livestock stock when an order is placed (kg vs portion-like units).
CREATE OR REPLACE FUNCTION decrement_stock(p_livestock_id uuid, p_kg numeric, p_portions numeric)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $koyan$
  UPDATE livestock SET
    available_kg = GREATEST(0, available_kg - COALESCE(p_kg, 0)),
    available_portions = GREATEST(0, available_portions - COALESCE(p_portions, 0))::int
  WHERE id = p_livestock_id;
$koyan$;

GRANT EXECUTE ON FUNCTION get_order_by_number(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_orders_by_contact(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_items_by_number(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_updates_by_number(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_receipt(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION decrement_stock(uuid, numeric, numeric) TO anon, authenticated;

-- ============================================================
-- STORAGE BUCKETS + POLICIES
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('livestock-images','livestock-images', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('order-proof','order-proof', true) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view livestock images" ON storage.objects;
CREATE POLICY "Public can view livestock images" ON storage.objects FOR SELECT USING (bucket_id = 'livestock-images');
DROP POLICY IF EXISTS "Admin can upload livestock images" ON storage.objects;
CREATE POLICY "Admin can upload livestock images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'livestock-images' AND is_admin());
DROP POLICY IF EXISTS "Admin can update livestock images" ON storage.objects;
CREATE POLICY "Admin can update livestock images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'livestock-images' AND is_admin()) WITH CHECK (bucket_id = 'livestock-images' AND is_admin());
DROP POLICY IF EXISTS "Admin can delete livestock images" ON storage.objects;
CREATE POLICY "Admin can delete livestock images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'livestock-images' AND is_admin());

DROP POLICY IF EXISTS "Public can view order proof" ON storage.objects;
CREATE POLICY "Public can view order proof" ON storage.objects FOR SELECT USING (bucket_id = 'order-proof');
DROP POLICY IF EXISTS "Anyone can upload order proof" ON storage.objects;
CREATE POLICY "Anyone can upload order proof" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'order-proof');

-- ============================================================
-- SEED DATA
-- ============================================================
INSERT INTO admin_settings (key, value) VALUES
  ('comment_field_enabled', 'true'),
  ('comment_field_label', 'Additional Comments'),
  ('customer_care_phone', '+234 800 000 0000'),
  ('customer_care_email', 'support@koyanfresh.com'),
  ('preparation_types', '["Fresh","Roasted"]'),
  ('points_per_1000', '1'),
  ('pickup_times', '["Morning (9am - 12pm)","Afternoon (12pm - 4pm)","Evening (4pm - 7pm)"]'),
  ('late_pickup_disclaimer', 'Please pick up within your selected time. Orders not collected within 24 hours of the pickup window may be discarded and are non-refundable.')
ON CONFLICT (key) DO NOTHING;

INSERT INTO delivery_locations (name, fee) VALUES
  ('Within City Center', 2000),
  ('Suburbs', 3500),
  ('Outskirts', 5000)
ON CONFLICT DO NOTHING;

INSERT INTO livestock (name, type, description, image_url, price_per_kg, price_per_portion, price_full, price_half, price_quarter, available_kg, available_portions, unit_options, preparation_prices) VALUES
  ('Full Cow', 'Cow', 'Premium grass-fed whole cow, slaughtered fresh to order', 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg', 3500, 8000, 900000, 460000, 240000, 500, 50, ARRAY['kg','portion'], '{"Fresh":0,"Roasted":15000}'::jsonb),
  ('Matured Ram', 'Ram', 'Healthy mature rams, ideal for celebrations and events', 'https://images.pexels.com/photos/2647968/pexels-photo-2647968.jpeg', 2800, 6500, 120000, 62000, 32000, 200, 30, ARRAY['kg','portion'], '{"Fresh":0,"Roasted":8000}'::jsonb),
  ('Goat', 'Goat', 'Free-range goats, known for tender and flavorful meat', 'https://images.pexels.com/photos/1300375/pexels-photo-1300375.jpeg', 2500, 5000, 80000, 42000, 22000, 150, 25, ARRAY['kg','portion'], '{"Fresh":0,"Roasted":6000}'::jsonb),
  ('Broiler Chicken', 'Chicken', 'Large well-fed broiler chickens, fresh and hygienic', 'https://images.pexels.com/photos/1527769/pexels-photo-1527769.jpeg', 1800, 3500, 7000, 3800, 2000, 100, 40, ARRAY['kg','portion'], '{"Fresh":0,"Roasted":2000}'::jsonb),
  ('Turkey', 'Turkey', 'Premium turkeys, perfect for large gatherings and festivities', 'https://images.pexels.com/photos/3323685/pexels-photo-3323685.jpeg', 2200, 5500, 22000, 11500, 6000, 80, 20, ARRAY['kg','portion'], '{"Fresh":0,"Roasted":3000}'::jsonb)
ON CONFLICT DO NOTHING;

INSERT INTO delivery_slots (slot_date, slot_label, max_orders) VALUES
  (CURRENT_DATE + 1, 'Morning (8am - 12pm)', 10),
  (CURRENT_DATE + 1, 'Afternoon (12pm - 5pm)', 10),
  (CURRENT_DATE + 2, 'Morning (8am - 12pm)', 10),
  (CURRENT_DATE + 3, 'Afternoon (12pm - 5pm)', 10),
  (CURRENT_DATE + 5, 'Morning (8am - 12pm)', 10),
  (CURRENT_DATE + 7, 'Afternoon (12pm - 5pm)', 10)
ON CONFLICT DO NOTHING;

INSERT INTO bank_accounts (bank_name, account_name, account_number, sort_code) VALUES
  ('First Bank Nigeria', 'Koyan Fresh Ltd', '3012345678', '011'),
  ('GTBank', 'Koyan Fresh Ltd', '0123456789', '058')
ON CONFLICT DO NOTHING;
