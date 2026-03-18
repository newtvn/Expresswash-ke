-- ============================================================
-- Migration: Add notification templates for order cancellation
-- and update the status-change trigger to fire on status 13.
--
-- Template variables (camelCase, matching existing convention):
--   {{customerName}}, {{orderNumber}}, {{trackingLink}}
-- ============================================================

-- ── 1. Seed SMS template ─────────────────────────────────────
INSERT INTO notification_templates (name, channel, subject, body, variables, is_active)
VALUES
  (
    'Order Cancelled',
    'sms',
    NULL,
    'Hi {{customerName}}, your order {{orderNumber}} has been cancelled. If this was a mistake, please contact us at 0700-000-000 or place a new order at expresswash.co.ke.',
    ARRAY['customerName', 'orderNumber'],
    true
  )
ON CONFLICT (name, channel) DO NOTHING;

-- ── 2. Seed email template ───────────────────────────────────
INSERT INTO notification_templates (name, channel, subject, body, variables, is_active)
VALUES
  (
    'Order Cancelled',
    'email',
    'Order Cancelled - ExpressWash',
    E'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    || E'<h2 style="color: #dc2626;">Order Cancelled</h2>'
    || E'<p>Dear {{customerName}},</p>'
    || E'<p>Your order <strong>{{orderNumber}}</strong> has been cancelled.</p>'
    || E'<p>If this was a mistake or you have any questions, please don\'t hesitate to contact us.</p>'
    || E'<p><a href="https://expresswash.co.ke/contact" style="display: inline-block; padding: 10px 20px; background: #dc2626; color: white; text-decoration: none; border-radius: 6px;">Contact Us</a></p>'
    || E'<p>We hope to serve you again soon!</p>'
    || E'<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">'
    || E'<p style="color: #6b7280; font-size: 12px;">ExpressWash Carpet Cleaning Services | expresswash.co.ke</p>'
    || E'</div>',
    ARRAY['customerName', 'orderNumber'],
    true
  )
ON CONFLICT (name, channel) DO NOTHING;

-- ── 3. Update the notification trigger to include status 13 ──
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
    WHEN 13 THEN 'Order Cancelled'
    ELSE NULL
  END;

  -- Not a customer-facing status or no template — skip notification
  IF tpl_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get customer info
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
      template_id, template_name, channel,
      recipient_id, recipient_name, recipient_contact,
      body, status
    ) VALUES (
      sms_template.id, tpl_name, 'sms',
      NEW.customer_id::TEXT, COALESCE(customer.name, 'Customer'), customer.phone,
      rendered_body, 'pending'
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
      template_id, template_name, channel,
      recipient_id, recipient_name, recipient_contact,
      subject, body, status
    ) VALUES (
      email_template.id, tpl_name, 'email',
      NEW.customer_id::TEXT, COALESCE(customer.name, 'Customer'), customer.email,
      COALESCE(email_template.subject, 'ExpressWash Order Update'),
      rendered_body, 'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
