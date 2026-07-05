/*
  # Phase 1 — customer account features
  Run once in the SQL editor of your project (idempotent).
  Adds: wishlist (favorites), saved addresses, points-redemption columns, settings.
*/

-- Wishlist ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  livestock_id uuid REFERENCES livestock(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, livestock_id)
);
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Favorites owned by user" ON favorites;
CREATE POLICY "Favorites owned by user" ON favorites FOR SELECT USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Users add favorites" ON favorites;
CREATE POLICY "Users add favorites" ON favorites FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users remove favorites" ON favorites;
CREATE POLICY "Users remove favorites" ON favorites FOR DELETE USING (user_id = auth.uid());

-- Saved addresses ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  label text DEFAULT 'Home',
  address text NOT NULL,
  phone text DEFAULT '',
  is_default boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE saved_addresses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Addresses owned by user" ON saved_addresses;
CREATE POLICY "Addresses owned by user" ON saved_addresses FOR SELECT USING (user_id = auth.uid() OR is_admin());
DROP POLICY IF EXISTS "Users insert addresses" ON saved_addresses;
CREATE POLICY "Users insert addresses" ON saved_addresses FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users update addresses" ON saved_addresses;
CREATE POLICY "Users update addresses" ON saved_addresses FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "Users delete addresses" ON saved_addresses;
CREATE POLICY "Users delete addresses" ON saved_addresses FOR DELETE USING (user_id = auth.uid());

-- Orders: points redemption ----------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='points_redeemed') THEN
    ALTER TABLE orders ADD COLUMN points_redeemed integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='discount_amount') THEN
    ALTER TABLE orders ADD COLUMN discount_amount numeric(10,2) DEFAULT 0;
  END IF;
END $$;

-- Settings ----------------------------------------------------------------
INSERT INTO admin_settings (key, value) VALUES
  ('point_value_naira', '10'),
  ('paystack_enabled', 'false'),
  ('paystack_public_key', ''),
  ('low_stock_threshold', '10')
ON CONFLICT (key) DO NOTHING;

-- Spend points atomically (deduct from profile) ---------------------------
CREATE OR REPLACE FUNCTION redeem_points(p_user_id uuid, p_points integer)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $koyan$
DECLARE v_current integer;
BEGIN
  SELECT points INTO v_current FROM profiles WHERE id = p_user_id FOR UPDATE;
  IF v_current IS NULL OR v_current < p_points OR p_points <= 0 THEN
    RETURN 0; -- nothing redeemed
  END IF;
  UPDATE profiles SET points = points - p_points WHERE id = p_user_id;
  RETURN p_points;
END;
$koyan$;
GRANT EXECUTE ON FUNCTION redeem_points(uuid, integer) TO authenticated;
