-- ============================================================
-- Driver SMS notification templates and trigger
-- Sends SMS to drivers when they're assigned to orders
-- ============================================================

-- 1. Add SMS templates for driver events
INSERT INTO notification_templates (name, channel, subject, body, variables, is_active)
VALUES
  ('Driver Assignment SMS', 'sms', NULL,
   'Hi {{driverName}}, you have been assigned to order {{orderNumber}} in {{zone}}. {{itemCount}} items. Pickup: {{pickupAddress}}. Open the app for details.',
   ARRAY['driverName', 'orderNumber', 'zone', 'itemCount', 'pickupAddress'], true),
  ('Driver Pickup Reminder SMS', 'sms', NULL,
   'Reminder: Order {{orderNumber}} is scheduled for pickup today in {{zone}}. Customer: {{customerName}} ({{customerPhone}}). Address: {{pickupAddress}}.',
   ARRAY['driverName', 'orderNumber', 'zone', 'customerName', 'customerPhone', 'pickupAddress'], true),
  ('Driver Delivery SMS', 'sms', NULL,
   'Order {{orderNumber}} is ready for delivery to {{zone}}. Customer: {{customerName}} ({{customerPhone}}). Address: {{pickupAddress}}.',
   ARRAY['driverName', 'orderNumber', 'zone', 'customerName', 'customerPhone', 'pickupAddress'], true)
ON CONFLICT DO NOTHING;

-- 2. Trigger: queue SMS + in-app notification when driver is assigned
CREATE OR REPLACE FUNCTION notify_driver_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_driver RECORD;
  v_item_count INTEGER;
BEGIN
  -- Only fire when driver_id changes from NULL to a value
  IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS NULL OR OLD.driver_id <> NEW.driver_id) THEN
    -- Get driver profile
    SELECT name, phone INTO v_driver FROM profiles WHERE id = NEW.driver_id;

    -- Count items
    SELECT COALESCE(SUM(quantity), 0) INTO v_item_count FROM order_items WHERE order_id = NEW.id;

    -- In-app notification
    INSERT INTO notifications (user_id, type, title, message, order_id, tracking_code)
    VALUES (
      NEW.driver_id,
      'driver_assigned',
      'New delivery assigned',
      'Order ' || NEW.tracking_code || ' in ' || COALESCE(NEW.zone, 'Unknown') || ' - ' || v_item_count || ' items. Pickup from ' || COALESCE(NEW.customer_name, 'Customer') || '.',
      NEW.id,
      NEW.tracking_code
    );

    -- Queue SMS notification
    IF v_driver.phone IS NOT NULL THEN
      INSERT INTO notification_history (
        template_name, channel, recipient_id, recipient_name, recipient_contact,
        body, status
      ) VALUES (
        'Driver Assignment SMS', 'sms', NEW.driver_id, v_driver.name, v_driver.phone,
        'Hi ' || v_driver.name || ', you have been assigned to order ' || NEW.tracking_code ||
        ' in ' || COALESCE(NEW.zone, 'Unknown') || '. ' || v_item_count || ' items. Pickup: ' ||
        COALESCE(NEW.pickup_address, 'See app') || '. Open the app for details.',
        'pending'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger (drop first if exists to be safe)
DROP TRIGGER IF EXISTS trg_notify_driver_assignment ON orders;
CREATE TRIGGER trg_notify_driver_assignment
  AFTER UPDATE OF driver_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_driver_on_assignment();

-- Also fire on status changes relevant to drivers (out_for_delivery)
CREATE OR REPLACE FUNCTION notify_driver_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_driver RECORD;
BEGIN
  -- Only for orders with a driver assigned
  IF NEW.driver_id IS NULL THEN RETURN NEW; END IF;

  -- Get driver profile
  SELECT name, phone INTO v_driver FROM profiles WHERE id = NEW.driver_id;

  -- Ready for delivery (status 10) - notify driver to pick up from warehouse
  IF NEW.status = 10 AND OLD.status <> 10 THEN
    INSERT INTO notifications (user_id, type, title, message, order_id, tracking_code)
    VALUES (
      NEW.driver_id,
      'ready_for_delivery',
      'Order ready for delivery',
      'Order ' || NEW.tracking_code || ' is ready for delivery to ' || COALESCE(NEW.zone, 'Unknown') || '. Customer: ' || COALESCE(NEW.customer_name, 'Customer') || '.',
      NEW.id,
      NEW.tracking_code
    );

    IF v_driver.phone IS NOT NULL THEN
      INSERT INTO notification_history (
        template_name, channel, recipient_id, recipient_name, recipient_contact,
        body, status
      ) VALUES (
        'Driver Delivery SMS', 'sms', NEW.driver_id, v_driver.name, v_driver.phone,
        'Order ' || NEW.tracking_code || ' is ready for delivery to ' || COALESCE(NEW.zone, 'Unknown') ||
        '. Customer: ' || COALESCE(NEW.customer_name, 'Customer') ||
        CASE WHEN NEW.driver_phone IS NOT NULL THEN ' (' || NEW.driver_phone || ')' ELSE '' END ||
        '. Address: ' || COALESCE(NEW.pickup_address, 'See app') || '.',
        'pending'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_driver_status ON orders;
CREATE TRIGGER trg_notify_driver_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_driver_on_status_change();
