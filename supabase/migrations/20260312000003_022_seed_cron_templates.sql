-- ============================================================
-- Notification templates for cron-driven messages
-- These complement the inline messages in cron jobs and enable
-- future migration to template-based rendering.
-- ============================================================

INSERT INTO notification_templates (name, channel, subject, body, variables, is_active)
VALUES
  ('payment_reminder_1', 'sms', NULL,
   'Hi {{customerName}}, your invoice {{invoiceNumber}} for KES {{amount}} is due in 4 days. Pay via M-Pesa to avoid delays. - ExpressWash',
   ARRAY['customerName', 'invoiceNumber', 'amount'],
   true),
  ('payment_reminder_2', 'sms', NULL,
   'Reminder: Invoice {{invoiceNumber}} for KES {{amount}} is due TOMORROW. Please pay via M-Pesa. - ExpressWash',
   ARRAY['invoiceNumber', 'amount'],
   true),
  ('payment_reminder_3', 'sms', NULL,
   'OVERDUE: Invoice {{invoiceNumber}} for KES {{amount}} was due yesterday. Please pay immediately. - ExpressWash',
   ARRAY['invoiceNumber', 'amount'],
   true),
  ('payment_reminder_1', 'email', 'Payment Due Soon - ExpressWash',
   '<h2>Payment Reminder</h2><p>Hi {{customerName}},</p><p>Your invoice <strong>{{invoiceNumber}}</strong> for <strong>KES {{amount}}</strong> is due in 4 days.</p><p>Please make your payment via M-Pesa or bank transfer to avoid any delays to your service.</p><p>Thank you for choosing ExpressWash!</p>',
   ARRAY['customerName', 'invoiceNumber', 'amount'],
   true),
  ('payment_reminder_2', 'email', 'Payment Due Tomorrow - ExpressWash',
   '<h2>Urgent: Payment Due Tomorrow</h2><p>Hi {{customerName}},</p><p>This is a reminder that your invoice <strong>{{invoiceNumber}}</strong> for <strong>KES {{amount}}</strong> is due <strong>tomorrow</strong>.</p><p>Please make your payment as soon as possible.</p>',
   ARRAY['customerName', 'invoiceNumber', 'amount'],
   true),
  ('payment_reminder_3', 'email', 'OVERDUE: Payment Required - ExpressWash',
   '<h2>Payment Overdue</h2><p>Hi {{customerName}},</p><p>Your invoice <strong>{{invoiceNumber}}</strong> for <strong>KES {{amount}}</strong> is now <strong>overdue</strong>.</p><p>Please make payment immediately to avoid any disruption to your service.</p>',
   ARRAY['customerName', 'invoiceNumber', 'amount'],
   true),
  ('birthday_greeting', 'sms', NULL,
   'Happy Birthday {{customerName}}! ExpressWash wishes you a wonderful day. Enjoy 20% off your next order with code: {{promoCode}} (valid 7 days).',
   ARRAY['customerName', 'promoCode'],
   true),
  ('birthday_greeting', 'email', 'Happy Birthday from ExpressWash!',
   '<h2>Happy Birthday, {{customerName}}!</h2><p>Wishing you a wonderful birthday from all of us at ExpressWash!</p><p>As a special gift, enjoy <strong>20% off</strong> your next order with code:</p><h3 style="color: #4F46E5; text-align: center;">{{promoCode}}</h3><p>Valid for 7 days. We look forward to serving you!</p>',
   ARRAY['customerName', 'promoCode'],
   true)
ON CONFLICT (name, channel) DO NOTHING;
