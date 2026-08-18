-- ============================================================
-- Ledger ingest: split fine payments by funding source
--
-- A fine paid in cash debits M-Pesa; a fine paid from wallet credit debits
-- the customer-wallet liability. The generic `fine_payment` mapping can't
-- express both, so Goalhub emits the funding-specific event type and we map
-- each to the correct debit account. The generic mapping is retained as a
-- fallback for any caller that doesn't distinguish.
-- ============================================================

INSERT INTO ledger_ingest_mappings (source_system, event_type, debit_account_key, credit_account_key, description_template)
VALUES
  ('goalhub', 'fine_payment_cash',   'mpesa_goalhub',           'fine_income', 'Goalhub fine paid in cash'),
  ('goalhub', 'fine_payment_credit', 'customer_wallet_goalhub', 'fine_income', 'Goalhub fine paid from wallet credit')
ON CONFLICT (source_system, event_type) DO UPDATE SET
  debit_account_key = EXCLUDED.debit_account_key,
  credit_account_key = EXCLUDED.credit_account_key,
  description_template = EXCLUDED.description_template,
  active = TRUE,
  updated_at = NOW();
