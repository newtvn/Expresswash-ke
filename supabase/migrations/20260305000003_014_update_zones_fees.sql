-- ============================================================
-- Migration: Update zone delivery fees + add missing zones
-- WK2 Step 7a: Sync DB zones with frontend orderService.ts rates
-- ============================================================

-- Update existing zone fees to match frontend PRICING.deliveryFees
UPDATE zones SET base_delivery_fee = 300.00 WHERE name = 'Kitengela';
UPDATE zones SET base_delivery_fee = 300.00 WHERE name = 'Athi River';
UPDATE zones SET base_delivery_fee = 500.00 WHERE name = 'Greater Nairobi';

-- Add missing zones
INSERT INTO zones (name, delivery_policy, delivery_days, base_delivery_fee, cutoff_time)
VALUES
  ('Syokimau', 'same_day', NULL, 350.00, '12:00:00'),
  ('Other', '48_hour', ARRAY['monday','wednesday','friday'], 600.00, NULL)
ON CONFLICT (name) DO NOTHING;

-- Verification
DO $$
DECLARE
  v_kitengela NUMERIC;
  v_syokimau  NUMERIC;
BEGIN
  SELECT base_delivery_fee INTO v_kitengela FROM zones WHERE name = 'Kitengela';
  ASSERT v_kitengela = 300.00, 'Kitengela fee should be 300';

  SELECT base_delivery_fee INTO v_syokimau FROM zones WHERE name = 'Syokimau';
  ASSERT v_syokimau = 350.00, 'Syokimau fee should be 350';

  RAISE NOTICE '[OK] Zone delivery fees updated';
END $$;
