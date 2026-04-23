-- Fix: change new_tier variable from TEXT to loyalty_tier enum
-- This fixes the "column tier is of type loyalty_tier but expression is of type text" error
-- that blocks order delivery (status 11→12)

CREATE OR REPLACE FUNCTION award_loyalty_points_on_delivery()
RETURNS trigger AS $$
DECLARE
  points_earned INTEGER;
  new_balance INTEGER;
  new_tier loyalty_tier;
  account_exists BOOLEAN;
BEGIN
  -- Only fire on transition TO delivered (status 12)
  IF NEW.status != 12 OR OLD.status = 12 THEN
    RETURN NEW;
  END IF;

  -- Calculate points: 1 point per 100 KES (rounded down)
  points_earned := FLOOR(COALESCE(NEW.total, 0) / 100);

  -- Skip if zero points (very small order)
  IF points_earned <= 0 THEN
    RETURN NEW;
  END IF;

  -- Check if loyalty account exists
  SELECT EXISTS (
    SELECT 1 FROM loyalty_accounts WHERE customer_id = NEW.customer_id
  ) INTO account_exists;

  -- Create loyalty account if it doesn't exist
  IF NOT account_exists THEN
    INSERT INTO loyalty_accounts (customer_id, customer_name, points, tier, tier_progress, lifetime_points)
    SELECT NEW.customer_id, COALESCE(p.name, 'Customer'), 0, 'bronze'::loyalty_tier, 0, 0
    FROM profiles p WHERE p.id = NEW.customer_id
    ON CONFLICT (customer_id) DO NOTHING;
  END IF;

  -- Update loyalty account balance
  UPDATE loyalty_accounts
  SET
    points = points + points_earned,
    lifetime_points = lifetime_points + points_earned
  WHERE customer_id = NEW.customer_id
  RETURNING points INTO new_balance;

  -- Handle case where RETURNING didn't capture
  IF new_balance IS NULL THEN
    SELECT points INTO new_balance
    FROM loyalty_accounts WHERE customer_id = NEW.customer_id;
  END IF;

  -- Log the transaction
  INSERT INTO loyalty_transactions (
    customer_id, points, type, order_id, description, balance_after
  ) VALUES (
    NEW.customer_id,
    points_earned,
    'earned',
    NEW.id::text,
    points_earned || ' points earned on order ' || COALESCE(NEW.tracking_code, NEW.id::TEXT)
      || ' (KES ' || to_char(NEW.total, 'FM999,999,999') || ')',
    COALESCE(new_balance, points_earned)
  );

  -- Update profile denormalized field
  UPDATE profiles
  SET loyalty_points = COALESCE(new_balance, points_earned)
  WHERE id = NEW.customer_id;

  -- Recalculate tier
  new_tier := CASE
    WHEN COALESCE(new_balance, 0) >= 5000 THEN 'platinum'::loyalty_tier
    WHEN COALESCE(new_balance, 0) >= 2000 THEN 'gold'::loyalty_tier
    WHEN COALESCE(new_balance, 0) >= 500 THEN 'silver'::loyalty_tier
    ELSE 'bronze'::loyalty_tier
  END;

  UPDATE loyalty_accounts
  SET tier = new_tier
  WHERE customer_id = NEW.customer_id;

  -- Also update profile loyalty_tier
  UPDATE profiles
  SET loyalty_tier = new_tier
  WHERE id = NEW.customer_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
