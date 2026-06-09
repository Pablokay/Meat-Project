/*
  # Add portion pricing and customer care settings

  1. Modified Tables
    - `livestock` - Added columns:
      - `price_full` (numeric) - Price for full portion
      - `price_half` (numeric) - Price for half portion
      - `price_quarter` (numeric) - Price for quarter portion

  2. New Settings
    - `admin_settings` rows:
      - `customer_care_phone` - Customer care phone number
      - `customer_care_email` - Customer care email address

  3. Security
    - No new tables, existing RLS policies apply
*/

-- Add portion price columns to livestock
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'livestock' AND column_name = 'price_full') THEN
    ALTER TABLE livestock ADD COLUMN price_full numeric(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'livestock' AND column_name = 'price_half') THEN
    ALTER TABLE livestock ADD COLUMN price_half numeric(10,2);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'livestock' AND column_name = 'price_quarter') THEN
    ALTER TABLE livestock ADD COLUMN price_quarter numeric(10,2);
  END IF;
END $$;

-- Seed customer care settings
INSERT INTO admin_settings (key, value) VALUES
  ('customer_care_phone', '+234 800 000 0000'),
  ('customer_care_email', 'support@freshlivestock.com')
ON CONFLICT (key) DO NOTHING;
