-- ============================================================
-- Fix order_items RLS: allow drivers to update measurements
-- during pickup (delete old items + insert updated ones)
-- ============================================================

-- Allow drivers assigned to the order to insert updated items
DROP POLICY IF EXISTS "Users can insert own order items" ON order_items;
CREATE POLICY "Users can insert own order items" ON order_items
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.customer_id = auth.uid() OR orders.driver_id = auth.uid() OR is_admin())
    )
  );

-- Allow drivers assigned to the order to delete items (for re-measurement)
CREATE POLICY "Assigned drivers can delete order items" ON order_items
  FOR DELETE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.driver_id = auth.uid() OR is_admin())
    )
  );

-- Allow drivers assigned to the order to update items
CREATE POLICY "Assigned drivers can update order items" ON order_items
  FOR UPDATE TO authenticated USING (
    EXISTS (
      SELECT 1 FROM orders
      WHERE orders.id = order_items.order_id
      AND (orders.driver_id = auth.uid() OR is_admin())
    )
  );
