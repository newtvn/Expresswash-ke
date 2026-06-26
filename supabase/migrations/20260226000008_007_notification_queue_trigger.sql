-- ============================================================
-- Migration: Queue notifications on order status change
--
-- CRITICAL: All column names verified against actual schema:
--   notification_history: recipient_id, recipient_name, recipient_contact,
--                         template_name, body, status (ENUM, use 'pending')
--   notification_templates: body (not content), name (title case)
--   profiles: phone (not phone_number)
--   orders: total (not total_amount)
--
-- Template names match supabase-seed.sql (title case with spaces):
--   'Order Confirmation', 'Pickup Reminder', 'Order Ready for Delivery',
--   'Delivery Confirmation'
--
-- Variable syntax matches seed data (camelCase). All rendered from
-- the orders row and customer profile:
--   {{customerName}}, {{orderNumber}}, {{trackingLink}}, {{amount}},
--   {{pickupDate}}, {{driverName}}, {{deliveryDate}}, {{driverPhone}}
-- ============================================================

CREATE OR REPLACE FUNCTION queue_order_notification()
RETURNS trigger AS $$
DECLARE
  tpl_name TEXT;
  sms_template RECORD;
  email_template RECORD;
  customer RECORD;
  tracking_url TEXT;
  rendered_body TEXT;
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

  tracking_url := 'https://expresswash.co.ke/track?code=' || COALESCE(NEW.tracking_code, '');

  -- ---- SMS NOTIFICATION ----
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

  -- ---- EMAIL NOTIFICATION ----
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS queue_notification_on_status ON orders;

CREATE TRIGGER queue_notification_on_status
  AFTER UPDATE OF status ON orders
  FOR EACH ROW
  EXECUTE FUNCTION queue_order_notification();
