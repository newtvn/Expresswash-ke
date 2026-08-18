-- ============================================================
-- Ledger ingest: provenance, idempotency, audit inbox + RPC
--
-- Phase 1 keystone. Adds the columns that let a journal entry be traced
-- back to the external system that produced it, an append-only inbox of
-- every received event (for observability / replay), and the idempotent
-- posting RPC the ledger-ingest Edge Function calls.
-- ============================================================

-- ------------------------------------------------------------
-- Provenance + idempotency on journal entries
-- ------------------------------------------------------------

ALTER TABLE ledger_journal_entries
  ADD COLUMN IF NOT EXISTS source_system TEXT,
  ADD COLUMN IF NOT EXISTS external_id TEXT,
  ADD COLUMN IF NOT EXISTS business TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Allow ingested entries as a first-class source type alongside the
-- existing operational sources.
ALTER TABLE ledger_journal_entries
  DROP CONSTRAINT IF EXISTS ledger_journal_entries_source_type_check;
ALTER TABLE ledger_journal_entries
  ADD CONSTRAINT ledger_journal_entries_source_type_check
  CHECK (source_type IN (
    'invoice', 'payment_received', 'expense', 'bill', 'payment_made',
    'credit_note', 'manual_adjustment', 'reversal', 'external'
  ));

-- Idempotency: the same external event (source_system + external_id) can
-- never post twice. Partial index so native Expresswash entries (NULL
-- source_system) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_ledger_journal_entries_source_external
  ON ledger_journal_entries(source_system, external_id)
  WHERE source_system IS NOT NULL AND external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_journal_entries_business
  ON ledger_journal_entries(business)
  WHERE business IS NOT NULL;

-- ------------------------------------------------------------
-- Ingest inbox: append-only record of every received event
--
-- Gives us a durable audit trail and a place to inspect/replay failures
-- independent of whether a journal entry was ultimately posted.
-- ------------------------------------------------------------

CREATE TABLE IF NOT EXISTS ledger_ingest_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_system TEXT NOT NULL,
  event_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  business TEXT,
  amount NUMERIC(14,2),
  currency TEXT NOT NULL DEFAULT 'KES',
  provider TEXT,
  idempotency_key TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN ('received', 'posted', 'duplicate', 'failed')),
  journal_entry_id UUID REFERENCES ledger_journal_entries(id) ON DELETE SET NULL,
  error_message TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ,
  UNIQUE (source_system, external_id)
);

CREATE INDEX IF NOT EXISTS idx_ledger_ingest_events_status
  ON ledger_ingest_events(status, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_ingest_events_source
  ON ledger_ingest_events(source_system, event_type);

ALTER TABLE ledger_ingest_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_ingest_events_admin_all" ON ledger_ingest_events;
CREATE POLICY "ledger_ingest_events_admin_all" ON ledger_ingest_events
  FOR ALL TO authenticated USING (accounting_is_admin()) WITH CHECK (accounting_is_admin());

-- ------------------------------------------------------------
-- Account resolution helper
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION resolve_account_id_by_key(p_system_key TEXT)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id
  FROM chart_of_accounts
  WHERE system_key = p_system_key AND active = TRUE;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'No active account for system_key %', p_system_key
      USING ERRCODE = 'no_data_found';
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ------------------------------------------------------------
-- post_ingested_journal_entry
--
-- Idempotent, service-role-only entry point for external financial events.
-- Resolves the (source_system, event_type) mapping (or explicit account-key
-- overrides), posts a balanced two-line journal entry tagged with full
-- provenance, and records the event in the ingest inbox.
--
-- Returns JSONB: { success, idempotent, journal_entry_id, error }.
-- Never gates on accounting_is_admin(): it is NOT granted to `authenticated`,
-- so the only callers are the service role (via the Edge Function) and
-- postgres. This is the security boundary for cross-app ingestion.
-- ------------------------------------------------------------

CREATE OR REPLACE FUNCTION post_ingested_journal_entry(
  p_source_system TEXT,
  p_event_type TEXT,
  p_external_id TEXT,
  p_amount NUMERIC,
  p_business TEXT DEFAULT NULL,
  p_entry_date DATE DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_currency TEXT DEFAULT 'KES',
  p_memo TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_idempotency_key TEXT DEFAULT NULL,
  p_debit_account_key TEXT DEFAULT NULL,
  p_credit_account_key TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_amount NUMERIC(14,2);
  v_existing_entry UUID;
  v_debit_key TEXT;
  v_credit_key TEXT;
  v_description TEXT;
  v_debit_account UUID;
  v_credit_account UUID;
  v_entry_id UUID;
  v_entry_number TEXT;
  v_entry_date DATE;
  v_business TEXT;
BEGIN
  -- --- Input validation -------------------------------------------------
  IF COALESCE(TRIM(p_source_system), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'source_system is required');
  END IF;
  IF COALESCE(TRIM(p_event_type), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'event_type is required');
  END IF;
  IF COALESCE(TRIM(p_external_id), '') = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'external_id is required');
  END IF;

  v_amount := ROUND(COALESCE(p_amount, 0), 2);
  IF v_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'amount must be greater than zero');
  END IF;

  v_business := COALESCE(NULLIF(TRIM(p_business), ''), p_source_system);
  v_entry_date := COALESCE(p_entry_date, CURRENT_DATE);

  -- --- Idempotency ------------------------------------------------------
  -- If this external event already posted, return the existing entry.
  SELECT id INTO v_existing_entry
  FROM ledger_journal_entries
  WHERE source_system = p_source_system
    AND external_id = p_external_id
  LIMIT 1;

  IF v_existing_entry IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'idempotent', true,
      'journal_entry_id', v_existing_entry
    );
  END IF;

  -- --- Resolve mapping / account keys ----------------------------------
  v_debit_key := NULLIF(TRIM(p_debit_account_key), '');
  v_credit_key := NULLIF(TRIM(p_credit_account_key), '');

  IF v_debit_key IS NULL OR v_credit_key IS NULL THEN
    SELECT
      COALESCE(v_debit_key, debit_account_key),
      COALESCE(v_credit_key, credit_account_key),
      description_template
    INTO v_debit_key, v_credit_key, v_description
    FROM ledger_ingest_mappings
    WHERE source_system = p_source_system
      AND event_type = p_event_type
      AND active = TRUE;
  END IF;

  IF v_debit_key IS NULL OR v_credit_key IS NULL THEN
    -- No mapping and no override: record the failure, do not post.
    INSERT INTO ledger_ingest_events (
      source_system, event_type, external_id, business, amount, currency,
      provider, idempotency_key, payload, status, error_message, processed_at
    ) VALUES (
      p_source_system, p_event_type, p_external_id, v_business, v_amount, p_currency,
      p_provider, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb),
      'failed', format('No active mapping for (%s, %s)', p_source_system, p_event_type), NOW()
    )
    ON CONFLICT (source_system, external_id) DO UPDATE SET
      status = 'failed',
      error_message = EXCLUDED.error_message,
      processed_at = NOW();

    RETURN jsonb_build_object(
      'success', false,
      'error', format('No active mapping for (%s, %s)', p_source_system, p_event_type)
    );
  END IF;

  -- Resolve accounts (raises if a system_key is missing/inactive).
  v_debit_account := resolve_account_id_by_key(v_debit_key);
  v_credit_account := resolve_account_id_by_key(v_credit_key);

  v_description := COALESCE(NULLIF(TRIM(p_memo), ''), v_description,
    format('%s %s', p_source_system, p_event_type));

  -- --- Post the balanced entry -----------------------------------------
  v_entry_number := 'IJE-' || TO_CHAR(v_entry_date, 'YYYYMMDD') || '-'
    || UPPER(SUBSTRING(REPLACE(gen_random_uuid()::TEXT, '-', '') FROM 1 FOR 8));

  INSERT INTO ledger_journal_entries (
    entry_number, source_type, source_id, entry_date, memo, status,
    source_system, external_id, business, idempotency_key, posted_at
  ) VALUES (
    v_entry_number, 'external', NULL, v_entry_date, v_description, 'posted',
    p_source_system, p_external_id, v_business, p_idempotency_key, NOW()
  )
  RETURNING id INTO v_entry_id;

  INSERT INTO ledger_journal_lines (journal_entry_id, account_id, debit, credit, description, metadata)
  VALUES
    (v_entry_id, v_debit_account, v_amount, 0, v_description, COALESCE(p_metadata, '{}'::jsonb)),
    (v_entry_id, v_credit_account, 0, v_amount, v_description, COALESCE(p_metadata, '{}'::jsonb));

  PERFORM assert_ledger_entry_balanced(v_entry_id);

  -- --- Record the inbox row (posted) -----------------------------------
  INSERT INTO ledger_ingest_events (
    source_system, event_type, external_id, business, amount, currency,
    provider, idempotency_key, payload, status, journal_entry_id, processed_at
  ) VALUES (
    p_source_system, p_event_type, p_external_id, v_business, v_amount, p_currency,
    p_provider, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb),
    'posted', v_entry_id, NOW()
  )
  ON CONFLICT (source_system, external_id) DO UPDATE SET
    status = 'posted',
    journal_entry_id = EXCLUDED.journal_entry_id,
    error_message = NULL,
    processed_at = NOW();

  RETURN jsonb_build_object(
    'success', true,
    'idempotent', false,
    'journal_entry_id', v_entry_id
  );

EXCEPTION WHEN OTHERS THEN
  -- Any failure past validation: persist a failed inbox row (this INSERT
  -- runs after the block's rollback, so it commits) and surface the error.
  INSERT INTO ledger_ingest_events (
    source_system, event_type, external_id, business, amount, currency,
    provider, idempotency_key, payload, status, error_message, processed_at
  ) VALUES (
    p_source_system, p_event_type, p_external_id, v_business, v_amount, p_currency,
    p_provider, p_idempotency_key, COALESCE(p_metadata, '{}'::jsonb),
    'failed', SQLERRM, NOW()
  )
  ON CONFLICT (source_system, external_id) DO UPDATE SET
    status = 'failed',
    error_message = EXCLUDED.error_message,
    processed_at = NOW();

  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Service-role only. Deliberately NOT granted to `authenticated`.
REVOKE ALL ON FUNCTION post_ingested_journal_entry(
  TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION post_ingested_journal_entry(
  TEXT, TEXT, TEXT, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT
) TO service_role;

GRANT EXECUTE ON FUNCTION resolve_account_id_by_key(TEXT) TO service_role;
