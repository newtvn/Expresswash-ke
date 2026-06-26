-- ============================================================
-- Warehouse intake improvements:
-- 1. Allow warehouse staff to read orders (needed to look up order_id by tracking code)
-- 2. Allow warehouse staff to update order status (for stage transitions)
-- 3. Add image_url to warehouse_intake for item photos
-- 4. Create warehouse-images storage bucket
-- ============================================================

-- Warehouse staff need to look up orders by tracking code to get the order UUID
DROP POLICY IF EXISTS "Warehouse staff can read orders" ON orders;
CREATE POLICY "Warehouse staff can read orders" ON orders
  FOR SELECT TO authenticated USING (is_warehouse_staff());

-- Warehouse staff need to update order status when items move through stages
DROP POLICY IF EXISTS "Warehouse staff can update orders" ON orders;
CREATE POLICY "Warehouse staff can update orders" ON orders
  FOR UPDATE TO authenticated USING (is_warehouse_staff());

-- Add image_url column for intake item photos
ALTER TABLE warehouse_intake ADD COLUMN IF NOT EXISTS image_url TEXT;

-- Create warehouse-images storage bucket (public so images can be displayed)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'warehouse-images',
  'warehouse-images',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Warehouse staff and admins can upload images
DROP POLICY IF EXISTS "warehouse_staff_upload_images" ON storage.objects;
CREATE POLICY "warehouse_staff_upload_images" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'warehouse-images'
    AND (is_warehouse_staff() OR is_admin())
  );

-- Authenticated users can view warehouse images
DROP POLICY IF EXISTS "authenticated_read_warehouse_images" ON storage.objects;
CREATE POLICY "authenticated_read_warehouse_images" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'warehouse-images');

-- Anyone can view warehouse images (bucket is public for <img> tags)
DROP POLICY IF EXISTS "public_read_warehouse_images" ON storage.objects;
CREATE POLICY "public_read_warehouse_images" ON storage.objects
  FOR SELECT TO anon
  USING (bucket_id = 'warehouse-images');
