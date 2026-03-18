-- ============================================================
-- Migration: Order status transition validation trigger
--
-- Prevents invalid status jumps at the database level.
-- Uses the 14-stage pipeline matching src/constants/orderStatus.ts:
--   1=PENDING, 2=CONFIRMED, 3=DRIVER_ASSIGNED, 4=PICKUP_SCHEDULED,
--   5=PICKED_UP, 6=IN_PROCESSING, 7=PROCESSING_COMPLETE,
--   8=QUALITY_CHECK, 9=QUALITY_APPROVED, 10=READY_FOR_DELIVERY,
--   11=OUT_FOR_DELIVERY, 12=DELIVERED, 13=CANCELLED, 14=REFUNDED
--
-- Note: 8→6 allows QC failure to send items back to processing.
-- Cancellation is allowed from statuses 1-4 only.
-- Refund is only from delivered (12).
-- ============================================================

CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS trigger AS $$
DECLARE
  transitions JSONB := '{
    "1":  [2, 13],
    "2":  [3, 13],
    "3":  [4, 13],
    "4":  [5, 13],
    "5":  [6],
    "6":  [7],
    "7":  [8],
    "8":  [9, 6],
    "9":  [10],
    "10": [11],
    "11": [12],
    "12": [14],
    "13": [],
    "14": []
  }'::JSONB;
  allowed JSONB;
  is_valid BOOLEAN := false;
  i INTEGER;
BEGIN
  -- Skip if status didn't change
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Get allowed transitions for current status
  allowed := transitions->(OLD.status::TEXT);

  IF allowed IS NULL THEN
    RAISE EXCEPTION 'Unknown current status: %. Cannot determine valid transitions.', OLD.status;
  END IF;

  -- Check if new status is in allowed list
  FOR i IN 0..jsonb_array_length(allowed) - 1 LOOP
    IF (allowed->i)::INTEGER = NEW.status THEN
      is_valid := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT is_valid THEN
    RAISE EXCEPTION 'Invalid status transition: % → %. Allowed transitions from % are: %',
      OLD.status, NEW.status, OLD.status, allowed;
  END IF;

  -- Auto-set SLA deadline when order is confirmed (1 → 2)
  IF NEW.status = 2 AND OLD.status = 1 THEN
    NEW.sla_deadline := NOW() + INTERVAL '48 hours';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS validate_order_status ON orders;

CREATE TRIGGER validate_order_status
  BEFORE UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION validate_order_status_transition();
