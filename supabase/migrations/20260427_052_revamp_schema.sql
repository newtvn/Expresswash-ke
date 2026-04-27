-- ============================================================
-- Revamp schema migration
-- 1. orders     — add order_source, customer_phone
-- 2. invoices   — add new columns, relax NOT NULL constraints
-- 3. payments   — add customer_id for per-user payment lookup
-- 4. expenses   — new table
-- 5. journal_entries — new table
-- 6. receipts   — new table
-- 7. invoice_templates — new table
-- 8. Enum additions: invoice_status += 'pending', 'partial'
-- ============================================================

-- ============================================================
-- PART 1: orders — order source and walk-in customer phone
-- ============================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS order_source TEXT NOT NULL DEFAULT 'app',
  ADD COLUMN IF NOT EXISTS customer_phone TEXT;

ALTER TABLE orders
  DROP CONSTRAINT IF EXISTS orders_order_source_check;

ALTER TABLE orders
  ADD CONSTRAINT orders_order_source_check
    CHECK (order_source IN ('app', 'walkin', 'call', 'whatsapp'));

-- ============================================================
-- PART 2: invoices — extend for new admin invoicing system
-- ============================================================

-- Add new enum values if they don't already exist (Postgres 13+)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'pending'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status')
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'pending';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'partial'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'invoice_status')
  ) THEN
    ALTER TYPE invoice_status ADD VALUE 'partial';
  END IF;
END $$;

-- Relax NOT NULL constraints added in the original schema that don't fit
-- the new admin-created invoices (which may not have an order or email)
ALTER TABLE invoices
  ALTER COLUMN order_id DROP NOT NULL,
  ALTER COLUMN order_number DROP NOT NULL,
  ALTER COLUMN customer_email DROP NOT NULL,
  ALTER COLUMN due_at DROP NOT NULL;

-- Add columns used by the new AdminInvoices page
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS order_tracking_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_phone       TEXT,
  ADD COLUMN IF NOT EXISTS items                JSONB    NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS paid_amount          NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS balance              NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS due_date             TEXT,
  ADD COLUMN IF NOT EXISTS notes                TEXT,
  ADD COLUMN IF NOT EXISTS created_at           TIMESTAMPTZ NOT NULL DEFAULT now();

-- Sync balance for any pre-existing rows
UPDATE invoices SET balance = total - paid_amount WHERE balance = 0 AND total > 0;

-- ============================================================
-- PART 3: payments — customer_id for per-user lookup
-- ============================================================

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON payments(customer_id);

-- Back-fill customer_id from the linked order where possible
UPDATE payments p
SET customer_id = o.customer_id
FROM orders o
WHERE p.order_id = o.id
  AND p.customer_id IS NULL
  AND o.customer_id IS NOT NULL;

-- ============================================================
-- PART 4: expenses — table already exists from migration 002
-- Just update the RLS policy to use explicit WITH CHECK clause.
-- ============================================================

DROP POLICY IF EXISTS "expenses_admin_all" ON expenses;
DROP POLICY IF EXISTS "admins_manage_expenses" ON expenses;
CREATE POLICY "admins_manage_expenses" ON expenses
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- PART 5: journal_entries
-- ============================================================

CREATE TABLE IF NOT EXISTS journal_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_type  TEXT        NOT NULL,  -- e.g. 'debit', 'credit', 'adjustment'
  account     TEXT        NOT NULL,
  debit       NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debit  >= 0),
  credit      NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description TEXT        NOT NULL,
  date        DATE        NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_journal_entries" ON journal_entries;
CREATE POLICY "admins_manage_journal_entries" ON journal_entries
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date DESC);

-- ============================================================
-- PART 6: receipts
-- ============================================================

CREATE TABLE IF NOT EXISTS receipts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor           TEXT        NOT NULL,
  description      TEXT        NOT NULL,
  amount           NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  category         TEXT        NOT NULL,
  date             DATE        NOT NULL DEFAULT CURRENT_DATE,
  tags             TEXT[]      NOT NULL DEFAULT '{}',
  notes            TEXT,
  reference_number TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_receipts" ON receipts;
CREATE POLICY "admins_manage_receipts" ON receipts
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

CREATE INDEX IF NOT EXISTS idx_receipts_date     ON receipts(date DESC);
CREATE INDEX IF NOT EXISTS idx_receipts_category ON receipts(category);

-- ============================================================
-- PART 7: invoice_templates
-- ============================================================

CREATE TABLE IF NOT EXISTS invoice_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  header_text   TEXT NOT NULL DEFAULT '',
  footer_text   TEXT NOT NULL DEFAULT '',
  payment_terms TEXT NOT NULL DEFAULT '',
  bank_details  TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_invoice_templates" ON invoice_templates;
CREATE POLICY "admins_manage_invoice_templates" ON invoice_templates
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- ============================================================
-- PART 8: invoices RLS — admins full access, customers read own
-- ============================================================

-- Admins need full access to the expanded invoices table
DROP POLICY IF EXISTS "admins_manage_invoices" ON invoices;
CREATE POLICY "admins_manage_invoices" ON invoices
  FOR ALL TO authenticated USING (is_admin()) WITH CHECK (is_admin());

-- Customers can read their own invoices
DROP POLICY IF EXISTS "customers_read_own_invoices" ON invoices;
CREATE POLICY "customers_read_own_invoices" ON invoices
  FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

-- ============================================================
-- Indexes for common invoice queries
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_invoices_customer_id   ON invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_order_id      ON invoices(order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status        ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at    ON invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_order_source    ON orders(order_source);
