/*
  # Simplify Livestock RLS - Allow all reads

  1. Security Changes
    - Allow anyone to read all livestock records (available or not)
    - The Shop page filters by is_available client-side
    - Write operations remain restricted to authenticated users
*/

-- Drop restrictive policies
DROP POLICY IF EXISTS "Public can view available livestock" ON livestock;
DROP POLICY IF EXISTS "Admin can view all livestock" ON livestock;

-- Anyone can read all livestock
CREATE POLICY "Anyone can view livestock"
  ON livestock FOR SELECT
  USING (true);
