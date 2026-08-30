-- B2: scope the accounting admin RLS policies by business, and close the
-- ledger_account_balances read leak. Customer/driver policies on the shared
-- invoices/payments tables are left untouched.

-- ── Business-scoped admin policies (replace the broad admin_all ones) ──
DROP POLICY IF EXISTS "ledger_journal_entries_admin_all" ON ledger_journal_entries;
CREATE POLICY "ledger_journal_entries_business_access" ON ledger_journal_entries
  FOR ALL TO authenticated
  USING (accounting_can_see_business(business))
  WITH CHECK (accounting_can_see_business(business));

DROP POLICY IF EXISTS "bills_admin_all" ON bills;
CREATE POLICY "bills_business_access" ON bills
  FOR ALL TO authenticated
  USING (accounting_can_see_business(business))
  WITH CHECK (accounting_can_see_business(business));

DROP POLICY IF EXISTS "credit_notes_admin_all" ON credit_notes;
CREATE POLICY "credit_notes_business_access" ON credit_notes
  FOR ALL TO authenticated
  USING (accounting_can_see_business(business))
  WITH CHECK (accounting_can_see_business(business));

DROP POLICY IF EXISTS "payments_made_admin_all" ON payments_made;
CREATE POLICY "payments_made_business_access" ON payments_made
  FOR ALL TO authenticated
  USING (accounting_can_see_business(business))
  WITH CHECK (accounting_can_see_business(business));

DROP POLICY IF EXISTS "admins_manage_expenses" ON expenses;
CREATE POLICY "expenses_business_access" ON expenses
  FOR ALL TO authenticated
  USING (accounting_can_see_business(business))
  WITH CHECK (accounting_can_see_business(business));

-- invoices has duplicate admin policies; drop both, keep customer read policies.
DROP POLICY IF EXISTS "admins_manage_invoices" ON invoices;
DROP POLICY IF EXISTS "Admins can manage invoices" ON invoices;
CREATE POLICY "invoices_business_access" ON invoices
  FOR ALL TO authenticated
  USING (accounting_can_see_business(business))
  WITH CHECK (accounting_can_see_business(business));

DROP POLICY IF EXISTS "payments_admin_all" ON payments;
CREATE POLICY "payments_business_access" ON payments
  FOR ALL TO authenticated
  USING (accounting_can_see_business(business))
  WITH CHECK (accounting_can_see_business(business));

-- ── Close the ledger_account_balances leak ────────────────────────────
-- The view runs as its owner (bypasses RLS) and was granted to authenticated,
-- so any signed-in user could read every account balance. Revoke it and route
-- reads through an RBAC- and business-scoped SECURITY DEFINER function.
REVOKE ALL ON ledger_account_balances FROM authenticated;

CREATE OR REPLACE FUNCTION get_ledger_account_balances(p_business TEXT DEFAULT NULL)
RETURNS TABLE (
  account_id UUID,
  code TEXT,
  name TEXT,
  account_type TEXT,
  normal_balance TEXT,
  total_debit NUMERIC,
  total_credit NUMERIC,
  balance NUMERIC
) AS $$
DECLARE
  v_business TEXT := accounting_effective_business(p_business);
BEGIN
  RETURN QUERY
  SELECT
    coa.id,
    coa.code,
    coa.name,
    coa.account_type::TEXT,
    coa.normal_balance::TEXT,
    COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.debit ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.credit ELSE 0 END), 0),
    CASE
      WHEN coa.normal_balance = 'debit'
        THEN COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.debit ELSE 0 END), 0)
          - COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.credit ELSE 0 END), 0)
      ELSE COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.credit ELSE 0 END), 0)
        - COALESCE(SUM(CASE WHEN e.status = 'posted' THEN l.debit ELSE 0 END), 0)
    END
  FROM chart_of_accounts coa
  LEFT JOIN ledger_journal_lines l ON l.account_id = coa.id
  LEFT JOIN ledger_journal_entries e ON e.id = l.journal_entry_id
    AND (v_business IS NULL OR e.business = v_business)
  WHERE coa.active = TRUE
  GROUP BY coa.id, coa.code, coa.name, coa.account_type, coa.normal_balance;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_ledger_account_balances(TEXT) TO authenticated, service_role;
