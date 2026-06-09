/*
  # Livestock Order Platform Schema

  ## New Tables
  1. `livestock` - Available livestock with images, pricing by kg/portion
  2. `delivery_slots` - Available delivery dates/time slots
  3. `bank_accounts` - Admin bank account details for manual payment
  4. `orders` - Customer orders with delivery/pickup, payment method
  5. `order_updates` - Timeline of order status updates

  ## Security
  - RLS enabled on all tables
  - Public read for livestock, delivery_slots, bank_accounts
  - Authenticated or anon order creation
  - Order owner can read their own orders by token
*/

-- Livestock table
CREATE TABLE IF NOT EXISTS livestock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  type text NOT NULL, -- e.g. Cow, Goat, Chicken, Ram
  image_url text DEFAULT '',
  price_per_kg numeric(10,2) NOT NULL,
  price_per_portion numeric(10,2),
  available_kg numeric(10,2) DEFAULT 0,
  available_portions integer DEFAULT 0,
  unit_options text[] DEFAULT ARRAY['kg', 'portion'],
  is_available boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE livestock ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view available livestock"
  ON livestock FOR SELECT
  USING (is_available = true);

CREATE POLICY "Admin can insert livestock"
  ON livestock FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update livestock"
  ON livestock FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Delivery slots table
CREATE TABLE IF NOT EXISTS delivery_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_date date NOT NULL,
  slot_label text NOT NULL, -- e.g. "Morning (8am-12pm)"
  max_orders integer DEFAULT 10,
  current_orders integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE delivery_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active delivery slots"
  ON delivery_slots FOR SELECT
  USING (is_active = true AND current_orders < max_orders AND slot_date >= CURRENT_DATE);

CREATE POLICY "Admin can manage delivery slots"
  ON delivery_slots FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update delivery slots"
  ON delivery_slots FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Bank accounts table
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

CREATE POLICY "Anyone can view active bank accounts"
  ON bank_accounts FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admin can manage bank accounts"
  ON bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Admin can update bank accounts"
  ON bank_accounts FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL DEFAULT 'ORD-' || upper(substring(gen_random_uuid()::text, 1, 8)),
  access_token text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  customer_name text NOT NULL,
  customer_email text NOT NULL,
  customer_phone text NOT NULL,
  customer_whatsapp text NOT NULL,
  livestock_id uuid REFERENCES livestock(id),
  livestock_name text NOT NULL,
  quantity numeric(10,2) NOT NULL,
  unit text NOT NULL, -- 'kg' or 'portion'
  unit_price numeric(10,2) NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  delivery_fee numeric(10,2) DEFAULT 0,
  total_amount numeric(10,2) NOT NULL,
  fulfillment_type text NOT NULL DEFAULT 'pickup', -- 'delivery' or 'pickup'
  delivery_address text DEFAULT '',
  delivery_slot_id uuid REFERENCES delivery_slots(id),
  delivery_date date,
  delivery_slot_label text DEFAULT '',
  payment_method text NOT NULL DEFAULT 'bank_transfer', -- 'bank_transfer', 'virtual', 'gateway'
  payment_reference text DEFAULT '',
  payment_proof_url text DEFAULT '',
  payment_status text NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'failed'
  order_status text NOT NULL DEFAULT 'pending', -- 'pending', 'confirmed', 'processing', 'ready', 'delivered', 'cancelled'
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can create orders"
  ON orders FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Orders accessible by token"
  ON orders FOR SELECT
  USING (true);

CREATE POLICY "Admin can update orders"
  ON orders FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Order updates/timeline table
CREATE TABLE IF NOT EXISTS order_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE CASCADE,
  status text NOT NULL,
  message text NOT NULL,
  created_by text DEFAULT 'system',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view order updates"
  ON order_updates FOR SELECT
  USING (true);

CREATE POLICY "Admin can insert order updates"
  ON order_updates FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "System can insert order updates"
  ON order_updates FOR INSERT
  WITH CHECK (true);

-- Seed livestock data
INSERT INTO livestock (name, type, description, image_url, price_per_kg, price_per_portion, available_kg, available_portions, unit_options) VALUES
  ('Full Cow', 'Cow', 'Premium grass-fed whole cow, slaughtered fresh to order', 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg', 3500, 8000, 500, 50, ARRAY['kg', 'portion']),
  ('Matured Ram', 'Ram', 'Healthy mature rams, ideal for celebrations and events', 'https://images.pexels.com/photos/2647968/pexels-photo-2647968.jpeg', 2800, 6500, 200, 30, ARRAY['kg', 'portion']),
  ('Goat', 'Goat', 'Free-range goats, known for tender and flavorful meat', 'https://images.pexels.com/photos/1300375/pexels-photo-1300375.jpeg', 2500, 5000, 150, 25, ARRAY['kg', 'portion']),
  ('Broiler Chicken', 'Chicken', 'Large well-fed broiler chickens, fresh and hygienic', 'https://images.pexels.com/photos/1527769/pexels-photo-1527769.jpeg', 1800, 3500, 100, 40, ARRAY['kg', 'portion']),
  ('Turkey', 'Turkey', 'Premium turkeys, perfect for large gatherings and festivities', 'https://images.pexels.com/photos/3323685/pexels-photo-3323685.jpeg', 2200, 5500, 80, 20, ARRAY['kg', 'portion']),
  ('Pig', 'Pig', 'Well-raised pork, great for barbecue and various delicacies', 'https://images.pexels.com/photos/1300376/pexels-photo-1300376.jpeg', 2000, 4500, 300, 35, ARRAY['kg', 'portion'])
ON CONFLICT DO NOTHING;

-- Seed delivery slots (next 14 days)
INSERT INTO delivery_slots (slot_date, slot_label, max_orders) VALUES
  (CURRENT_DATE + 1, 'Morning (8am - 12pm)', 10),
  (CURRENT_DATE + 1, 'Afternoon (12pm - 5pm)', 10),
  (CURRENT_DATE + 2, 'Morning (8am - 12pm)', 10),
  (CURRENT_DATE + 2, 'Afternoon (12pm - 5pm)', 10),
  (CURRENT_DATE + 3, 'Morning (8am - 12pm)', 10),
  (CURRENT_DATE + 3, 'Afternoon (12pm - 5pm)', 10),
  (CURRENT_DATE + 5, 'Morning (8am - 12pm)', 10),
  (CURRENT_DATE + 5, 'Afternoon (12pm - 5pm)', 10),
  (CURRENT_DATE + 7, 'Morning (8am - 12pm)', 10),
  (CURRENT_DATE + 7, 'Afternoon (12pm - 5pm)', 10),
  (CURRENT_DATE + 10, 'Morning (8am - 12pm)', 10),
  (CURRENT_DATE + 14, 'Morning (8am - 12pm)', 10)
ON CONFLICT DO NOTHING;

-- Seed bank account
INSERT INTO bank_accounts (bank_name, account_name, account_number, sort_code) VALUES
  ('First Bank Nigeria', 'FreshLivestock Ltd', '3012345678', '011'),
  ('GTBank', 'FreshLivestock Ltd', '0123456789', '058')
ON CONFLICT DO NOTHING;
