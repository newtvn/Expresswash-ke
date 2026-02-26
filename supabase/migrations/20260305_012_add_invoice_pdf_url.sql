-- ============================================================
-- Migration: Add pdf_url to invoices, receipt_url to payments
-- WK2 Step 1: Enable PDF storage references
-- ============================================================

ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(500);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS receipt_url VARCHAR(500);

-- Verification
DO $$
BEGIN
  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'invoices' AND column_name = 'pdf_url'
  ), 'invoices.pdf_url column missing';

  ASSERT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'payments' AND column_name = 'receipt_url'
  ), 'payments.receipt_url column missing';

  RAISE NOTICE '[OK] pdf_url and receipt_url columns added';
END $$;
