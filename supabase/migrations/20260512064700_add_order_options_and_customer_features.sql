/*
  # Add order options, customer confirmation, and admin settings

  1. New Tables
    - `customers` - Customer phone/email records managed by admin
    - `admin_settings` - Admin-configurable settings (comment field toggle)

  2. Modified Tables
    - `orders` - Added columns:
      - `preparation_type` (text) - 'roasted' or 'fresh'
      - `portion_size` (text) - 'full', 'half', 'quarter'
      - `customer_comment` (text) - Optional comment from customer
      - `customer_confirmed` (boolean) - Whether customer confirmed delivery
      - `customer_confirmed_at` (timestamptz) - When customer confirmed

  3. Security
    - RLS enabled on new tables
    - Public read/write for customers table and admin_settings
    - Orders can be updated by customer for confirmation
*/

-- Add new columns to orders table
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'preparation_type') THEN
    ALTER TABLE orders ADD COLUMN preparation_type text DEFAULT 'fresh';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'portion_size') THEN
    ALTER TABLE orders ADD COLUMN portion_size text DEFAULT 'full';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_comment') THEN
    ALTER TABLE orders ADD COLUMN customer_comment text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_confirmed') THEN
    ALTER TABLE orders ADD COLUMN customer_confirmed boolean DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'customer_confirmed_at') THEN
    ALTER TABLE orders ADD COLUMN customer_confirmed_at timestamptz;
  END IF;
END $$;

-- Create customers table for admin-managed customer info
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

CREATE POLICY "Anyone can view customers"
  ON customers FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert customers"
  ON customers FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update customers"
  ON customers FOR UPDATE
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Anyone can delete customers"
  ON customers FOR DELETE
  USING (true);

-- Create admin_settings table
CREATE TABLE IF NOT EXISTS admin_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view admin settings"
  ON admin_settings FOR SELECT
  USING (true);

CREATE POLICY "Anyone can insert admin settings"
  ON admin_settings FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update admin settings"
  ON admin_settings FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Seed default settings
INSERT INTO admin_settings (key, value) VALUES
  ('comment_field_enabled', 'true'),
  ('comment_field_label', 'Additional Comments')
ON CONFLICT (key) DO NOTHING;
