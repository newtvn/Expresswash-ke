-- ============================================================
-- Migration: Unified Payments Schema + Ledger Event Tables
--
-- Resolves two conflicting payments schemas:
--   Schema A (supabase-schema.sql): invoice-based (invoice_id, invoice_number, reference, recorded_by)
--   Schema B (services/paymentService): order-based (order_id, phone_number, merchant_request_id, etc.)
--
-- Creates event/history tables for payment, expense, and invoice status changes
-- following the order_status_history pattern.
-- ============================================================

-- ============================================================
-- 1A. Extend enums (idempotent — handles either schema deployed first)
-- ============================================================

ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'cancelled';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'qr_code';

-- ============================================================
-- 1B. Alter payments table to unified superset
-- ============================================================

-- Add columns from Schema B (order-based / STK Push) if missing
ALTER TABLE payments ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES orders(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS phone_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS transaction_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS merchant_request_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS checkout_request_id TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS result_code INTEGER;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS result_desc TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS metadata JSONB;

-- Add columns from Schema A (invoice-based) if missing
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS notes TEXT;

-- Drop NOT NULL constraints that prevent cross-schema inserts.
-- invoice_id, invoice_number, reference, recorded_by are NOT NULL in Schema A
-- but STK Push payments don't have them.
-- order_id may be NOT NULL in Schema B but invoice payments don't have it.
DO $$
BEGIN
  -- Drop NOT NULL from invoice_id (Schema A has it NOT NULL)
  BEGIN
    ALTER TABLE payments ALTER COLUMN invoice_id DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL;
  END;

  -- Drop NOT NULL from invoice_number
  BEGIN
    ALTER TABLE payments ALTER COLUMN invoice_number DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL;
  END;

  -- Drop NOT NULL from reference
  BEGIN
    ALTER TABLE payments ALTER COLUMN reference DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL;
  END;

  -- Drop NOT NULL from recorded_by
  BEGIN
    ALTER TABLE payments ALTER COLUMN recorded_by DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL;
  END;

  -- Drop NOT NULL from order_id (Schema B may have it NOT NULL)
  BEGIN
    ALTER TABLE payments ALTER COLUMN order_id DROP NOT NULL;
  EXCEPTION WHEN others THEN NULL;
  END;
END $$;

-- Constraint: at least one of order_id or invoice_id must be set
-- Drop if exists first to allow re-run
DO $$
BEGIN
  ALTER TABLE payments DROP CONSTRAINT IF EXISTS chk_payment_has_reference;
  ALTER TABLE payments ADD CONSTRAINT chk_payment_has_reference
    CHECK (order_id IS NOT NULL OR invoice_id IS NOT NULL);
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not add check constraint: %', SQLERRM;
END $$;

-- Add useful indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_checkout_request_id ON payments(checkout_request_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ============================================================
-- 1C. Create payment_status_events table
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  trigger_source TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_payment_status_events_payment_id
  ON payment_status_events(payment_id, created_at DESC);

ALTER TABLE payment_status_events ENABLE ROW LEVEL SECURITY;

-- Admin can read all payment events
DO $$
BEGIN
  DROP POLICY IF EXISTS "payment_events_admin_read" ON payment_status_events;
  CREATE POLICY "payment_events_admin_read" ON payment_status_events
    FOR SELECT USING (is_admin());
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create payment_events_admin_read policy: %', SQLERRM;
END $$;

-- Customer can read their own payment events (via payments → orders → customer_id)
DO $$
BEGIN
  DROP POLICY IF EXISTS "payment_events_customer_read" ON payment_status_events;
  CREATE POLICY "payment_events_customer_read" ON payment_status_events
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM payments p
        LEFT JOIN orders o ON o.id = p.order_id
        LEFT JOIN invoices inv ON inv.id = p.invoice_id
        WHERE p.id = payment_status_events.payment_id
          AND (
            o.customer_id = auth.uid()
            OR inv.customer_id = auth.uid()
          )
      )
    );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create payment_events_customer_read policy: %', SQLERRM;
END $$;

-- No service_role insert policy needed — service role bypasses RLS entirely.
-- Triggers run as SECURITY DEFINER so they also bypass RLS.

-- ============================================================
-- 1D. Create expense_status_events table
-- ============================================================

CREATE TABLE IF NOT EXISTS expense_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_expense_status_events_expense_id
  ON expense_status_events(expense_id, created_at DESC);

ALTER TABLE expense_status_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "expense_events_admin_all" ON expense_status_events;
  CREATE POLICY "expense_events_admin_all" ON expense_status_events
    FOR ALL USING (is_admin());
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create expense_events_admin_all policy: %', SQLERRM;
END $$;

-- ============================================================
-- 1E. Create invoice_status_events table
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  changed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_invoice_status_events_invoice_id
  ON invoice_status_events(invoice_id, created_at DESC);

ALTER TABLE invoice_status_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "invoice_events_admin_all" ON invoice_status_events;
  CREATE POLICY "invoice_events_admin_all" ON invoice_status_events
    FOR ALL USING (is_admin());
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create invoice_events_admin_all policy: %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "invoice_events_customer_read" ON invoice_status_events;
  CREATE POLICY "invoice_events_customer_read" ON invoice_status_events
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM invoices inv
        WHERE inv.id = invoice_status_events.invoice_id
          AND inv.customer_id = auth.uid()
      )
    );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create invoice_events_customer_read policy: %', SQLERRM;
END $$;

-- ============================================================
-- 1F. Trigger functions — auto-log status changes
-- ============================================================

-- Payment status change trigger function
CREATE OR REPLACE FUNCTION log_payment_status_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO payment_status_events (payment_id, from_status, to_status, changed_by, trigger_source)
  VALUES (
    NEW.id,
    OLD.status::TEXT,
    NEW.status::TEXT,
    auth.uid(),
    'status_update'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Payment creation trigger function
CREATE OR REPLACE FUNCTION log_payment_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO payment_status_events (payment_id, from_status, to_status, changed_by, trigger_source)
  VALUES (
    NEW.id,
    NULL,
    NEW.status::TEXT,
    auth.uid(),
    'initial_insert'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expense status change trigger function
CREATE OR REPLACE FUNCTION log_expense_status_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO expense_status_events (expense_id, from_status, to_status, changed_by)
  VALUES (
    NEW.id,
    OLD.status::TEXT,
    NEW.status::TEXT,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expense creation trigger function
CREATE OR REPLACE FUNCTION log_expense_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO expense_status_events (expense_id, from_status, to_status, changed_by)
  VALUES (
    NEW.id,
    NULL,
    NEW.status::TEXT,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invoice status change trigger function
CREATE OR REPLACE FUNCTION log_invoice_status_change()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO invoice_status_events (invoice_id, from_status, to_status, changed_by)
  VALUES (
    NEW.id,
    OLD.status::TEXT,
    NEW.status::TEXT,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Invoice creation trigger function
CREATE OR REPLACE FUNCTION log_invoice_creation()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO invoice_status_events (invoice_id, from_status, to_status, changed_by)
  VALUES (
    NEW.id,
    NULL,
    NEW.status::TEXT,
    auth.uid()
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Create triggers (drop first to allow re-run)
-- ============================================================

-- Payment triggers
DROP TRIGGER IF EXISTS trg_log_payment_status_change ON payments;
CREATE TRIGGER trg_log_payment_status_change
  AFTER UPDATE OF status ON payments
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_payment_status_change();

DROP TRIGGER IF EXISTS trg_log_payment_creation ON payments;
CREATE TRIGGER trg_log_payment_creation
  AFTER INSERT ON payments
  FOR EACH ROW
  EXECUTE FUNCTION log_payment_creation();

-- Expense triggers
DROP TRIGGER IF EXISTS trg_log_expense_status_change ON expenses;
CREATE TRIGGER trg_log_expense_status_change
  AFTER UPDATE OF status ON expenses
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_expense_status_change();

DROP TRIGGER IF EXISTS trg_log_expense_creation ON expenses;
CREATE TRIGGER trg_log_expense_creation
  AFTER INSERT ON expenses
  FOR EACH ROW
  EXECUTE FUNCTION log_expense_creation();

-- Invoice triggers
DROP TRIGGER IF EXISTS trg_log_invoice_status_change ON invoices;
CREATE TRIGGER trg_log_invoice_status_change
  AFTER UPDATE OF status ON invoices
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION log_invoice_status_change();

DROP TRIGGER IF EXISTS trg_log_invoice_creation ON invoices;
CREATE TRIGGER trg_log_invoice_creation
  AFTER INSERT ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION log_invoice_creation();

-- ============================================================
-- 1G. Backfill existing records
-- ============================================================

-- Backfill payment events for existing payments that don't have events
INSERT INTO payment_status_events (payment_id, from_status, to_status, trigger_source, created_at)
SELECT p.id, NULL, p.status::TEXT, 'backfill', p.created_at
FROM payments p
WHERE NOT EXISTS (
  SELECT 1 FROM payment_status_events e WHERE e.payment_id = p.id
);

-- Backfill expense events for existing expenses
INSERT INTO expense_status_events (expense_id, from_status, to_status, created_at)
SELECT e.id, NULL, e.status::TEXT, e.created_at
FROM expenses e
WHERE NOT EXISTS (
  SELECT 1 FROM expense_status_events ev WHERE ev.expense_id = e.id
);

-- Backfill invoice events for existing invoices
INSERT INTO invoice_status_events (invoice_id, from_status, to_status, created_at)
SELECT i.id, NULL, i.status::TEXT, i.issued_at
FROM invoices i
WHERE NOT EXISTS (
  SELECT 1 FROM invoice_status_events ev WHERE ev.invoice_id = i.id
);

-- ============================================================
-- 1H. Update RLS policies on payments table
-- ============================================================

-- Drop overly permissive policies from Schema A
DROP POLICY IF EXISTS "Authenticated read payments" ON payments;
DROP POLICY IF EXISTS "Authenticated manage payments" ON payments;

-- Admin: full access
DO $$
BEGIN
  DROP POLICY IF EXISTS "payments_admin_all" ON payments;
  CREATE POLICY "payments_admin_all" ON payments
    FOR ALL USING (is_admin());
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create payments_admin_all policy: %', SQLERRM;
END $$;

-- Customer: read own payments (via order or invoice)
DO $$
BEGIN
  DROP POLICY IF EXISTS "payments_customer_read" ON payments;
  CREATE POLICY "payments_customer_read" ON payments
    FOR SELECT USING (
      EXISTS (
        SELECT 1 FROM orders o WHERE o.id = payments.order_id AND o.customer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM invoices inv WHERE inv.id = payments.invoice_id AND inv.customer_id = auth.uid()
      )
    );
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create payments_customer_read policy: %', SQLERRM;
END $$;

-- Driver: read and insert for cash collection
DO $$
BEGIN
  DROP POLICY IF EXISTS "payments_driver_read" ON payments;
  CREATE POLICY "payments_driver_read" ON payments
    FOR SELECT USING (is_driver());
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create payments_driver_read policy: %', SQLERRM;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "payments_driver_insert" ON payments;
  CREATE POLICY "payments_driver_insert" ON payments
    FOR INSERT WITH CHECK (is_driver());
EXCEPTION WHEN others THEN
  RAISE NOTICE 'Could not create payments_driver_insert policy: %', SQLERRM;
END $$;

-- No service_role policy needed — service role bypasses RLS entirely.

-- ============================================================
-- Done
-- ============================================================

DO $$
BEGIN
  RAISE NOTICE '[OK] Unified payments schema + ledger event tables created';
  RAISE NOTICE '[OK] Triggers: 6 (payment/expense/invoice × insert/update)';
  RAISE NOTICE '[OK] Backfill: existing records seeded into event tables';
END $$;
