-- ============================================================
-- Migration: Seed missing email notification templates
--
-- The seed data (supabase-seed.sql) only has SMS templates for
-- most order lifecycle events. Email templates are needed for
-- the notification queue trigger to send email notifications.
--
-- Also adds a unique constraint on (name, channel) to prevent
-- duplicate templates, and fixes the Pickup Reminder SMS template
-- to use {{pickupDate}} instead of {{pickupTime}} (no time-only
-- column exists on orders).
--
-- Variable names use camelCase to match existing SMS templates:
--   {{customerName}}, {{orderNumber}}, {{trackingLink}}
-- ============================================================

-- Add unique constraint so ON CONFLICT works correctly
ALTER TABLE notification_templates
  ADD CONSTRAINT uq_notification_templates_name_channel UNIQUE (name, channel);

-- Fix Pickup Reminder SMS template: {{pickupTime}} has no data source,
-- use {{pickupDate}} instead and rephrase for clarity
UPDATE notification_templates
SET body = 'Hi {{customerName}}, reminder: We will pick up your items on {{pickupDate}}. Please have them ready. Call us at 0700-000-000 for changes.',
    variables = ARRAY['customerName', 'pickupDate']
WHERE name = 'Pickup Reminder' AND channel = 'sms';

INSERT INTO notification_templates (name, channel, subject, body, variables, is_active)
VALUES
  (
    'Order Confirmation',
    'email',
    'Order Confirmed - ExpressWash',
    E'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    || E'<h2 style="color: #2563eb;">Order Confirmed</h2>'
    || E'<p>Dear {{customerName}},</p>'
    || E'<p>Your order <strong>{{orderNumber}}</strong> has been confirmed. We will assign a driver shortly for pickup.</p>'
    || E'<p><a href="{{trackingLink}}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Track Your Order</a></p>'
    || E'<p>Thank you for choosing ExpressWash!</p>'
    || E'<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">'
    || E'<p style="color: #6b7280; font-size: 12px;">ExpressWash Carpet Cleaning Services | expresswash.co.ke</p>'
    || E'</div>',
    ARRAY['customerName', 'orderNumber', 'trackingLink'],
    true
  ),
  (
    'Delivery Confirmation',
    'email',
    'Order Delivered - ExpressWash',
    E'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    || E'<h2 style="color: #16a34a;">Order Delivered!</h2>'
    || E'<p>Dear {{customerName}},</p>'
    || E'<p>Your order <strong>{{orderNumber}}</strong> has been delivered successfully.</p>'
    || E'<p>We hope you are satisfied with our service! Your feedback helps us improve.</p>'
    || E'<p><a href="https://expresswash.co.ke/rate/{{orderNumber}}" style="display: inline-block; padding: 10px 20px; background: #16a34a; color: white; text-decoration: none; border-radius: 6px;">Rate Your Experience</a></p>'
    || E'<p>Thank you for choosing ExpressWash!</p>'
    || E'<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">'
    || E'<p style="color: #6b7280; font-size: 12px;">ExpressWash Carpet Cleaning Services | expresswash.co.ke</p>'
    || E'</div>',
    ARRAY['customerName', 'orderNumber'],
    true
  ),
  (
    'Order Ready for Delivery',
    'email',
    'Your Items Are Ready - ExpressWash',
    E'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
    || E'<h2 style="color: #2563eb;">Your Items Are Ready!</h2>'
    || E'<p>Dear {{customerName}},</p>'
    || E'<p>Great news! Your order <strong>{{orderNumber}}</strong> is clean and ready for delivery.</p>'
    || E'<p>Our driver will contact you shortly to arrange delivery.</p>'
    || E'<p><a href="{{trackingLink}}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px;">Track Delivery</a></p>'
    || E'<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;">'
    || E'<p style="color: #6b7280; font-size: 12px;">ExpressWash Carpet Cleaning Services | expresswash.co.ke</p>'
    || E'</div>',
    ARRAY['customerName', 'orderNumber', 'trackingLink'],
    true
  )
ON CONFLICT (name, channel) DO NOTHING;

-- Verify templates exist for both SMS and email channels
DO $$
DECLARE
  sms_count INTEGER;
  email_count INTEGER;
BEGIN
  SELECT count(*) INTO sms_count
  FROM notification_templates
  WHERE name = 'Order Confirmation' AND channel = 'sms';

  SELECT count(*) INTO email_count
  FROM notification_templates
  WHERE name = 'Order Confirmation' AND channel = 'email';

  ASSERT sms_count >= 1, 'Missing SMS template: Order Confirmation';
  ASSERT email_count >= 1, 'Missing Email template: Order Confirmation';

  RAISE NOTICE '✓ Email notification templates seeded';
END $$;
