/*
  # Add logo_url to livestock

  1. Modified Tables
    - `livestock` - Added column:
      - `logo_url` (text) - Logo/business image URL for the livestock listing
*/

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'livestock' AND column_name = 'logo_url') THEN
    ALTER TABLE livestock ADD COLUMN logo_url text DEFAULT '';
  END IF;
END $$;
