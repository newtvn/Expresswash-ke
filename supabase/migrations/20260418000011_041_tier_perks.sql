-- ============================================================
-- Migration: Loyalty Tier Perks
--
-- Implements four tier-based perks:
--   1. Gold+  : Free delivery (delivery fee waived)
--   2. Platinum: Free express service (express surcharge waived)
--   3. Gold+  : 2x referral bonus (400 pts instead of 200)
--   4. Platinum: Birthday bonus (200 points on birthday)
--
-- Modifies:
--   - orders table (adds service_type column)
--   - calculate_order_pricing (tier-aware delivery/express fees)
--   - award_loyalty_points_on_delivery (referral completion logic)
--   - Adds birthday bonus cron job for Platinum customers
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- SECTION 1: Express service column on orders
-- ────────────────────────────────────────────────────────────

ALTER TABLE orders ADD COLUMN IF NOT EXISTS service_type TEXT DEFAULT 'standard';

-- Add CHECK constraint safely
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.check_constraints
    WHERE constraint_name = 'orders_service_type_check'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_service_type_check
      CHECK (service_type IN ('standard', 'express'));
  END IF;
END $$;


-- ────────────────────────────────────────────────────────────
-- SECTION 2: Tier-aware calculate_order_pricing
-- ────────────────────────────────────────────────────────────

-- Drop old 4-param signature so CREATE OR REPLACE with 5 params takes effect
DROP FUNCTION IF EXISTS calculate_order_pricing(JSONB, TEXT, TEXT, UUID);

CREATE OR REPLACE FUNCTION calculate_order_pricing(
  p_items        JSONB,
  p_zone_name    TEXT,
  p_promo_code   TEXT DEFAULT NULL,
  p_customer_id  UUID DEFAULT NULL,
  p_service_type TEXT DEFAULT 'standard'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_item          JSONB;
  v_item_type     TEXT;
  v_length        NUMERIC;
  v_width         NUMERIC;
  v_quantity       INTEGER;
  v_rate          NUMERIC;
  v_unit_price    NUMERIC;
  v_item_total    NUMERIC;
  v_subtotal      NUMERIC := 0;
  v_delivery_fee  NUMERIC := 0;
  v_express_surcharge NUMERIC := 0;
  v_vat_rate      NUMERIC := 0.16;
  v_vat_amount    NUMERIC;
  v_discount      NUMERIC := 0;
  v_total         NUMERIC;
  v_zone_fee      NUMERIC;
  v_promo         RECORD;
  v_customer_usage INTEGER := 0;
  v_apply_discount BOOLEAN := FALSE;
  v_items_out     JSONB := '[]'::JSONB;
  v_customer_tier loyalty_tier;
  v_delivery_fee_waived  BOOLEAN := FALSE;
  v_express_fee_waived   BOOLEAN := FALSE;
  -- Default pricing rates (must match frontend orderService.ts PRICING)
  v_default_rates JSONB := '{
    "carpet": 0.35,
    "rug": 0.40,
    "curtain": 0.30,
    "sofa": 0.50,
    "mattress": 0.25,
    "chair": 0.45,
    "pillow": 0.20,
    "other": 0.35
  }'::JSONB;
  -- Default delivery fees (fallback if zone not in DB)
  v_default_fees JSONB := '{
    "kitengela": 300,
    "athi river": 300,
    "syokimau": 350,
    "nairobi": 500,
    "other": 600
  }'::JSONB;
BEGIN
  -- Validate items array
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items array is required and must not be empty';
  END IF;

  -- Calculate subtotal from items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_item_type := LOWER(COALESCE(v_item->>'item_type', 'other'));
    v_length    := COALESCE((v_item->>'length_inches')::NUMERIC, 0);
    v_width     := COALESCE((v_item->>'width_inches')::NUMERIC, 0);
    v_quantity  := COALESCE((v_item->>'quantity')::INTEGER, 1);

    IF v_length <= 0 OR v_width <= 0 THEN
      RAISE EXCEPTION 'Invalid dimensions for item type %', v_item_type;
    END IF;

    -- Get rate: try system_config first, fall back to defaults
    v_rate := COALESCE(
      (SELECT (config->'pricePerSqInch'->>v_item_type)::NUMERIC
       FROM system_config
       WHERE id = 'pricing'
       LIMIT 1),
      (v_default_rates->>v_item_type)::NUMERIC,
      (v_default_rates->>'other')::NUMERIC
    );

    v_unit_price := ROUND(v_length * v_width * v_rate);
    v_item_total := v_unit_price * v_quantity;
    v_subtotal   := v_subtotal + v_item_total;

    -- Build item result
    v_items_out := v_items_out || jsonb_build_object(
      'item_type', v_item_type,
      'length_inches', v_length,
      'width_inches', v_width,
      'quantity', v_quantity,
      'rate', v_rate,
      'sq_inches', v_length * v_width,
      'unit_price', v_unit_price,
      'total', v_item_total
    );
  END LOOP;

  -- Get delivery fee: try zones table first, fall back to defaults
  SELECT base_delivery_fee INTO v_zone_fee
  FROM zones
  WHERE LOWER(name) = LOWER(p_zone_name)
  LIMIT 1;

  IF v_zone_fee IS NOT NULL THEN
    v_delivery_fee := v_zone_fee;
  ELSE
    -- Fuzzy match against default fees
    v_delivery_fee := CASE
      WHEN LOWER(p_zone_name) LIKE '%kitengela%' THEN 300
      WHEN LOWER(p_zone_name) LIKE '%athi river%' THEN 300
      WHEN LOWER(p_zone_name) LIKE '%syokimau%' THEN 350
      WHEN LOWER(p_zone_name) LIKE '%nairobi%' THEN 500
      ELSE 600
    END;
  END IF;

  -- ── Tier-based perks: delivery fee waiver and express surcharge ──
  IF p_customer_id IS NOT NULL THEN
    SELECT tier INTO v_customer_tier
    FROM loyalty_accounts
    WHERE customer_id = p_customer_id;

    -- Gold+ gets free delivery
    IF v_customer_tier IN ('gold', 'platinum') THEN
      v_delivery_fee := 0;
      v_delivery_fee_waived := TRUE;
    END IF;

    -- Express service handling
    IF p_service_type = 'express' AND v_customer_tier = 'platinum' THEN
      -- Platinum gets free express
      v_express_surcharge := 0;
      v_express_fee_waived := TRUE;
    ELSIF p_service_type = 'express' THEN
      v_express_surcharge := 500;
    END IF;
  ELSE
    -- No customer context: charge express if requested
    IF p_service_type = 'express' THEN
      v_express_surcharge := 500;
    END IF;
  END IF;

  -- Apply promo code if provided
  IF p_promo_code IS NOT NULL AND p_promo_code != '' THEN
    SELECT * INTO v_promo
    FROM promotions
    WHERE code = UPPER(p_promo_code)
      AND is_active = true
      AND (valid_from IS NULL OR valid_from <= NOW())
      AND (valid_until IS NULL OR valid_until >= NOW())
      AND (usage_limit IS NULL OR times_used < usage_limit)
    LIMIT 1;

    IF FOUND THEN
      v_apply_discount := TRUE;

      -- Guard 1: min_order_amount
      IF v_promo.min_order_amount IS NOT NULL AND v_subtotal < v_promo.min_order_amount THEN
        v_apply_discount := FALSE;
      END IF;

      -- Guard 2: per-customer usage (only when customer_id is provided)
      IF v_apply_discount AND p_customer_id IS NOT NULL THEN
        SELECT COUNT(*) INTO v_customer_usage
        FROM promotion_usage
        WHERE promotion_id = v_promo.id
          AND customer_id = p_customer_id;

        IF v_customer_usage >= v_promo.usage_per_customer THEN
          v_apply_discount := FALSE;
        END IF;
      END IF;

      -- Calculate discount amount
      IF v_apply_discount THEN
        IF v_promo.discount_type = 'percentage' THEN
          v_discount := ROUND(v_subtotal * (v_promo.discount_value / 100));
          -- Guard 3: enforce max_discount_amount cap
          IF v_promo.max_discount_amount IS NOT NULL AND v_discount > v_promo.max_discount_amount THEN
            v_discount := v_promo.max_discount_amount;
          END IF;
        ELSIF v_promo.discount_type = 'fixed_amount' THEN
          v_discount := LEAST(v_promo.discount_value, v_subtotal);
        END IF;
      END IF;
    END IF;
  END IF;

  -- Calculate VAT on (subtotal - discount + delivery + express)
  v_vat_amount := ROUND((v_subtotal - v_discount + v_delivery_fee + v_express_surcharge) * v_vat_rate);

  -- Calculate total
  v_total := v_subtotal - v_discount + v_delivery_fee + v_express_surcharge + v_vat_amount;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'express_surcharge', v_express_surcharge,
    'discount', v_discount,
    'vat_rate', v_vat_rate,
    'vat_amount', v_vat_amount,
    'total', v_total,
    'zone', p_zone_name,
    'promo_code', p_promo_code,
    'service_type', p_service_type,
    'delivery_fee_waived', v_delivery_fee_waived,
    'express_fee_waived', v_express_fee_waived,
    'items', v_items_out
  );
END;
$$;


-- ────────────────────────────────────────────────────────────
-- SECTION 3: Extend award_loyalty_points_on_delivery
--            with referral completion logic
-- ────────────────────────────────────────────────────────────

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
  v_referral RECORD;
  v_referral_points INTEGER;
  v_referrer_tier loyalty_tier;
  v_referrer_balance INTEGER;
  v_referee_balance INTEGER;
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

    -- ── Referral completion: check if this customer has a pending referral ──
    SELECT r.* INTO v_referral
    FROM referrals r
    WHERE (r.referee_id = NEW.customer_id
           OR r.referee_email = (SELECT email FROM profiles WHERE id = NEW.customer_id))
      AND r.status = 'pending'
    LIMIT 1;

    IF FOUND THEN
      -- Base referral bonus is 200 points
      v_referral_points := 200;

      -- Gold+ referrers get 2x bonus (400 points)
      SELECT tier INTO v_referrer_tier
      FROM loyalty_accounts
      WHERE customer_id = v_referral.referrer_id;

      IF v_referrer_tier IN ('gold', 'platinum') THEN
        v_referral_points := 400;
      END IF;

      -- ── Award points to referrer ──
      INSERT INTO loyalty_accounts (customer_id, customer_name, points, lifetime_points, tier)
      VALUES (
        v_referral.referrer_id,
        v_referral.referrer_name,
        v_referral_points,
        0,  -- lifetime computed from earned txns, bonus doesn't count
        'bronze'
      )
      ON CONFLICT (customer_id) DO UPDATE
      SET points = loyalty_accounts.points + v_referral_points;

      SELECT points INTO v_referrer_balance
      FROM loyalty_accounts WHERE customer_id = v_referral.referrer_id;

      INSERT INTO loyalty_transactions (customer_id, points, type, description, balance_after)
      VALUES (
        v_referral.referrer_id,
        v_referral_points,
        'bonus',
        'Referral bonus - ' || COALESCE(NEW.customer_name, 'a friend') || ' completed first order',
        v_referrer_balance
      );

      -- ── Award 200 points to referee ──
      -- (loyalty account already exists from the earned-points upsert above)
      UPDATE loyalty_accounts
      SET points = points + 200
      WHERE customer_id = NEW.customer_id;

      SELECT points INTO v_referee_balance
      FROM loyalty_accounts WHERE customer_id = NEW.customer_id;

      INSERT INTO loyalty_transactions (customer_id, points, type, description, balance_after)
      VALUES (
        NEW.customer_id,
        200,
        'bonus',
        'Welcome bonus - referred by ' || v_referral.referrer_name,
        v_referee_balance
      );

      -- ── Mark referral as completed ──
      UPDATE referrals
      SET status = 'completed',
          referee_id = NEW.customer_id,
          referee_name = NEW.customer_name,
          points_earned = v_referral_points,
          completed_at = NOW()
      WHERE id = v_referral.id;
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ────────────────────────────────────────────────────────────
-- SECTION 4: Birthday bonus cron job for Platinum customers
-- ────────────────────────────────────────────────────────────

SELECT cron.unschedule('platinum-birthday-bonus')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'platinum-birthday-bonus');

SELECT cron.schedule(
  'platinum-birthday-bonus',
  '0 3 * * *',  -- daily at 3:00 UTC (6:00 EAT)
  $$

  WITH eligible_customers AS (
    SELECT p.id AS customer_id, p.name AS customer_name, la.points
    FROM profiles p
    JOIN loyalty_accounts la ON la.customer_id = p.id
    WHERE p.birthday IS NOT NULL
      AND p.role = 'customer'
      AND p.is_active = true
      AND la.tier = 'platinum'
      AND EXTRACT(MONTH FROM p.birthday) = EXTRACT(MONTH FROM CURRENT_DATE)
      AND EXTRACT(DAY   FROM p.birthday) = EXTRACT(DAY   FROM CURRENT_DATE)
      -- Guard: no birthday bonus already awarded this year
      AND NOT EXISTS (
        SELECT 1 FROM loyalty_transactions lt
        WHERE lt.customer_id = p.id
          AND lt.type = 'bonus'
          AND lt.description LIKE 'Birthday bonus - Platinum perk%'
          AND EXTRACT(YEAR FROM lt.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)
      )
  ),
  updated_accounts AS (
    UPDATE loyalty_accounts la
    SET points = la.points + 200
    FROM eligible_customers ec
    WHERE la.customer_id = ec.customer_id
    RETURNING la.customer_id, la.points AS new_balance
  )
  INSERT INTO loyalty_transactions (customer_id, points, type, description, balance_after)
  SELECT
    ua.customer_id,
    200,
    'bonus',
    'Birthday bonus - Platinum perk (' || EXTRACT(YEAR FROM CURRENT_DATE)::TEXT || ')',
    ua.new_balance
  FROM updated_accounts ua;

  $$
);


-- ────────────────────────────────────────────────────────────
-- SECTION 5: Grant execute on new function signature
-- ────────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION calculate_order_pricing(JSONB, TEXT, TEXT, UUID, TEXT) TO authenticated;
