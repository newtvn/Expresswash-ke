-- Warehouse intake must be able to read the items belonging to orders it can
-- already read. Without this, the order search succeeds but item details are
-- silently filtered by RLS and staff must re-enter them manually.
DROP POLICY IF EXISTS "Warehouse staff can read order items" ON public.order_items;
CREATE POLICY "Warehouse staff can read order items" ON public.order_items
  FOR SELECT TO authenticated
  USING (public.is_warehouse_staff());
