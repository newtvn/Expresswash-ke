-- ============================================================
-- 1. Ensure RLS policy exists for customer transaction inserts
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'loyalty_transactions'
      AND policyname = 'customers_insert_own_loyalty_transactions'
  ) THEN
    EXECUTE 'CREATE POLICY customers_insert_own_loyalty_transactions ON loyalty_transactions FOR INSERT WITH CHECK (customer_id = auth.uid())';
  END IF;
END $$;

-- ============================================================
-- 2. Atomic redeem function - prevents balance/ledger drift
--    Runs as SECURITY DEFINER so it bypasses RLS internally
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_loyalty_reward(
  p_customer_id UUID,
  p_reward_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_account RECORD;
  v_reward RECORD;
  v_new_balance INTEGER;
  v_tier loyalty_tier;
BEGIN
  -- Lock the account row to prevent concurrent redemptions
  SELECT * INTO v_account
  FROM loyalty_accounts
  WHERE customer_id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Loyalty account not found');
  END IF;

  SELECT * INTO v_reward FROM rewards WHERE id = p_reward_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Reward not found');
  END IF;

  IF NOT v_reward.is_active THEN
    RETURN jsonb_build_object('success', false, 'message', 'This reward is no longer available');
  END IF;

  IF v_account.points < v_reward.points_cost THEN
    RETURN jsonb_build_object('success', false, 'message',
      'Insufficient points. You need ' || (v_reward.points_cost - v_account.points) || ' more points.');
  END IF;

  v_new_balance := v_account.points - v_reward.points_cost;

  -- Insert transaction FIRST (ledger is source of truth)
  INSERT INTO loyalty_transactions (customer_id, points, type, description, balance_after)
  VALUES (p_customer_id, -v_reward.points_cost, 'redeemed',
    'Redeemed: ' || v_reward.name, v_new_balance);

  -- Then update the denormalized balance
  UPDATE loyalty_accounts
  SET points = v_new_balance
  WHERE customer_id = p_customer_id;

  -- Update denormalized profile
  UPDATE profiles
  SET loyalty_points = v_new_balance
  WHERE id = p_customer_id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Successfully redeemed "' || v_reward.name || '"',
    'remaining_points', v_new_balance,
    'reward_name', v_reward.name,
    'discount_type', v_reward.discount_type,
    'discount_value', v_reward.discount_value
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION redeem_loyalty_reward(UUID, UUID) TO authenticated;

-- ============================================================
-- 3. Fix ledger consistency - rebuild balance_after from scratch
-- ============================================================
DO $$
DECLARE
  cust RECORD;
  tx RECORD;
  running INTEGER;
BEGIN
  FOR cust IN SELECT DISTINCT customer_id FROM loyalty_transactions LOOP
    running := 0;
    FOR tx IN
      SELECT id, points
      FROM loyalty_transactions
      WHERE customer_id = cust.customer_id
      ORDER BY created_at ASC
    LOOP
      running := running + tx.points;
      UPDATE loyalty_transactions SET balance_after = running WHERE id = tx.id;
    END LOOP;

    -- Sync the account balance to match the ledger
    UPDATE loyalty_accounts SET points = running WHERE customer_id = cust.customer_id;
    UPDATE profiles SET loyalty_points = running WHERE id = cust.customer_id;
  END LOOP;
END $$;
