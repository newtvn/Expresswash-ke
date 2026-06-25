-- Fix: customers cannot cancel orders due to RLS policy violation
-- The old policy only allowed updates when status IN (1, 2) and had no explicit
-- WITH CHECK, so PostgreSQL reused USING for both — blocking status changes to 13 (CANCELLED).
-- Also, canCancelOrder() in the app allows cancellation up to status 4 (PICKUP_SCHEDULED),
-- but the RLS only allowed 1-2.

DROP POLICY IF EXISTS "Customers can update own pending orders" ON orders;

CREATE POLICY "Customers can update own pending orders" ON orders
  FOR UPDATE TO authenticated
  USING (customer_id = auth.uid() AND status IN (1, 2, 3, 4))
  WITH CHECK (customer_id = auth.uid() AND status IN (1, 2, 3, 4, 13));
