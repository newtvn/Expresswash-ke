-- ============================================================
-- Accounting permission hardening
--
-- Keep accounting mutations behind admin/service RPC checks and
-- remove PostgreSQL's default PUBLIC execute surface from
-- security-definer helper functions.
-- ============================================================

-- Base accounting helpers and ledger RPCs.
REVOKE EXECUTE ON FUNCTION accounting_is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION accounting_touch_updated_at() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION assert_ledger_entry_balanced(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION post_journal_entry(TEXT, UUID, DATE, TEXT, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION reverse_journal_entry(UUID, DATE, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION accounting_is_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION post_journal_entry(TEXT, UUID, DATE, TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION reverse_journal_entry(UUID, DATE, TEXT) TO authenticated, service_role;

-- Internal accounting helpers are called by security-definer workflows.
-- They do not need to be directly callable by browser clients.
REVOKE EXECUTE ON FUNCTION accounting_system_account_id(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION accounting_cash_account_id(TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION accounting_contact_for_profile(UUID, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION accounting_system_account_id(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION accounting_cash_account_id(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION accounting_contact_for_profile(UUID, TEXT, TEXT, TEXT) TO service_role;

-- Admin operational accounting workflows. These remain callable by
-- authenticated admins, with the function bodies enforcing admin checks.
REVOKE EXECUTE ON FUNCTION post_invoice_to_ledger(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION post_payment_received_to_ledger(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION record_invoice_payment(UUID, NUMERIC, payment_method, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION create_bill_with_lines(UUID, DATE, DATE, TEXT, JSONB, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION post_bill_to_ledger(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION record_bill_payment(UUID, NUMERIC, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION post_payment_made_to_ledger(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION create_credit_note_for_invoice(UUID, NUMERIC, TEXT) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION post_credit_note_to_ledger(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION post_expense_to_ledger(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION create_invoice_with_lines(UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION update_draft_invoice_with_lines(UUID, UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION allocate_customer_payment(UUID, JSONB) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION post_invoice_to_ledger(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION post_payment_received_to_ledger(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_invoice_payment(UUID, NUMERIC, payment_method, TEXT, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_bill_with_lines(UUID, DATE, DATE, TEXT, JSONB, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION post_bill_to_ledger(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_bill_payment(UUID, NUMERIC, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION post_payment_made_to_ledger(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_credit_note_for_invoice(UUID, NUMERIC, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION post_credit_note_to_ledger(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION post_expense_to_ledger(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION create_invoice_with_lines(UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION update_draft_invoice_with_lines(UUID, UUID, DATE, DATE, TEXT, JSONB, invoice_status, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION allocate_customer_payment(UUID, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION record_customer_refund(UUID, UUID, NUMERIC, payment_method, TEXT, TEXT) TO authenticated, service_role;

-- This recalculation helper updates invoice financial totals and should
-- only run as an internal helper or service-role maintenance operation.
REVOKE EXECUTE ON FUNCTION accounting_recalculate_invoice_totals(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION accounting_recalculate_invoice_totals(UUID) TO service_role;

-- Provider callbacks must remain service-only.
REVOKE EXECUTE ON FUNCTION complete_payment_transaction(UUID, UUID, TEXT, INTEGER, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION process_payment_callback(TEXT, TEXT, INTEGER, TEXT, NUMERIC, TEXT, JSONB, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION complete_payment_transaction(UUID, UUID, TEXT, INTEGER, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION process_payment_callback(TEXT, TEXT, INTEGER, TEXT, NUMERIC, TEXT, JSONB, TEXT) TO service_role;

-- Report RPCs are visible only to authenticated users and still enforce
-- admin checks in the function bodies.
REVOKE EXECUTE ON FUNCTION get_ledger_profit_and_loss(DATE, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_ledger_balance_sheet(DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_vat_summary(DATE, DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_receivables_aging(DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_payables_aging(DATE) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION get_ledger_cash_flow(DATE, DATE) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION get_ledger_profit_and_loss(DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_ledger_balance_sheet(DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_vat_summary(DATE, DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_receivables_aging(DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_payables_aging(DATE) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION get_ledger_cash_flow(DATE, DATE) TO authenticated, service_role;

-- Outbox replay/enqueue are admin-visible; delivery attempt marking is
-- worker/service-role only.
REVOKE EXECUTE ON FUNCTION enqueue_notification_outbox(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION replay_notification_outbox(UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION mark_notification_attempt(UUID, TEXT, JSONB, JSONB, INTEGER, BOOLEAN, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION enqueue_notification_outbox(TEXT, TEXT, UUID, TEXT, TEXT, TEXT, JSONB, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION replay_notification_outbox(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION mark_notification_attempt(UUID, TEXT, JSONB, JSONB, INTEGER, BOOLEAN, TEXT) TO service_role;

-- Tables named in the accounting handoff remain protected by RLS. Ensure
-- anonymous clients have no table privileges even if future policies are
-- added by mistake.
REVOKE ALL ON TABLE
  contacts,
  bills,
  bill_lines,
  payments_made,
  payment_allocations,
  payment_made_allocations,
  customer_refunds,
  credit_notes,
  credit_note_lines,
  ledger_journal_entries,
  ledger_journal_lines,
  notification_outbox,
  notification_delivery_attempts
FROM anon;

REVOKE ALL ON TABLE
  contacts,
  bills,
  bill_lines,
  payments_made,
  payment_allocations,
  payment_made_allocations,
  customer_refunds,
  credit_notes,
  credit_note_lines,
  ledger_journal_entries,
  ledger_journal_lines,
  notification_outbox,
  notification_delivery_attempts
FROM authenticated;

GRANT SELECT, INSERT, UPDATE ON TABLE contacts TO authenticated;

GRANT SELECT ON TABLE
  bills,
  bill_lines,
  payments_made,
  payment_allocations,
  payment_made_allocations,
  customer_refunds,
  credit_notes,
  credit_note_lines,
  ledger_journal_entries,
  ledger_journal_lines,
  notification_outbox,
  notification_delivery_attempts
TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE
  contacts,
  bills,
  bill_lines,
  payments_made,
  payment_allocations,
  payment_made_allocations,
  customer_refunds,
  credit_notes,
  credit_note_lines,
  ledger_journal_entries,
  ledger_journal_lines,
  notification_outbox,
  notification_delivery_attempts
TO service_role;
