-- Keep provider payment acknowledgement as the source of truth even when a
-- legacy order cannot be invoiced, and do not intercept driver/admin cash rows.

CREATE OR REPLACE FUNCTION public.auto_account_completed_order_payment()
RETURNS TRIGGER AS $$
DECLARE
  v_result JSONB;
  v_error TEXT;
BEGIN
  IF NEW.order_id IS NULL
    OR NEW.status::TEXT <> 'completed'
    OR COALESCE(auth.jwt()->>'role', '') <> 'service_role'
  THEN
    RETURN NEW;
  END IF;

  BEGIN
    v_result := create_invoice_from_delivered_order(
      NEW.order_id,
      CURRENT_DATE + 14,
      TRUE,
      NEW.business
    );

    IF NOT COALESCE((v_result->>'success')::BOOLEAN, FALSE) THEN
      RAISE EXCEPTION '%', COALESCE(v_result->>'error', 'unknown reconciliation error');
    END IF;
  EXCEPTION WHEN OTHERS THEN
    v_error := SQLERRM;
    UPDATE payments
    SET provider_metadata = COALESCE(provider_metadata, '{}'::JSONB)
          || jsonb_build_object(
            'accountingReconciliation', jsonb_build_object(
              'status', 'failed',
              'error', v_error,
              'attemptedAt', NOW()
            )
          ),
        updated_at = NOW()
    WHERE id = NEW.id;

    RAISE WARNING 'Automatic accounting reconciliation failed for payment %: %', NEW.id, v_error;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION public.auto_account_completed_order_payment() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.auto_account_completed_order_payment() TO service_role;
