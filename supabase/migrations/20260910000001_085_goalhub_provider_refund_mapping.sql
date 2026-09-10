-- Reverse Goalhub PesaPal cash receipts only after Goalhub confirms that the
-- provider reports the original payment as reversed. Idempotency is enforced
-- by ledger-ingest on (source_system, external_id).
INSERT INTO ledger_ingest_mappings (
  source_system, event_type, debit_account_key, credit_account_key,
  description_template, active
) VALUES (
  'goalhub', 'provider_refund', 'turf_revenue', 'mpesa_goalhub',
  'Goalhub PesaPal provider refund', TRUE
)
ON CONFLICT (source_system, event_type) DO UPDATE SET
  debit_account_key = EXCLUDED.debit_account_key,
  credit_account_key = EXCLUDED.credit_account_key,
  description_template = EXCLUDED.description_template,
  active = TRUE;
