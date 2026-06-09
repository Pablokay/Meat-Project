/*
  # Add Supabase Storage for Livestock Images

  1. Storage
    - Create `livestock-images` bucket for admin image uploads
    - Public bucket so images are accessible without auth

  2. RLS Updates
    - Allow authenticated users to upload images
    - Allow public read access to images
*/

-- Insert the storage bucket via insert into storage.buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('livestock-images', 'livestock-images', true)
ON CONFLICT (id) DO NOTHING;

-- Allow anyone to read images
CREATE POLICY "Public can view livestock images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'livestock-images');

-- Allow authenticated users to upload images
CREATE POLICY "Admin can upload livestock images"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'livestock-images');

-- Allow authenticated users to update images
CREATE POLICY "Admin can update livestock images"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'livestock-images')
  WITH CHECK (bucket_id = 'livestock-images');

-- Allow authenticated users to delete images
CREATE POLICY "Admin can delete livestock images"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'livestock-images');
