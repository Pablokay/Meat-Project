/*
  # Update Livestock RLS for Admin Access

  1. Security Changes
    - Replace the restrictive SELECT policy on livestock so authenticated admins can see all records
    - Keep public read for available livestock
    - Add a separate policy for authenticated users to see all livestock
*/

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Anyone can view available livestock" ON livestock;

-- Public can only see available livestock
CREATE POLICY "Public can view available livestock"
  ON livestock FOR SELECT
  USING (is_available = true);

-- Authenticated admins can see all livestock
CREATE POLICY "Admin can view all livestock"
  ON livestock FOR SELECT
  TO authenticated
  USING (true);
