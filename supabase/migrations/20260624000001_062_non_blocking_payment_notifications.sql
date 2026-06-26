-- ============================================================
-- Make payment notifications non-blocking
--
-- Manual/admin payment recording is financial source-of-truth work.
-- Notification rendering/queueing must not roll back the payment if an
-- older notification template, enum, or preference path rejects a value.
-- ============================================================

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
  SELECT id, invoice_number, order_id, order_number, customer_id, customer_name, customer_email, total
  INTO v_invoice
  FROM invoices
  WHERE id = NEW.invoice_id;

  IF NOT FOUND THEN
    RAISE WARNING 'notify_on_payment: invoice % not found', NEW.invoice_id;
    RETURN NEW;
  END IF;

  SELECT phone
  INTO v_customer
  FROM profiles
  WHERE id = v_invoice.customer_id;

  v_method_label := CASE NEW.method::TEXT
    WHEN 'mpesa' THEN 'M-Pesa'
    WHEN 'cash' THEN 'Cash'
    WHEN 'card' THEN 'Card'
    WHEN 'bank_transfer' THEN 'Bank Transfer'
    WHEN 'qr_code' THEN 'QR Code'
    ELSE COALESCE(NEW.method::TEXT, 'Payment')
  END;

  SELECT body INTO v_sms_tpl
  FROM notification_templates
  WHERE name = 'Payment Confirmation' AND channel = 'sms'
  LIMIT 1;

  SELECT subject, body INTO v_email_tpl
  FROM notification_templates
  WHERE name = 'Payment Confirmation' AND channel = 'email'
  LIMIT 1;

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

  IF v_email_tpl.body IS NOT NULL AND v_invoice.customer_email IS NOT NULL THEN
    v_email_body := v_email_tpl.body;
    v_email_body := REPLACE(v_email_body, '{{customerName}}', COALESCE(v_invoice.customer_name, 'Customer'));
    v_email_body := REPLACE(v_email_body, '{{amount}}', TO_CHAR(NEW.amount, 'FM999,999,999'));
    v_email_body := REPLACE(v_email_body, '{{orderNumber}}', COALESCE(v_invoice.order_number, ''));
    v_email_body := REPLACE(v_email_body, '{{invoiceNumber}}', COALESCE(v_invoice.invoice_number, ''));
    v_email_body := REPLACE(v_email_body, '{{paymentMethod}}', v_method_label);

    v_email_subj := COALESCE(v_email_tpl.subject, 'Payment Received');
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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_on_payment skipped for payment %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
