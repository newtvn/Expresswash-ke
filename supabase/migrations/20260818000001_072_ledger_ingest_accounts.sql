-- ============================================================
-- Ledger ingest: chart-of-accounts extensions + event mapping
--
-- Phase 1 of the multi-app accounting hub. Expresswash becomes the
-- single source of truth ("one shared set of books"): external systems
-- (starting with Goalhub) push financial events which are mapped to
-- double-entry journal entries in THIS ledger.
--
-- This migration only adds the accounts those events post against and a
-- configurable mapping table. The ingest RPC + provenance columns live in
-- migration 073.
-- ============================================================

-- ------------------------------------------------------------
-- Additional chart-of-accounts entries for source businesses
--
-- "One shared set of books": every business posts into the same COA,
-- separated by dedicated income/asset/liability accounts (and a `business`
-- tag on each journal entry, added in 073). Codes are chosen to sit
-- alongside the existing seed (4000 Sales Revenue, 4900 Other Income).
-- ------------------------------------------------------------

INSERT INTO chart_of_accounts (code, name, account_type, normal_balance, system_key, description)
VALUES
  -- Asset: money actually received into Goalhub's mobile-money account.
  ('1021', 'M-Pesa - Goalhub', 'asset', 'debit', 'mpesa_goalhub',
    'Mobile money received via the Goalhub turf platform'),
  -- Income streams (kept distinct so a combined P&L still breaks down by line).
  ('4100', 'Turf Revenue', 'income', 'credit', 'turf_revenue',
    'Booking revenue from Goalhub turf hire'),
  ('4110', 'Turf Cancellation Fees', 'income', 'credit', 'cancellation_fee_income',
    'Cancellation fees retained on Goalhub bookings'),
  ('4120', 'Fine Income', 'income', 'credit', 'fine_income',
    'Post-game fines charged on Goalhub bookings'),
  ('4130', 'Academy Revenue', 'income', 'credit', 'academy_revenue',
    'Academy enrollment and tuition revenue from Goalhub'),
  -- Liability: prepaid customer wallet balances are NOT revenue until spent.
  ('2210', 'Customer Wallet - Goalhub', 'liability', 'credit', 'customer_wallet_goalhub',
    'Unspent customer wallet/credit balances held for Goalhub users')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  account_type = EXCLUDED.account_type,
  normal_balance = EXCLUDED.normal_balance,
  system_key = EXCLUDED.system_key,
  description = EXCLUDED.description,
  active = TRUE,
  updated_at = NOW();

-- ------------------------------------------------------------
-- Event -> account mapping
--
-- Each (source_system, event_type) maps a single monetary amount to a
-- debit account and a credit account (referenced by system_key so the
-- mapping survives COA id changes). The ingest RPC resolves these keys to
-- account ids at post time. Mappings are data, not code: new event types
-- or account changes need no redeploy.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ledger_ingest_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  event_type TEXT NOT NULL,
  debit_account_key TEXT NOT NULL,
  credit_account_key TEXT NOT NULL,
  description_template TEXT,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_system, event_type)
);

CREATE INDEX IF NOT EXISTS idx_ledger_ingest_mappings_lookup
  ON ledger_ingest_mappings(source_system, event_type)
  WHERE active = TRUE;

ALTER TABLE ledger_ingest_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_ingest_mappings_admin_all" ON ledger_ingest_mappings;
CREATE POLICY "ledger_ingest_mappings_admin_all" ON ledger_ingest_mappings
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

DROP TRIGGER IF EXISTS trg_ledger_ingest_mappings_updated_at ON ledger_ingest_mappings;
CREATE TRIGGER trg_ledger_ingest_mappings_updated_at
  BEFORE UPDATE ON ledger_ingest_mappings
  FOR EACH ROW
  EXECUTE FUNCTION accounting_touch_updated_at();

-- ------------------------------------------------------------
-- Seed Goalhub mappings
--
-- Starter set covering Goalhub's money movements. These are deliberately
-- cash-basis (we record money that actually moves, not accrued discounts):
--   booking_payment    money in for a turf booking      DR M-Pesa / CR Turf Revenue
--   wallet_topup       prepaid wallet load (a liability) DR M-Pesa / CR Customer Wallet
--   wallet_redemption  wallet spent on a booking         DR Customer Wallet / CR Turf Revenue
--   refund             booking refunded to wallet/credit DR Turf Revenue / CR Customer Wallet
--   cancellation_fee   fee retained in cash              DR M-Pesa / CR Cancellation Fees
--   fine_payment       post-game fine paid               DR M-Pesa / CR Fine Income
--   enrollment_payment academy enrollment/tuition        DR M-Pesa / CR Academy Revenue
--
-- These will be validated (and refined for edge cases) against Goalhub's
-- own revenue dashboard during Phase 2 reconciliation.
-- ------------------------------------------------------------

INSERT INTO ledger_ingest_mappings (source_system, event_type, debit_account_key, credit_account_key, description_template)
VALUES
  ('goalhub', 'booking_payment',    'mpesa_goalhub',           'turf_revenue',            'Goalhub turf booking payment'),
  ('goalhub', 'wallet_topup',       'mpesa_goalhub',           'customer_wallet_goalhub', 'Goalhub wallet top-up'),
  ('goalhub', 'wallet_redemption',  'customer_wallet_goalhub', 'turf_revenue',            'Goalhub wallet redeemed for booking'),
  ('goalhub', 'refund',             'turf_revenue',            'customer_wallet_goalhub', 'Goalhub booking refund to wallet'),
  ('goalhub', 'cancellation_fee',   'mpesa_goalhub',           'cancellation_fee_income', 'Goalhub cancellation fee retained'),
  ('goalhub', 'fine_payment',       'mpesa_goalhub',           'fine_income',             'Goalhub post-game fine'),
  ('goalhub', 'enrollment_payment', 'mpesa_goalhub',           'academy_revenue',         'Goalhub academy enrollment')
ON CONFLICT (source_system, event_type) DO UPDATE SET
  debit_account_key = EXCLUDED.debit_account_key,
  credit_account_key = EXCLUDED.credit_account_key,
  description_template = EXCLUDED.description_template,
  active = TRUE,
  updated_at = NOW();

GRANT SELECT ON ledger_ingest_mappings TO authenticated;
