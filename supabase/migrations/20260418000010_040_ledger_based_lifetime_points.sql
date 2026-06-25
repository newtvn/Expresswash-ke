-- ============================================================
-- Fix lifetime_points to be ledger-derived, not a mutable column
-- Rebuild from earned transactions, recalculate tiers
-- ============================================================

-- 1. Rebuild lifetime_points from the ledger for all accounts
UPDATE loyalty_accounts la SET
  lifetime_points = COALESCE((
    SELECT SUM(points) FROM loyalty_transactions lt
    WHERE lt.customer_id = la.customer_id AND lt.type = 'earned'
  ), 0);

-- 2. Recalculate tiers based on corrected lifetime_points
UPDATE loyalty_accounts SET
  tier = CASE
    WHEN lifetime_points >= 5000 THEN 'platinum'::loyalty_tier
    WHEN lifetime_points >= 2000 THEN 'gold'::loyalty_tier
    WHEN lifetime_points >= 500 THEN 'silver'::loyalty_tier
    ELSE 'bronze'::loyalty_tier
  END,
  next_tier = CASE
    WHEN lifetime_points >= 5000 THEN NULL
    WHEN lifetime_points >= 2000 THEN 'platinum'::loyalty_tier
    WHEN lifetime_points >= 500 THEN 'gold'::loyalty_tier
    ELSE 'silver'::loyalty_tier
  END,
  points_to_next_tier = CASE
    WHEN lifetime_points >= 5000 THEN 0
    WHEN lifetime_points >= 2000 THEN GREATEST(5000 - lifetime_points, 0)
    WHEN lifetime_points >= 500 THEN GREATEST(2000 - lifetime_points, 0)
    ELSE GREATEST(500 - lifetime_points, 0)
  END,
  tier_progress = CASE
    WHEN lifetime_points >= 5000 THEN 100
    WHEN lifetime_points >= 2000 THEN LEAST(((lifetime_points - 2000)::NUMERIC / 3000) * 100, 100)
    WHEN lifetime_points >= 500 THEN LEAST(((lifetime_points - 500)::NUMERIC / 1500) * 100, 100)
    ELSE LEAST((lifetime_points::NUMERIC / 500) * 100, 100)
  END;

-- 3. Sync profiles
UPDATE profiles p SET
  loyalty_points = la.points,
  loyalty_tier = la.tier
FROM loyalty_accounts la
WHERE la.customer_id = p.id;

-- 4. Update the award trigger to compute lifetime from ledger
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
  IF NEW.status = 12 AND (OLD.status IS NULL OR OLD.status <> 12) THEN
    v_points := GREATEST(FLOOR(COALESCE(NEW.total, 0) / 100), 0);

    IF v_points > 0 THEN
      -- Upsert loyalty account
      INSERT INTO loyalty_accounts (customer_id, customer_name, points, lifetime_points, tier)
      VALUES (NEW.customer_id, NEW.customer_name, v_points, v_points, 'bronze')
      ON CONFLICT (customer_id) DO UPDATE
      SET points = loyalty_accounts.points + v_points;

      -- Log transaction
      INSERT INTO loyalty_transactions (customer_id, points, type, description, order_id, balance_after)
      VALUES (
        NEW.customer_id, v_points, 'earned',
        v_points || ' points earned on order ' || NEW.tracking_code || ' (KES ' || TO_CHAR(COALESCE(NEW.total, 0), 'FM999,999') || ')',
        NEW.id,
        (SELECT points FROM loyalty_accounts WHERE customer_id = NEW.customer_id)
      );

      -- Recalculate lifetime from ledger (not a running counter)
      SELECT COALESCE(SUM(points), 0) INTO v_lifetime
      FROM loyalty_transactions
      WHERE customer_id = NEW.customer_id AND type = 'earned';

      SELECT points INTO v_current_points
      FROM loyalty_accounts WHERE customer_id = NEW.customer_id;

      -- Calculate tier
      IF v_lifetime >= 5000 THEN v_tier := 'platinum';
      ELSIF v_lifetime >= 2000 THEN v_tier := 'gold';
      ELSIF v_lifetime >= 500 THEN v_tier := 'silver';
      ELSE v_tier := 'bronze';
      END IF;

      -- Calculate next tier and progress
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
        v_next_tier := NULL; v_points_to_next := 0; v_tier_progress := 100;
      END IF;

      UPDATE loyalty_accounts
      SET lifetime_points = v_lifetime,
          tier = v_tier,
          tier_progress = v_tier_progress,
          next_tier = v_next_tier,
          points_to_next_tier = GREATEST(v_points_to_next, 0)
      WHERE customer_id = NEW.customer_id;

      UPDATE profiles
      SET loyalty_points = v_current_points, loyalty_tier = v_tier
      WHERE id = NEW.customer_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
