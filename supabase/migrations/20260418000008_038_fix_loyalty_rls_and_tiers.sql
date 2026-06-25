-- ============================================================
-- Fix 1: Allow customers to insert loyalty_transactions (for redemptions)
-- The existing RLS only allows SELECT for customers
-- ============================================================

CREATE POLICY "customers_insert_own_loyalty_transactions" ON loyalty_transactions
  FOR INSERT
  WITH CHECK (customer_id = auth.uid());

-- ============================================================
-- Fix 2: Update the loyalty trigger to also compute next_tier and points_to_next_tier
-- ============================================================

CREATE OR REPLACE FUNCTION award_loyalty_points_on_delivery()
RETURNS TRIGGER AS $$
DECLARE
  v_points INTEGER;
  v_current_points INTEGER;
  v_lifetime INTEGER;
  v_tier loyalty_tier;
  v_next_tier loyalty_tier;
  v_points_to_next INTEGER;
  v_tier_progress NUMERIC;
BEGIN
  -- Only fire when status changes to 12 (delivered)
  IF NEW.status = 12 AND (OLD.status IS NULL OR OLD.status <> 12) THEN
    -- Calculate points: 1 point per 100 KES
    v_points := GREATEST(FLOOR(COALESCE(NEW.total, 0) / 100), 0);

    IF v_points > 0 THEN
      -- Upsert loyalty account
      INSERT INTO loyalty_accounts (customer_id, customer_name, points, lifetime_points, tier)
      VALUES (NEW.customer_id, NEW.customer_name, v_points, v_points, 'bronze')
      ON CONFLICT (customer_id) DO UPDATE
      SET points = loyalty_accounts.points + v_points,
          lifetime_points = loyalty_accounts.lifetime_points + v_points;

      -- Get updated totals
      SELECT points, lifetime_points INTO v_current_points, v_lifetime
      FROM loyalty_accounts WHERE customer_id = NEW.customer_id;

      -- Calculate tier based on lifetime points
      IF v_lifetime >= 5000 THEN v_tier := 'platinum';
      ELSIF v_lifetime >= 2000 THEN v_tier := 'gold';
      ELSIF v_lifetime >= 500 THEN v_tier := 'silver';
      ELSE v_tier := 'bronze';
      END IF;

      -- Calculate next tier and points to next
      IF v_tier = 'bronze' THEN
        v_next_tier := 'silver'; v_points_to_next := 500 - v_lifetime;
        v_tier_progress := LEAST((v_lifetime::NUMERIC / 500) * 100, 100);
      ELSIF v_tier = 'silver' THEN
        v_next_tier := 'gold'; v_points_to_next := 2000 - v_lifetime;
        v_tier_progress := LEAST(((v_lifetime - 500)::NUMERIC / 1500) * 100, 100);
      ELSIF v_tier = 'gold' THEN
        v_next_tier := 'platinum'; v_points_to_next := 5000 - v_lifetime;
        v_tier_progress := LEAST(((v_lifetime - 2000)::NUMERIC / 3000) * 100, 100);
      ELSE
        v_next_tier := NULL; v_points_to_next := 0;
        v_tier_progress := 100;
      END IF;

      -- Update tier info
      UPDATE loyalty_accounts
      SET tier = v_tier,
          tier_progress = v_tier_progress,
          next_tier = v_next_tier,
          points_to_next_tier = GREATEST(v_points_to_next, 0)
      WHERE customer_id = NEW.customer_id;

      -- Log transaction
      INSERT INTO loyalty_transactions (customer_id, points, type, description, order_id, balance_after)
      VALUES (
        NEW.customer_id,
        v_points,
        'earned',
        v_points || ' points earned on order ' || NEW.tracking_code || ' (KES ' || TO_CHAR(COALESCE(NEW.total, 0), 'FM999,999') || ')',
        NEW.id,
        v_current_points
      );

      -- Update denormalized profile fields
      UPDATE profiles
      SET loyalty_points = v_current_points,
          loyalty_tier = v_tier
      WHERE id = NEW.customer_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- Fix 3: Backfill next_tier and points_to_next_tier for existing accounts
-- ============================================================

UPDATE loyalty_accounts SET
  next_tier = CASE
    WHEN tier = 'bronze' THEN 'silver'::loyalty_tier
    WHEN tier = 'silver' THEN 'gold'::loyalty_tier
    WHEN tier = 'gold' THEN 'platinum'::loyalty_tier
    ELSE NULL
  END,
  points_to_next_tier = CASE
    WHEN tier = 'bronze' THEN GREATEST(500 - lifetime_points, 0)
    WHEN tier = 'silver' THEN GREATEST(2000 - lifetime_points, 0)
    WHEN tier = 'gold' THEN GREATEST(5000 - lifetime_points, 0)
    ELSE 0
  END,
  tier_progress = CASE
    WHEN tier = 'bronze' THEN LEAST((lifetime_points::NUMERIC / 500) * 100, 100)
    WHEN tier = 'silver' THEN LEAST(((lifetime_points - 500)::NUMERIC / 1500) * 100, 100)
    WHEN tier = 'gold' THEN LEAST(((lifetime_points - 2000)::NUMERIC / 3000) * 100, 100)
    ELSE 100
  END;
