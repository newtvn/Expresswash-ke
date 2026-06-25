-- ============================================================
-- Migration: Payment notification trigger + seed templates
-- WK2 Step 6: Auto-notify customer when payment is recorded
-- ============================================================

-- 1. Seed payment notification templates (title case, matching existing convention)
INSERT INTO notification_templates (name, channel, subject, body, variables)
VALUES
  (
    'Payment Confirmation',
    'sms',
    NULL,
    'Hi {{customerName}}, your payment of KES {{amount}} for order {{orderNumber}} has been received. Invoice: {{invoiceNumber}}. Thank you for choosing ExpressWash!',
    ARRAY['customerName', 'amount', 'orderNumber', 'invoiceNumber']
  ),
  (
    'Payment Confirmation',
    'email',
    'Payment Received - {{invoiceNumber}}',
    '<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto"><div style="background:#16a34a;padding:24px;text-align:center;border-radius:8px 8px 0 0"><h1 style="color:#fff;margin:0;font-size:24px">Payment Received</h1></div><div style="padding:24px;background:#fff;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px"><p>Hi {{customerName}},</p><p>We have received your payment of <strong>KES {{amount}}</strong> for invoice <strong>{{invoiceNumber}}</strong>.</p><div style="background:#f0fdf4;padding:16px;border-radius:8px;margin:16px 0"><p style="margin:0"><strong>Order:</strong> {{orderNumber}}</p><p style="margin:8px 0 0"><strong>Amount:</strong> KES {{amount}}</p><p style="margin:8px 0 0"><strong>Method:</strong> {{paymentMethod}}</p></div><p>Thank you for choosing ExpressWash!</p><p style="color:#6b7280;font-size:12px">This is an automated message. Please do not reply.</p></div></div>',
    ARRAY['customerName', 'amount', 'orderNumber', 'invoiceNumber', 'paymentMethod']
  )
ON CONFLICT (name, channel) DO NOTHING;

-- 2. Trigger function: queue notifications after payment insert
CREATE OR REPLACE FUNCTION notify_on_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice    RECORD;
  v_customer   RECORD;
  v_sms_tpl    RECORD;
  v_email_tpl  RECORD;
  v_sms_body   TEXT;
  v_email_body TEXT;
  v_email_subj TEXT;
  v_method_label TEXT;
BEGIN
  -- Fetch invoice details
  SELECT id, invoice_number, order_id, order_number, customer_id, customer_name, customer_email, total
  INTO v_invoice
  FROM invoices
  WHERE id = NEW.invoice_id;

  IF NOT FOUND THEN
    RAISE WARNING 'notify_on_payment: invoice % not found', NEW.invoice_id;
    RETURN NEW;
  END IF;

  -- Fetch customer profile for phone
  SELECT phone
  INTO v_customer
  FROM profiles
  WHERE id = v_invoice.customer_id;

  -- Map payment method to display label
  v_method_label := CASE NEW.method
    WHEN 'mpesa' THEN 'M-Pesa'
    WHEN 'cash'  THEN 'Cash'
    WHEN 'card'  THEN 'Card'
    WHEN 'bank_transfer' THEN 'Bank Transfer'
    ELSE NEW.method
  END;

  -- Fetch SMS template
  SELECT body INTO v_sms_tpl
  FROM notification_templates
  WHERE name = 'Payment Confirmation' AND channel = 'sms'
  LIMIT 1;

  -- Fetch email template
  SELECT subject, body INTO v_email_tpl
  FROM notification_templates
  WHERE name = 'Payment Confirmation' AND channel = 'email'
  LIMIT 1;

  -- Render SMS
  IF v_sms_tpl.body IS NOT NULL AND v_customer.phone IS NOT NULL THEN
    v_sms_body := v_sms_tpl.body;
    v_sms_body := REPLACE(v_sms_body, '{{customerName}}', COALESCE(v_invoice.customer_name, 'Customer'));
    v_sms_body := REPLACE(v_sms_body, '{{amount}}', TO_CHAR(NEW.amount, 'FM999,999,999'));
    v_sms_body := REPLACE(v_sms_body, '{{orderNumber}}', COALESCE(v_invoice.order_number, ''));
    v_sms_body := REPLACE(v_sms_body, '{{invoiceNumber}}', COALESCE(v_invoice.invoice_number, ''));
    v_sms_body := REPLACE(v_sms_body, '{{paymentMethod}}', v_method_label);

    INSERT INTO notification_history (
      recipient_id, recipient_name, recipient_contact, channel,
      template_name, body, status
    ) VALUES (
      v_invoice.customer_id, v_invoice.customer_name, v_customer.phone, 'sms',
      'Payment Confirmation', v_sms_body, 'pending'
    );
  END IF;

  -- Render email
  IF v_email_tpl.body IS NOT NULL AND v_invoice.customer_email IS NOT NULL THEN
    v_email_body := v_email_tpl.body;
    v_email_body := REPLACE(v_email_body, '{{customerName}}', COALESCE(v_invoice.customer_name, 'Customer'));
    v_email_body := REPLACE(v_email_body, '{{amount}}', TO_CHAR(NEW.amount, 'FM999,999,999'));
    v_email_body := REPLACE(v_email_body, '{{orderNumber}}', COALESCE(v_invoice.order_number, ''));
    v_email_body := REPLACE(v_email_body, '{{invoiceNumber}}', COALESCE(v_invoice.invoice_number, ''));
    v_email_body := REPLACE(v_email_body, '{{paymentMethod}}', v_method_label);

    v_email_subj := v_email_tpl.subject;
    v_email_subj := REPLACE(v_email_subj, '{{invoiceNumber}}', COALESCE(v_invoice.invoice_number, ''));

    INSERT INTO notification_history (
      recipient_id, recipient_name, recipient_contact, channel,
      template_name, subject, body, status
    ) VALUES (
      v_invoice.customer_id, v_invoice.customer_name, v_invoice.customer_email, 'email',
      'Payment Confirmation', v_email_subj, v_email_body, 'pending'
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create trigger (drop if exists to allow re-run)
DROP TRIGGER IF EXISTS trg_notify_on_payment ON payments;
CREATE TRIGGER trg_notify_on_payment
  AFTER INSERT ON payments
  FOR EACH ROW
  WHEN (NEW.status = 'completed')
  EXECUTE FUNCTION notify_on_payment();

DO $$
BEGIN
  RAISE NOTICE '[OK] Payment notification trigger created';
END $$;
