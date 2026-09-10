-- Ensure reporting views obey the querying user's RLS policies instead of
-- executing with the view owner's privileges. This also clears Supabase's
-- SECURITY DEFINER VIEW advisor findings for these legacy views.

ALTER VIEW public.recent_payments SET (security_invoker = true);
ALTER VIEW public.payment_stats SET (security_invoker = true);
ALTER VIEW public.ledger_account_balances SET (security_invoker = true);

-- The ledger view was replaced by the scoped RPC in migration 080. Keep the
-- direct view unavailable to browser roles even with security_invoker enabled.
REVOKE ALL ON public.ledger_account_balances FROM anon, authenticated;

