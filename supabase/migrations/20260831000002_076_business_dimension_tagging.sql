-- B1: tag source documents with a business slug + backfill to 'expresswash'.
-- Behaviour-neutral: nothing reads `business` until 078-080, so P&L / balance
-- sheet / receivables / payables / VAT snapshots stay byte-identical.

-- 1. Add the dimension. COA/contacts/tax rates stay global (one set of books).
--    ledger_journal_entries.business already exists (073) and gets no default.
ALTER TABLE invoices      ADD COLUMN IF NOT EXISTS business TEXT;
ALTER TABLE bills         ADD COLUMN IF NOT EXISTS business TEXT;
ALTER TABLE payments      ADD COLUMN IF NOT EXISTS business TEXT;
ALTER TABLE payments_made ADD COLUMN IF NOT EXISTS business TEXT;
ALTER TABLE credit_notes  ADD COLUMN IF NOT EXISTS business TEXT;
ALTER TABLE expenses      ADD COLUMN IF NOT EXISTS business TEXT;

-- 2. Backfill (idempotent). Every source document today is Expresswash's.
UPDATE invoices      SET business = 'expresswash' WHERE business IS NULL;
UPDATE bills         SET business = 'expresswash' WHERE business IS NULL;
UPDATE payments      SET business = 'expresswash' WHERE business IS NULL;
UPDATE payments_made SET business = 'expresswash' WHERE business IS NULL;
UPDATE credit_notes  SET business = 'expresswash' WHERE business IS NULL;
UPDATE expenses      SET business = 'expresswash' WHERE business IS NULL;

-- Native ledger entries only. NEVER widen this predicate: ingested rows carry
-- their own business + a non-NULL source_system and must be left untouched.
UPDATE ledger_journal_entries
  SET business = 'expresswash'
  WHERE business IS NULL AND source_system IS NULL;

-- 3. Defaults so writers that don't yet set business stay tagged.
ALTER TABLE invoices      ALTER COLUMN business SET DEFAULT 'expresswash';
ALTER TABLE bills         ALTER COLUMN business SET DEFAULT 'expresswash';
ALTER TABLE payments      ALTER COLUMN business SET DEFAULT 'expresswash';
ALTER TABLE payments_made ALTER COLUMN business SET DEFAULT 'expresswash';
ALTER TABLE credit_notes  ALTER COLUMN business SET DEFAULT 'expresswash';
ALTER TABLE expenses      ALTER COLUMN business SET DEFAULT 'expresswash';

-- 4. Indexes for the per-business filters in B2.
CREATE INDEX IF NOT EXISTS idx_invoices_business      ON invoices(business);
CREATE INDEX IF NOT EXISTS idx_bills_business         ON bills(business);
CREATE INDEX IF NOT EXISTS idx_payments_business      ON payments(business);
CREATE INDEX IF NOT EXISTS idx_payments_made_business ON payments_made(business);
CREATE INDEX IF NOT EXISTS idx_credit_notes_business  ON credit_notes(business);
CREATE INDEX IF NOT EXISTS idx_expenses_business      ON expenses(business);

-- 5. Ledger FK -> registry. DEFERRABLE + NOT VALID: new rows checked, existing
--    rows validated later (082). NULL business allowed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ledger_journal_entries_business_fkey') THEN
    ALTER TABLE ledger_journal_entries
      ADD CONSTRAINT ledger_journal_entries_business_fkey
      FOREIGN KEY (business) REFERENCES businesses(slug)
      DEFERRABLE INITIALLY DEFERRED NOT VALID;
  END IF;
END $$;
