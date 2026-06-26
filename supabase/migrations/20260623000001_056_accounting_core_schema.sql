-- ============================================================
-- Accounting core schema
--
-- Additive canonical accounting layer for Zoho-like finance:
-- contacts, items, tax rates, chart of accounts, invoice lines,
-- payment allocations, bills/payables, credit notes, and a proper
-- double-entry ledger. Existing UI tables remain compatible.
-- ============================================================

-- ============================================================
-- Helper functions
-- ============================================================

CREATE OR REPLACE FUNCTION accounting_is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN is_admin();
EXCEPTION WHEN undefined_function THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION accounting_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- Contacts: customers, suppliers, or both
-- ============================================================

CREATE TABLE IF NOT EXISTS contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_type TEXT NOT NULL DEFAULT 'customer'
    CHECK (contact_type IN ('customer', 'supplier', 'both')),
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  tax_pin TEXT,
  app_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  source TEXT NOT NULL DEFAULT 'admin'
    CHECK (source IN ('app', 'walk_in', 'call', 'whatsapp', 'admin', 'import')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_app_user_id
  ON contacts(app_user_id)
  WHERE app_user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_contacts_type_active ON contacts(contact_type, active);
CREATE INDEX IF NOT EXISTS idx_contacts_name ON contacts(name);
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;

ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contacts_admin_all" ON contacts;
CREATE POLICY "contacts_admin_all" ON contacts
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP POLICY IF EXISTS "contacts_customer_read_self" ON contacts;
CREATE POLICY "contacts_customer_read_self" ON contacts
  FOR SELECT TO authenticated USING (app_user_id = auth.uid());

DROP TRIGGER IF EXISTS trg_contacts_updated_at ON contacts;
CREATE TRIGGER trg_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

INSERT INTO contacts (contact_type, name, phone, email, app_user_id, source)
SELECT
  'customer',
  COALESCE(NULLIF(p.name, ''), p.email, p.phone, 'Customer'),
  p.phone,
  p.email,
  p.id,
  'app'
FROM profiles p
WHERE p.role = 'customer'
  AND NOT EXISTS (
    SELECT 1 FROM contacts c WHERE c.app_user_id = p.id
  );

-- ============================================================
-- Tax rates and chart of accounts
-- ============================================================

CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  rate NUMERIC(7,4) NOT NULL CHECK (rate >= 0 AND rate <= 1),
  tax_type TEXT NOT NULL DEFAULT 'vat' CHECK (tax_type IN ('vat', 'withholding', 'other')),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE tax_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tax_rates_admin_all" ON tax_rates;
CREATE POLICY "tax_rates_admin_all" ON tax_rates
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP POLICY IF EXISTS "tax_rates_authenticated_read" ON tax_rates;
CREATE POLICY "tax_rates_authenticated_read" ON tax_rates
  FOR SELECT TO authenticated USING (active = TRUE);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tax_rates_default
  ON tax_rates(is_default)
  WHERE is_default = TRUE;

DROP TRIGGER IF EXISTS trg_tax_rates_updated_at ON tax_rates;
CREATE TRIGGER trg_tax_rates_updated_at
  BEFORE UPDATE ON tax_rates
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

INSERT INTO tax_rates (name, rate, tax_type, is_default)
VALUES ('VAT 16%', 0.1600, 'vat', TRUE)
ON CONFLICT (name) DO UPDATE SET
  rate = EXCLUDED.rate,
  tax_type = EXCLUDED.tax_type,
  is_default = EXCLUDED.is_default,
  active = TRUE,
  updated_at = NOW();

CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL
    CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  parent_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit', 'credit')),
  description TEXT,
  system_key TEXT UNIQUE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_type ON chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_parent ON chart_of_accounts(parent_id);

ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chart_of_accounts_admin_all" ON chart_of_accounts;
CREATE POLICY "chart_of_accounts_admin_all" ON chart_of_accounts
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP POLICY IF EXISTS "chart_of_accounts_authenticated_read" ON chart_of_accounts;
CREATE POLICY "chart_of_accounts_authenticated_read" ON chart_of_accounts
  FOR SELECT TO authenticated USING (active = TRUE);

DROP TRIGGER IF EXISTS trg_chart_of_accounts_updated_at ON chart_of_accounts;
CREATE TRIGGER trg_chart_of_accounts_updated_at
  BEFORE UPDATE ON chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, system_key, description)
VALUES
  ('1000', 'Cash', 'asset', 'debit', 'cash', 'Cash on hand'),
  ('1010', 'Bank', 'asset', 'debit', 'bank', 'Bank account'),
  ('1020', 'M-Pesa', 'asset', 'debit', 'mpesa', 'Mobile money account'),
  ('1100', 'Accounts Receivable', 'asset', 'debit', 'accounts_receivable', 'Customer invoices owed'),
  ('1200', 'Input VAT', 'asset', 'debit', 'input_vat', 'VAT recoverable on purchases'),
  ('2000', 'Accounts Payable', 'liability', 'credit', 'accounts_payable', 'Supplier bills owed'),
  ('2100', 'VAT Payable', 'liability', 'credit', 'vat_payable', 'VAT owed on sales'),
  ('3000', 'Owner Equity', 'equity', 'credit', 'owner_equity', 'Owner equity'),
  ('3100', 'Retained Earnings', 'equity', 'credit', 'retained_earnings', 'Retained earnings'),
  ('4000', 'Sales Revenue', 'income', 'credit', 'sales_revenue', 'Revenue from services/products'),
  ('4900', 'Other Income', 'income', 'credit', 'other_income', 'Other income'),
  ('5000', 'Cleaning Supplies', 'expense', 'debit', 'cleaning_supplies', 'Cleaning supplies expense'),
  ('5010', 'Staff Costs', 'expense', 'debit', 'staff_costs', 'Staff costs'),
  ('5020', 'Rent', 'expense', 'debit', 'rent', 'Rent expense'),
  ('5030', 'Transport', 'expense', 'debit', 'transport', 'Transport expense'),
  ('5040', 'Utilities', 'expense', 'debit', 'utilities', 'Utilities expense'),
  ('5090', 'Other Expenses', 'expense', 'debit', 'other_expenses', 'Other operating expenses')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  normal_balance = EXCLUDED.normal_balance,
  system_key = EXCLUDED.system_key,
  description = EXCLUDED.description,
  active = TRUE,
  updated_at = NOW();

-- ============================================================
-- Items/services and canonical invoice lines
-- ============================================================

CREATE TABLE IF NOT EXISTS accounting_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  item_type TEXT NOT NULL DEFAULT 'service' CHECK (item_type IN ('service', 'product', 'fee')),
  default_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (default_price >= 0),
  sales_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  expense_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_accounting_items_name_active
  ON accounting_items(lower(name))
  WHERE active = TRUE;

ALTER TABLE accounting_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounting_items_admin_all" ON accounting_items;
CREATE POLICY "accounting_items_admin_all" ON accounting_items
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP POLICY IF EXISTS "accounting_items_authenticated_read" ON accounting_items;
CREATE POLICY "accounting_items_authenticated_read" ON accounting_items
  FOR SELECT TO authenticated USING (active = TRUE);

DROP TRIGGER IF EXISTS trg_accounting_items_updated_at ON accounting_items;
CREATE TRIGGER trg_accounting_items_updated_at
  BEFORE UPDATE ON accounting_items
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

CREATE TABLE IF NOT EXISTS invoice_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_id UUID REFERENCES accounting_items(id) ON DELETE SET NULL,
  description_snapshot TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  revenue_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_lines_invoice_id ON invoice_lines(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_lines_item_id ON invoice_lines(item_id);

ALTER TABLE invoice_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_lines_admin_all" ON invoice_lines;
CREATE POLICY "invoice_lines_admin_all" ON invoice_lines
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP POLICY IF EXISTS "invoice_lines_customer_read_own" ON invoice_lines;
CREATE POLICY "invoice_lines_customer_read_own" ON invoice_lines
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = invoice_lines.invoice_id
        AND i.customer_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF to_regclass('public.invoice_items') IS NOT NULL THEN
    EXECUTE $backfill$
      INSERT INTO invoice_lines (
        invoice_id,
        description_snapshot,
        quantity,
        unit_price,
        tax_amount,
        line_total,
        revenue_account_id
      )
      SELECT
        ii.invoice_id,
        COALESCE(NULLIF(ii.description, ''), 'Invoice item'),
        COALESCE(NULLIF(ii.quantity::NUMERIC, 0), 1),
        COALESCE(ii.unit_price, 0),
        0,
        COALESCE(ii.total, COALESCE(ii.quantity, 1) * COALESCE(ii.unit_price, 0)),
        (SELECT id FROM chart_of_accounts WHERE system_key = 'sales_revenue')
      FROM invoice_items ii
      WHERE NOT EXISTS (
        SELECT 1 FROM invoice_lines il
        WHERE il.invoice_id = ii.invoice_id
          AND il.description_snapshot = COALESCE(NULLIF(ii.description, ''), 'Invoice item')
          AND il.line_total = COALESCE(ii.total, COALESCE(ii.quantity, 1) * COALESCE(ii.unit_price, 0))
      )
    $backfill$;
  END IF;
END;
$$;

-- ============================================================
-- Payments, bills/payables, and credit notes
-- ============================================================

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_allocated NUMERIC(12,2) NOT NULL CHECK (amount_allocated > 0),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(payment_id, invoice_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_allocations_payment_id ON payment_allocations(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_allocations_invoice_id ON payment_allocations(invoice_id);

ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_allocations_admin_all" ON payment_allocations;
CREATE POLICY "payment_allocations_admin_all" ON payment_allocations
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP POLICY IF EXISTS "payment_allocations_customer_read_own" ON payment_allocations;
CREATE POLICY "payment_allocations_customer_read_own" ON payment_allocations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM invoices i
      WHERE i.id = payment_allocations.invoice_id
        AND i.customer_id = auth.uid()
    )
  );

CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_number TEXT NOT NULL UNIQUE,
  supplier_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'open', 'partially_paid', 'paid', 'overdue', 'void')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  discount_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_total >= 0),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount_paid >= 0),
  balance_due NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (balance_due >= 0),
  currency TEXT NOT NULL DEFAULT 'KES',
  posted_journal_entry_id UUID,
  notes TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_bills_supplier ON bills(supplier_contact_id);
CREATE INDEX IF NOT EXISTS idx_bills_status_due_date ON bills(status, due_date);

ALTER TABLE bills ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bills_admin_all" ON bills;
CREATE POLICY "bills_admin_all" ON bills
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP TRIGGER IF EXISTS trg_bills_updated_at ON bills;
CREATE TRIGGER trg_bills_updated_at
  BEFORE UPDATE ON bills
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

CREATE TABLE IF NOT EXISTS bill_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  item_id UUID REFERENCES accounting_items(id) ON DELETE SET NULL,
  description_snapshot TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (discount_amount >= 0),
  tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  expense_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bill_lines_bill_id ON bill_lines(bill_id);

ALTER TABLE bill_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bill_lines_admin_all" ON bill_lines;
CREATE POLICY "bill_lines_admin_all" ON bill_lines
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

CREATE TABLE IF NOT EXISTS payments_made (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  payment_number TEXT NOT NULL UNIQUE,
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL DEFAULT 'bank_transfer',
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('pending', 'confirmed', 'reversed', 'failed')),
  idempotency_key TEXT UNIQUE,
  posted_journal_entry_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_made_supplier ON payments_made(supplier_contact_id);
CREATE INDEX IF NOT EXISTS idx_payments_made_date ON payments_made(payment_date DESC);

ALTER TABLE payments_made ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_made_admin_all" ON payments_made;
CREATE POLICY "payments_made_admin_all" ON payments_made
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP TRIGGER IF EXISTS trg_payments_made_updated_at ON payments_made;
CREATE TRIGGER trg_payments_made_updated_at
  BEFORE UPDATE ON payments_made
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

CREATE TABLE IF NOT EXISTS payment_made_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_made_id UUID NOT NULL REFERENCES payments_made(id) ON DELETE CASCADE,
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  amount_allocated NUMERIC(12,2) NOT NULL CHECK (amount_allocated > 0),
  allocated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  UNIQUE(payment_made_id, bill_id)
);

ALTER TABLE payment_made_allocations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payment_made_allocations_admin_all" ON payment_made_allocations;
CREATE POLICY "payment_made_allocations_admin_all" ON payment_made_allocations
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

CREATE TABLE IF NOT EXISTS credit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_number TEXT NOT NULL UNIQUE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'issued', 'applied', 'void')),
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  tax_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_total >= 0),
  total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  applied_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (applied_amount >= 0),
  reason TEXT,
  posted_journal_entry_id UUID,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  voided_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_credit_notes_invoice_id ON credit_notes(invoice_id);
CREATE INDEX IF NOT EXISTS idx_credit_notes_contact_id ON credit_notes(contact_id);

ALTER TABLE credit_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_notes_admin_all" ON credit_notes;
CREATE POLICY "credit_notes_admin_all" ON credit_notes
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP TRIGGER IF EXISTS trg_credit_notes_updated_at ON credit_notes;
CREATE TRIGGER trg_credit_notes_updated_at
  BEFORE UPDATE ON credit_notes
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

CREATE TABLE IF NOT EXISTS credit_note_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_note_id UUID NOT NULL REFERENCES credit_notes(id) ON DELETE CASCADE,
  description_snapshot TEXT NOT NULL,
  quantity NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (tax_amount >= 0),
  line_total NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (line_total >= 0),
  revenue_account_id UUID REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE credit_note_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "credit_note_lines_admin_all" ON credit_note_lines;
CREATE POLICY "credit_note_lines_admin_all" ON credit_note_lines
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

-- ============================================================
-- Double-entry ledger
-- ============================================================

CREATE TABLE IF NOT EXISTS ledger_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL
    CHECK (source_type IN ('invoice', 'payment_received', 'expense', 'bill', 'payment_made', 'credit_note', 'manual_adjustment', 'reversal')),
  source_id UUID,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  memo TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'voided', 'reversed')),
  reversed_entry_id UUID REFERENCES ledger_journal_entries(id) ON DELETE SET NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_journal_entries_date ON ledger_journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_journal_entries_source ON ledger_journal_entries(source_type, source_id);

ALTER TABLE ledger_journal_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_journal_entries_admin_all" ON ledger_journal_entries;
CREATE POLICY "ledger_journal_entries_admin_all" ON ledger_journal_entries
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP TRIGGER IF EXISTS trg_ledger_journal_entries_updated_at ON ledger_journal_entries;
CREATE TRIGGER trg_ledger_journal_entries_updated_at
  BEFORE UPDATE ON ledger_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

CREATE TABLE IF NOT EXISTS ledger_journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES ledger_journal_entries(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES chart_of_accounts(id) ON DELETE RESTRICT,
  debit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  tax_rate_id UUID REFERENCES tax_rates(id) ON DELETE SET NULL,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (
    (debit > 0 AND credit = 0)
    OR (credit > 0 AND debit = 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_ledger_journal_lines_entry ON ledger_journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_ledger_journal_lines_account ON ledger_journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_journal_lines_contact ON ledger_journal_lines(contact_id);

ALTER TABLE ledger_journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_journal_lines_admin_all" ON ledger_journal_lines;
CREATE POLICY "ledger_journal_lines_admin_all" ON ledger_journal_lines
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

CREATE OR REPLACE FUNCTION assert_ledger_entry_balanced(p_journal_entry_id UUID)
RETURNS VOID AS $$
DECLARE
  v_debit NUMERIC(12,2);
  v_credit NUMERIC(12,2);
BEGIN
  SELECT
    COALESCE(SUM(debit), 0),
    COALESCE(SUM(credit), 0)
  INTO v_debit, v_credit
  FROM ledger_journal_lines
  WHERE journal_entry_id = p_journal_entry_id;

  IF v_debit <= 0 OR v_credit <= 0 OR ABS(v_debit - v_credit) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry % is not balanced: debit %, credit %', p_journal_entry_id, v_debit, v_credit;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION post_journal_entry(
  p_source_type TEXT,
  p_source_id UUID,
  p_entry_date DATE,
  p_memo TEXT,
  p_lines JSONB
) RETURNS UUID AS $$
DECLARE
  v_entry_id UUID;
  v_entry_number TEXT;
  v_line JSONB;
  v_account_id UUID;
  v_debit NUMERIC(12,2);
  v_credit NUMERIC(12,2);
  v_total_debit NUMERIC(12,2) := 0;
  v_total_credit NUMERIC(12,2) := 0;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can post journal entries';
  END IF;

  IF COALESCE(jsonb_typeof(p_lines), '') <> 'array' OR COALESCE(jsonb_array_length(p_lines), 0) < 2 THEN
    RAISE EXCEPTION 'Journal entry requires at least two lines';
  END IF;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_account_id := (v_line->>'account_id')::UUID;
    v_debit := COALESCE((v_line->>'debit')::NUMERIC, 0);
    v_credit := COALESCE((v_line->>'credit')::NUMERIC, 0);

    IF v_account_id IS NULL THEN
      RAISE EXCEPTION 'Journal line account_id is required';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM chart_of_accounts WHERE id = v_account_id AND active = TRUE) THEN
      RAISE EXCEPTION 'Invalid or inactive account_id %', v_account_id;
    END IF;

    IF (v_debit > 0 AND v_credit > 0) OR (v_debit = 0 AND v_credit = 0) THEN
      RAISE EXCEPTION 'Each journal line must have either debit or credit, not both/neither';
    END IF;

    v_total_debit := v_total_debit + v_debit;
    v_total_credit := v_total_credit + v_credit;
  END LOOP;

  IF v_total_debit <= 0 OR ABS(v_total_debit - v_total_credit) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry must balance: debit %, credit %', v_total_debit, v_total_credit;
  END IF;

  v_entry_number := 'JE-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-' || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));

  INSERT INTO ledger_journal_entries (
    entry_number,
    source_type,
    source_id,
    entry_date,
    memo,
    status,
    created_by,
    posted_at
  )
  VALUES (
    v_entry_number,
    p_source_type,
    p_source_id,
    COALESCE(p_entry_date, CURRENT_DATE),
    p_memo,
    'posted',
    auth.uid(),
    NOW()
  )
  RETURNING id INTO v_entry_id;

  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO ledger_journal_lines (
      journal_entry_id,
      account_id,
      debit,
      credit,
      contact_id,
      tax_rate_id,
      description,
      metadata
    )
    VALUES (
      v_entry_id,
      (v_line->>'account_id')::UUID,
      COALESCE((v_line->>'debit')::NUMERIC, 0),
      COALESCE((v_line->>'credit')::NUMERIC, 0),
      NULLIF(v_line->>'contact_id', '')::UUID,
      NULLIF(v_line->>'tax_rate_id', '')::UUID,
      v_line->>'description',
      COALESCE(v_line->'metadata', '{}'::jsonb)
    );
  END LOOP;

  PERFORM assert_ledger_entry_balanced(v_entry_id);
  RETURN v_entry_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION reverse_journal_entry(
  p_journal_entry_id UUID,
  p_entry_date DATE,
  p_memo TEXT
) RETURNS UUID AS $$
DECLARE
  v_original RECORD;
  v_lines JSONB;
  v_reversal_id UUID;
BEGIN
  IF NOT accounting_is_admin() THEN
    RAISE EXCEPTION 'Only admins can reverse journal entries';
  END IF;

  SELECT * INTO v_original
  FROM ledger_journal_entries
  WHERE id = p_journal_entry_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  IF v_original.status <> 'posted' THEN
    RAISE EXCEPTION 'Only posted journal entries can be reversed';
  END IF;

  SELECT jsonb_agg(jsonb_build_object(
    'account_id', account_id,
    'debit', credit,
    'credit', debit,
    'contact_id', contact_id,
    'tax_rate_id', tax_rate_id,
    'description', COALESCE(description, '') || ' (reversal)',
    'metadata', metadata
  ))
  INTO v_lines
  FROM ledger_journal_lines
  WHERE journal_entry_id = p_journal_entry_id;

  v_reversal_id := post_journal_entry(
    'reversal',
    p_journal_entry_id,
    COALESCE(p_entry_date, CURRENT_DATE),
    COALESCE(p_memo, 'Reversal of ' || v_original.entry_number),
    v_lines
  );

  UPDATE ledger_journal_entries
  SET status = 'reversed',
      reversed_entry_id = v_reversal_id,
      updated_at = NOW()
  WHERE id = p_journal_entry_id;

  RETURN v_reversal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION post_journal_entry(TEXT, UUID, DATE, TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION reverse_journal_entry(UUID, DATE, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION assert_ledger_entry_balanced(UUID) TO authenticated;

-- ============================================================
-- Report views from canonical ledger
-- ============================================================

CREATE OR REPLACE VIEW ledger_account_balances AS
SELECT
  coa.id AS account_id,
  coa.code,
  coa.name,
  coa.account_type,
  coa.normal_balance,
  COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.debit ELSE 0 END), 0) AS total_debit,
  COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.credit ELSE 0 END), 0) AS total_credit,
  CASE
    WHEN coa.normal_balance = 'debit'
      THEN COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.debit ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.credit ELSE 0 END), 0)
    ELSE COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.credit ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.debit ELSE 0 END), 0)
  END AS balance
FROM chart_of_accounts coa
LEFT JOIN ledger_journal_lines l ON l.account_id = coa.id
LEFT JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
WHERE coa.active = TRUE
GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.normal_balance;

GRANT SELECT ON ledger_account_balances TO authenticated;
