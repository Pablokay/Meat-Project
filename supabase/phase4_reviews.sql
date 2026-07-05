/*
  # Phase 4 — genuine product reviews
  Only customers with a DELIVERED order for an item can review it (enforced in
  submit_review). Reviews are publicly readable so the shop can show ratings.
  Run once in the SQL editor (idempotent).
*/

CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  livestock_id uuid REFERENCES livestock(id) ON DELETE CASCADE,
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text DEFAULT '',
  customer_name text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE (user_id, livestock_id, order_id)
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read reviews" ON reviews;
CREATE POLICY "Anyone can read reviews" ON reviews FOR SELECT USING (true);
-- No direct INSERT/UPDATE policy: writes go through submit_review() only.

CREATE OR REPLACE FUNCTION submit_review(p_livestock_id uuid, p_order_id uuid, p_rating integer, p_comment text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $koyan$
DECLARE v_ok boolean; v_name text; v_id uuid;
BEGIN
  IF p_rating < 1 OR p_rating > 5 THEN RAISE EXCEPTION 'Rating must be 1-5'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM orders o
    WHERE o.id = p_order_id
      AND o.user_id = auth.uid()
      AND o.order_status = 'delivered'
      AND (o.livestock_id = p_livestock_id
           OR EXISTS (SELECT 1 FROM order_items oi WHERE oi.order_id = o.id AND oi.livestock_id = p_livestock_id))
  ) INTO v_ok;
  IF NOT v_ok THEN RAISE EXCEPTION 'You can only review items from a delivered order'; END IF;

  SELECT full_name INTO v_name FROM profiles WHERE id = auth.uid();

  INSERT INTO reviews (user_id, livestock_id, order_id, rating, comment, customer_name)
  VALUES (auth.uid(), p_livestock_id, p_order_id, p_rating, COALESCE(p_comment, ''), COALESCE(v_name, 'Customer'))
  ON CONFLICT (user_id, livestock_id, order_id) DO UPDATE SET rating = EXCLUDED.rating, comment = EXCLUDED.comment
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$koyan$;
GRANT EXECUTE ON FUNCTION submit_review(uuid, uuid, integer, text) TO authenticated;
