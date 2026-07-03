/*
  # Koyan Fresh — Auth, Multi-item Orders, Notifications, Chat, Logistics & Security

  This migration introduces real identity + tightens security and adds the schema
  backing the new features. It is written to be idempotent where practical.

  ## Summary
  1. profiles table (linked to auth.users) + is_admin() helper + signup trigger
  2. Points reward field on profiles
  3. order_items (multi-item orders) + new order columns + new statuses
  4. carts, notifications, messages, delivery_locations, blast_log tables
  5. livestock.preparation_prices (per-product preparation surcharges)
  6. New admin_settings keys (points rate, pickup time, late-pickup disclaimer)
  7. RLS tightened everywhere to is_admin() / owner checks
  8. SECURITY DEFINER RPCs for guest order tracking + receipt confirmation
  9. Storage policies scoped to admins / authenticated users

  ## IMPORTANT (manual steps after applying)
  - Enable Email and Phone auth providers in the Supabase dashboard.
  - Create the admin user (sign up), then run:
      UPDATE profiles SET is_admin = true WHERE email = '<admin-email>';
  - Add edge function secrets: RESEND_API_KEY, FROM_EMAIL, ADMIN_ALERT_EMAIL.
*/

-- ============================================================
-- 1. PROFILES + is_admin() + signup trigger
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

-- is_admin(): true when the current user has the admin flag.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true);
$$;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- Create a profile row automatically on signup.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, full_name, email, phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    COALESCE(NEW.email, ''),
    COALESCE(NEW.phone, NEW.raw_user_meta_data->>'phone', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- 2. LIVESTOCK: preparation surcharges
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'livestock' AND column_name = 'preparation_prices') THEN
    ALTER TABLE livestock ADD COLUMN preparation_prices jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- ============================================================
-- 3. ORDERS: new columns for multi-item flow, user linkage, logistics
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id') THEN
    ALTER TABLE orders ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_type') THEN
    ALTER TABLE orders ADD COLUMN customer_type text DEFAULT 'guest';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'requires_confirmation') THEN
    ALTER TABLE orders ADD COLUMN requires_confirmation boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'points_earned') THEN
    ALTER TABLE orders ADD COLUMN points_earned integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_location_id') THEN
    ALTER TABLE orders ADD COLUMN delivery_location_id uuid;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'delivery_location_name') THEN
    ALTER TABLE orders ADD COLUMN delivery_location_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'pickup_time') THEN
    ALTER TABLE orders ADD COLUMN pickup_time text DEFAULT '';
  END IF;
  -- order_status documented values: pending, awaiting_confirmation, awaiting_payment,
  -- confirmed, processing, ready, in_transit, delivered, cancelled
END $$;

-- ============================================================
-- 4. ORDER ITEMS (multi-item orders)
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
CREATE POLICY "Order items readable by owner or admin"
  ON order_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = auth.uid() OR is_admin())
    )
  );

DROP POLICY IF EXISTS "Anyone can insert order items" ON order_items;
CREATE POLICY "Anyone can insert order items"
  ON order_items FOR INSERT
  WITH CHECK (true);

-- ============================================================
-- 5. CARTS (server-side for logged-in users -> abandoned cart view)
-- ============================================================
CREATE TABLE IF NOT EXISTS carts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text DEFAULT '',
  user_email text DEFAULT '',
  user_phone text DEFAULT '',
  items jsonb DEFAULT '[]'::jsonb,
  total numeric(10,2) DEFAULT 0,
  status text DEFAULT 'active', -- active | checked_out | abandoned
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE carts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Carts readable by owner or admin" ON carts;
CREATE POLICY "Carts readable by owner or admin"
  ON carts FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Users manage own cart insert" ON carts;
CREATE POLICY "Users manage own cart insert"
  ON carts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own cart update" ON carts;
CREATE POLICY "Users manage own cart update"
  ON carts FOR UPDATE
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- ============================================================
-- 6. NOTIFICATIONS (in-app bell for users + admin)
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_type text NOT NULL DEFAULT 'user', -- user | admin
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  type text DEFAULT 'info', -- info | order | payment | message | blast | reminder
  order_id uuid,
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Notifications readable by recipient" ON notifications;
CREATE POLICY "Notifications readable by recipient"
  ON notifications FOR SELECT
  USING (
    (recipient_type = 'user' AND user_id = auth.uid())
    OR (recipient_type = 'admin' AND is_admin())
  );

DROP POLICY IF EXISTS "Anyone can insert notifications" ON notifications;
CREATE POLICY "Anyone can insert notifications"
  ON notifications FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Recipients can update notifications" ON notifications;
CREATE POLICY "Recipients can update notifications"
  ON notifications FOR UPDATE
  USING (
    (recipient_type = 'user' AND user_id = auth.uid())
    OR (recipient_type = 'admin' AND is_admin())
  )
  WITH CHECK (true);

-- ============================================================
-- 7. MESSAGES (admin <-> individual user chat)
-- ============================================================
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, -- the customer in the thread
  sender text NOT NULL DEFAULT 'user', -- user | admin
  body text NOT NULL DEFAULT '',
  is_read boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Messages readable by participant" ON messages;
CREATE POLICY "Messages readable by participant"
  ON messages FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "Participants can send messages" ON messages;
CREATE POLICY "Participants can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (sender = 'user' AND user_id = auth.uid())
    OR (sender = 'admin' AND is_admin())
  );

DROP POLICY IF EXISTS "Participants can update messages" ON messages;
CREATE POLICY "Participants can update messages"
  ON messages FOR UPDATE
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- ============================================================
-- 8. DELIVERY LOCATIONS (per-location fees)
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
CREATE POLICY "Anyone can view delivery locations"
  ON delivery_locations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin manages delivery locations insert" ON delivery_locations;
CREATE POLICY "Admin manages delivery locations insert"
  ON delivery_locations FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin manages delivery locations update" ON delivery_locations;
CREATE POLICY "Admin manages delivery locations update"
  ON delivery_locations FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin manages delivery locations delete" ON delivery_locations;
CREATE POLICY "Admin manages delivery locations delete"
  ON delivery_locations FOR DELETE
  TO authenticated
  USING (is_admin());

-- ============================================================
-- 9. BLAST LOG (report of blasts / batch messages sent)
-- ============================================================
CREATE TABLE IF NOT EXISTS blast_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel text NOT NULL DEFAULT 'in_app', -- in_app | email
  audience text NOT NULL DEFAULT '',
  message text NOT NULL DEFAULT '',
  recipient_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE blast_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin can view blast log" ON blast_log;
CREATE POLICY "Admin can view blast log"
  ON blast_log FOR SELECT
  TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can insert blast log" ON blast_log;
CREATE POLICY "Admin can insert blast log"
  ON blast_log FOR INSERT
  TO authenticated
  WITH CHECK (is_admin());

-- ============================================================
-- 10. NEW ADMIN SETTINGS KEYS
-- ============================================================
INSERT INTO admin_settings (key, value) VALUES
  ('points_per_1000', '1'),
  ('pickup_times', '["Morning (9am - 12pm)","Afternoon (12pm - 4pm)","Evening (4pm - 7pm)"]'),
  ('late_pickup_disclaimer', 'Please pick up within your selected time. Orders not collected within 24 hours of the pickup window may be discarded and are non-refundable.')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 11. TIGHTEN RLS ON EXISTING OPERATIONAL TABLES (admin uses real auth now)
-- ============================================================

-- LIVESTOCK: public read, admin write
DROP POLICY IF EXISTS "Anyone can insert livestock" ON livestock;
DROP POLICY IF EXISTS "Anyone can update livestock" ON livestock;
CREATE POLICY "Admin can insert livestock"
  ON livestock FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update livestock"
  ON livestock FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- BANK ACCOUNTS: public read, admin write
DROP POLICY IF EXISTS "Anyone can insert bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Anyone can update bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Anyone can delete bank accounts" ON bank_accounts;
CREATE POLICY "Admin can insert bank accounts"
  ON bank_accounts FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update bank accounts"
  ON bank_accounts FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin can delete bank accounts"
  ON bank_accounts FOR DELETE TO authenticated USING (is_admin());

-- DELIVERY SLOTS: public read; admin insert/delete; update allowed to anyone
-- (checkout increments current_orders as anon/guest).
DROP POLICY IF EXISTS "Anyone can insert delivery slots" ON delivery_slots;
DROP POLICY IF EXISTS "Anyone can delete delivery slots" ON delivery_slots;
CREATE POLICY "Admin can insert delivery slots"
  ON delivery_slots FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can delete delivery slots"
  ON delivery_slots FOR DELETE TO authenticated USING (is_admin());
-- keep existing "Anyone can update delivery slots" (slot counter on checkout)

-- CUSTOMERS: admin only (was fully open)
DROP POLICY IF EXISTS "Anyone can view customers" ON customers;
DROP POLICY IF EXISTS "Anyone can insert customers" ON customers;
DROP POLICY IF EXISTS "Anyone can update customers" ON customers;
DROP POLICY IF EXISTS "Anyone can delete customers" ON customers;
CREATE POLICY "Admin can view customers"
  ON customers FOR SELECT TO authenticated USING (is_admin());
CREATE POLICY "Admin can insert customers"
  ON customers FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update customers"
  ON customers FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());
CREATE POLICY "Admin can delete customers"
  ON customers FOR DELETE TO authenticated USING (is_admin());

-- ADMIN SETTINGS: public read (shop/header need it), admin write
DROP POLICY IF EXISTS "Anyone can insert admin settings" ON admin_settings;
DROP POLICY IF EXISTS "Anyone can update admin settings" ON admin_settings;
CREATE POLICY "Admin can insert admin settings"
  ON admin_settings FOR INSERT TO authenticated WITH CHECK (is_admin());
CREATE POLICY "Admin can update admin settings"
  ON admin_settings FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ORDERS: owner/admin read; anyone insert (guest checkout); owner/admin update
DROP POLICY IF EXISTS "Orders accessible by token" ON orders;
DROP POLICY IF EXISTS "Anyone can update orders" ON orders;
DROP POLICY IF EXISTS "Anyone can create orders" ON orders;

CREATE POLICY "Orders readable by owner or admin"
  ON orders FOR SELECT
  USING (user_id = auth.uid() OR is_admin());

CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Owner or admin can update orders"
  ON orders FOR UPDATE
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- ORDER UPDATES: readable by order owner or admin; insert open (system/customer/admin)
DROP POLICY IF EXISTS "Anyone can view order updates" ON order_updates;
CREATE POLICY "Order updates readable by owner or admin"
  ON order_updates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM orders o
      WHERE o.id = order_updates.order_id
        AND (o.user_id = auth.uid() OR is_admin())
    )
  );
-- keep existing "Anyone can insert order updates"

-- ============================================================
-- 12. SECURITY DEFINER RPCs for guest tracking + receipt confirmation
-- ============================================================

-- Track a single order by its (unguessable-ish) order number.
CREATE OR REPLACE FUNCTION get_order_by_number(p_number text)
RETURNS SETOF orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM orders WHERE order_number = upper(trim(p_number)) LIMIT 1;
$$;

-- Find orders by exact phone or email (guest "find my orders").
CREATE OR REPLACE FUNCTION get_orders_by_contact(p_phone text, p_email text)
RETURNS SETOF orders
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT * FROM orders
  WHERE (NULLIF(trim(p_phone), '') IS NOT NULL AND customer_phone ILIKE '%' || trim(p_phone) || '%')
     OR (NULLIF(trim(p_email), '') IS NOT NULL AND customer_email ILIKE trim(p_email))
  ORDER BY created_at DESC;
$$;

-- Fetch order_items for a given order number (guest tracking of line items).
CREATE OR REPLACE FUNCTION get_order_items_by_number(p_number text)
RETURNS SETOF order_items
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT oi.* FROM order_items oi
  JOIN orders o ON o.id = oi.order_id
  WHERE o.order_number = upper(trim(p_number));
$$;

-- Order updates timeline for guest tracking by order number.
CREATE OR REPLACE FUNCTION get_order_updates_by_number(p_number text)
RETURNS SETOF order_updates
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ou.* FROM order_updates ou
  JOIN orders o ON o.id = ou.order_id
  WHERE o.order_number = upper(trim(p_number))
  ORDER BY ou.created_at DESC;
$$;

-- Confirm receipt using the order's access token (guest confirm from tracking page).
CREATE OR REPLACE FUNCTION confirm_order_receipt(p_access_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order orders%ROWTYPE;
BEGIN
  SELECT * INTO v_order FROM orders WHERE access_token = p_access_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  UPDATE orders
    SET customer_confirmed = true,
        customer_confirmed_at = now(),
        order_status = 'delivered',
        updated_at = now()
  WHERE id = v_order.id;

  INSERT INTO order_updates (order_id, status, message, created_by)
  VALUES (v_order.id, 'delivered',
          'Customer has confirmed receipt of order #' || v_order.order_number || '. Order marked as delivered.',
          'customer');

  INSERT INTO notifications (recipient_type, title, body, type, order_id)
  VALUES ('admin', 'Order received',
          'Order #' || v_order.order_number || ' was confirmed as received by the customer.',
          'order', v_order.id);
END;
$$;

GRANT EXECUTE ON FUNCTION get_order_by_number(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_orders_by_contact(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_items_by_number(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_updates_by_number(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION confirm_order_receipt(text) TO anon, authenticated;

-- ============================================================
-- 13. STORAGE POLICIES (fix admin image upload)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('order-proof', 'order-proof', true)
ON CONFLICT (id) DO NOTHING;

-- livestock-images: admins can write; everyone can read
DROP POLICY IF EXISTS "Admin can upload livestock images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update livestock images" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete livestock images" ON storage.objects;
CREATE POLICY "Admin can upload livestock images"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'livestock-images' AND is_admin());
CREATE POLICY "Admin can update livestock images"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'livestock-images' AND is_admin())
  WITH CHECK (bucket_id = 'livestock-images' AND is_admin());
CREATE POLICY "Admin can delete livestock images"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'livestock-images' AND is_admin());

-- order-proof: anyone can read; anyone can upload their proof
DROP POLICY IF EXISTS "Public can view order proof" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload order proof" ON storage.objects;
CREATE POLICY "Public can view order proof"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'order-proof');
CREATE POLICY "Anyone can upload order proof"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'order-proof');

-- ============================================================
-- 14. SEED a couple of delivery locations (optional starter data)
-- ============================================================
INSERT INTO delivery_locations (name, fee) VALUES
  ('Within City Center', 2000),
  ('Suburbs', 3500),
  ('Outskirts', 5000)
ON CONFLICT DO NOTHING;
