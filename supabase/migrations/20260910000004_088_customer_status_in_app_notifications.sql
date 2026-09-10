-- Create customer in-app status notifications inside the database transaction.
-- Browser users cannot safely insert-and-return notifications belonging to a
-- different user under RLS, and notification delivery must not depend on a
-- particular page remaining open after the order update.
CREATE OR REPLACE FUNCTION public.notify_customer_in_app_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type TEXT;
  v_title TEXT;
  v_message TEXT;
BEGIN
  IF OLD.status = NEW.status OR NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status_type, title, message
  INTO v_type, v_title, v_message
  FROM (
    VALUES
      (3,  'driver_assigned',    'Driver Assigned',   'A driver has been assigned to order ' || NEW.tracking_code || '.'),
      (4,  'pickup_scheduled',   'Pickup Scheduled',  'Pickup has been scheduled for order ' || NEW.tracking_code || '.'),
      (5,  'picked_up',          'Items Picked Up',    'Your items for order ' || NEW.tracking_code || ' have been collected and are on their way to our facility.'),
      (6,  'in_processing',      'Cleaning Started',  'Your items for order ' || NEW.tracking_code || ' are now being cleaned.'),
      (10, 'ready_for_delivery', 'Ready for Delivery','Your items for order ' || NEW.tracking_code || ' are clean and ready for delivery.'),
      (11, 'out_for_delivery',   'Out for Delivery',  'Your items for order ' || NEW.tracking_code || ' are on their way.'),
      (12, 'delivered',          'Order Delivered',   'Order ' || NEW.tracking_code || ' has been delivered. We hope you love the results!')
  ) AS notification(status_code, status_type, title, message)
  WHERE status_code = NEW.status;

  IF v_type IS NULL THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    order_id,
    tracking_code,
    read,
    created_at
  ) VALUES (
    NEW.customer_id,
    v_type,
    v_title,
    v_message,
    NEW.id,
    NEW.tracking_code,
    FALSE,
    NOW()
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS notify_customer_in_app_on_status ON public.orders;
CREATE TRIGGER notify_customer_in_app_on_status
  AFTER UPDATE OF status ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_customer_in_app_status_change();

REVOKE ALL ON FUNCTION public.notify_customer_in_app_status_change() FROM PUBLIC, anon, authenticated;
