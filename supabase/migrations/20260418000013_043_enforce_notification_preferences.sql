-- ============================================================
-- Migration: Enforce notification preferences in trigger functions
--
-- Modifies queue_order_notification() and notify_driver_on_assignment()
-- to check notification_preferences before inserting into
-- notification_history. This ensures users who have opted out
-- of SMS or email do not receive unwanted notifications.
--
-- Preference mapping:
--   Order status updates (confirmed, pickup, ready, delivered) -> order_updates
--   Payment confirmations -> payment_reminders
--   All others -> always send (system notifications)
-- ============================================================

-- ============================================================
-- 1. Replace queue_order_notification with preference checks
-- ============================================================

CREATE OR REPLACE FUNCTION queue_order_notification()
RETURNS trigger AS $$
DECLARE
  tpl_name TEXT;
  sms_template RECORD;
  email_template RECORD;
  customer RECORD;
  v_prefs RECORD;
  tracking_url TEXT;
  rendered_body TEXT;
  v_pref_category TEXT;
  v_category_enabled BOOLEAN;
BEGIN
  -- Only fire when status actually changes
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Map status integers to ACTUAL seeded template names (title case)
  tpl_name := CASE NEW.status
    WHEN 2  THEN 'Order Confirmation'
    WHEN 4  THEN 'Pickup Reminder'
    WHEN 10 THEN 'Order Ready for Delivery'
    WHEN 12 THEN 'Delivery Confirmation'
    ELSE NULL
  END;

  -- Not a customer-facing status or no template — skip notification
  IF tpl_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get customer info (column is "phone", not "phone_number")
  SELECT p.phone, p.email, p.name
  INTO customer
  FROM profiles p
  WHERE p.id = NEW.customer_id;

  -- No customer found — skip
  IF customer IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fetch notification preferences for this customer
  SELECT sms_enabled, email_enabled, order_updates, payment_reminders
  INTO v_prefs
  FROM notification_preferences
  WHERE profile_id = NEW.customer_id;

  -- Map notification type to preference category
  -- Order status updates: confirmed (2), pickup (4), ready (10), delivered (12)
  -- All of these are order_updates
  v_pref_category := CASE NEW.status
    WHEN 2  THEN 'order_updates'
    WHEN 4  THEN 'order_updates'
    WHEN 10 THEN 'order_updates'
    WHEN 12 THEN 'order_updates'
    ELSE 'system'
  END;

  -- Determine if the relevant category is enabled (default to true if no prefs found)
  v_category_enabled := CASE v_pref_category
    WHEN 'order_updates' THEN COALESCE(v_prefs.order_updates, true)
    WHEN 'payment_reminders' THEN COALESCE(v_prefs.payment_reminders, true)
    ELSE true  -- system notifications always send
  END;

  tracking_url := 'https://expresswash.co.ke/track?code=' || COALESCE(NEW.tracking_code, '');

  -- ---- SMS NOTIFICATION ----
  -- Only queue if sms_enabled AND the category is enabled
  IF COALESCE(v_prefs.sms_enabled, true) AND v_category_enabled THEN
    SELECT * INTO sms_template
    FROM notification_templates
    WHERE name = tpl_name AND channel = 'sms' AND is_active = true
    LIMIT 1;

    IF sms_template IS NOT NULL AND customer.phone IS NOT NULL THEN
      -- Render all template variables from order + customer context
      rendered_body := sms_template.body;
      rendered_body := REPLACE(rendered_body, '{{customerName}}', COALESCE(customer.name, 'Customer'));
      rendered_body := REPLACE(rendered_body, '{{orderNumber}}', COALESCE(NEW.tracking_code, NEW.id::TEXT));
      rendered_body := REPLACE(rendered_body, '{{trackingLink}}', tracking_url);
      rendered_body := REPLACE(rendered_body, '{{amount}}', COALESCE(NEW.total::TEXT, '0'));
      rendered_body := REPLACE(rendered_body, '{{pickupDate}}', COALESCE(NEW.pickup_date, 'TBD'));
      rendered_body := REPLACE(rendered_body, '{{driverName}}', COALESCE(NEW.driver_name, 'your driver'));
      rendered_body := REPLACE(rendered_body, '{{deliveryDate}}', COALESCE(NEW.estimated_delivery, 'TBD'));
      rendered_body := REPLACE(rendered_body, '{{driverPhone}}', COALESCE(NEW.driver_phone, '0700-000-000'));

      INSERT INTO notification_history (
        template_id,
        template_name,
        channel,
        recipient_id,
        recipient_name,
        recipient_contact,
        body,
        status
      ) VALUES (
        sms_template.id,
        tpl_name,
        'sms',
        NEW.customer_id::TEXT,
        COALESCE(customer.name, 'Customer'),
        customer.phone,
        rendered_body,
        'pending'
      );
    END IF;
  END IF;

  -- ---- EMAIL NOTIFICATION ----
  -- Only queue if email_enabled AND the category is enabled
  IF COALESCE(v_prefs.email_enabled, true) AND v_category_enabled THEN
    SELECT * INTO email_template
    FROM notification_templates
    WHERE name = tpl_name AND channel = 'email' AND is_active = true
    LIMIT 1;

    IF email_template IS NOT NULL AND customer.email IS NOT NULL THEN
      rendered_body := email_template.body;
      rendered_body := REPLACE(rendered_body, '{{customerName}}', COALESCE(customer.name, 'Customer'));
      rendered_body := REPLACE(rendered_body, '{{orderNumber}}', COALESCE(NEW.tracking_code, NEW.id::TEXT));
      rendered_body := REPLACE(rendered_body, '{{trackingLink}}', tracking_url);
      rendered_body := REPLACE(rendered_body, '{{amount}}', COALESCE(NEW.total::TEXT, '0'));
      rendered_body := REPLACE(rendered_body, '{{pickupDate}}', COALESCE(NEW.pickup_date, 'TBD'));
      rendered_body := REPLACE(rendered_body, '{{driverName}}', COALESCE(NEW.driver_name, 'your driver'));
      rendered_body := REPLACE(rendered_body, '{{deliveryDate}}', COALESCE(NEW.estimated_delivery, 'TBD'));
      rendered_body := REPLACE(rendered_body, '{{driverPhone}}', COALESCE(NEW.driver_phone, '0700-000-000'));

      INSERT INTO notification_history (
        template_id,
        template_name,
        channel,
        recipient_id,
        recipient_name,
        recipient_contact,
        subject,
        body,
        status
      ) VALUES (
        email_template.id,
        tpl_name,
        'email',
        NEW.customer_id::TEXT,
        COALESCE(customer.name, 'Customer'),
        customer.email,
        COALESCE(email_template.subject, 'ExpressWash Order Update'),
        rendered_body,
        'pending'
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS queue_notification_on_status ON orders;

CREATE TRIGGER queue_notification_on_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION queue_order_notification();


-- ============================================================
-- 2. Replace notify_driver_on_assignment with SMS preference check
-- ============================================================

CREATE OR REPLACE FUNCTION notify_driver_on_assignment()
RETURNS TRIGGER AS $$
DECLARE
  v_driver RECORD;
  v_item_count INTEGER;
  v_driver_sms_enabled BOOLEAN;
BEGIN
  -- Only fire when driver_id changes from NULL to a value
  IF NEW.driver_id IS NOT NULL AND (OLD.driver_id IS NULL OR OLD.driver_id <> NEW.driver_id) THEN
    -- Get driver profile
    SELECT name, phone INTO v_driver FROM profiles WHERE id = NEW.driver_id;

    -- Count items
    SELECT COALESCE(SUM(quantity), 0) INTO v_item_count FROM order_items WHERE order_id = NEW.id;

    -- In-app notification (always sent regardless of preferences)
    INSERT INTO notifications (user_id, type, title, message, order_id, tracking_code)
    VALUES (
      NEW.driver_id,
      'driver_assigned',
      'New delivery assigned',
      'Order ' || NEW.tracking_code || ' in ' || COALESCE(NEW.zone, 'Unknown') || ' - ' || v_item_count || ' items. Pickup from ' || COALESCE(NEW.customer_name, 'Customer') || '.',
      NEW.id,
      NEW.tracking_code
    );

    -- Check driver's SMS preference before queuing SMS
    SELECT COALESCE(np.sms_enabled, true)
    INTO v_driver_sms_enabled
    FROM notification_preferences np
    WHERE np.profile_id = NEW.driver_id;

    -- Default to true if no preference record exists
    IF v_driver_sms_enabled IS NULL THEN
      v_driver_sms_enabled := true;
    END IF;

    -- Queue SMS notification only if driver has SMS enabled
    IF v_driver_sms_enabled AND v_driver.phone IS NOT NULL THEN
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

-- Re-create trigger (idempotent)
DROP TRIGGER IF EXISTS trg_notify_driver_assignment ON orders;
CREATE TRIGGER trg_notify_driver_assignment
  AFTER UPDATE OF driver_id ON orders
  FOR EACH ROW
  EXECUTE FUNCTION notify_driver_on_assignment();


-- ============================================================
-- 3. Replace notify_driver_on_status_change with SMS preference check
-- ============================================================

CREATE OR REPLACE FUNCTION notify_driver_on_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_driver RECORD;
  v_driver_sms_enabled BOOLEAN;
BEGIN
  -- Only for orders with a driver assigned
  IF NEW.driver_id IS NULL THEN RETURN NEW; END IF;

  -- Get driver profile
  SELECT name, phone INTO v_driver FROM profiles WHERE id = NEW.driver_id;

  -- Ready for delivery (status 10) - notify driver to pick up from warehouse
  IF NEW.status = 10 AND OLD.status <> 10 THEN
    -- In-app notification (always sent)
    INSERT INTO notifications (user_id, type, title, message, order_id, tracking_code)
    VALUES (
      NEW.driver_id,
      'ready_for_delivery',
      'Order ready for delivery',
      'Order ' || NEW.tracking_code || ' is ready for delivery to ' || COALESCE(NEW.zone, 'Unknown') || '. Customer: ' || COALESCE(NEW.customer_name, 'Customer') || '.',
      NEW.id,
      NEW.tracking_code
    );

    -- Check driver's SMS preference
    SELECT COALESCE(np.sms_enabled, true)
    INTO v_driver_sms_enabled
    FROM notification_preferences np
    WHERE np.profile_id = NEW.driver_id;

    IF v_driver_sms_enabled IS NULL THEN
      v_driver_sms_enabled := true;
    END IF;

    IF v_driver_sms_enabled AND v_driver.phone IS NOT NULL THEN
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
