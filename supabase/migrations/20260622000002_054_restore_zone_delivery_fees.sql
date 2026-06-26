-- ============================================================
-- Restore positive delivery fees for operational zones.
--
-- Integration tests and pricing functions expect active zones to
-- have non-zero base_delivery_fee values. This reapplies the
-- canonical fee schedule from migration 014 where fees drifted to 0.
-- ============================================================

UPDATE zones
SET base_delivery_fee = CASE
  WHEN name = 'Kitengela' THEN 300.00
  WHEN name = 'Athi River' THEN 300.00
  WHEN name = 'Syokimau' THEN 350.00
  WHEN name = 'Greater Nairobi' THEN 500.00
  WHEN name = 'Other' THEN 600.00
  ELSE base_delivery_fee
END
WHERE base_delivery_fee <= 0;

ALTER TABLE zones
  DROP CONSTRAINT IF EXISTS zones_base_delivery_fee_positive;

ALTER TABLE zones
  ADD CONSTRAINT zones_base_delivery_fee_positive
  CHECK (base_delivery_fee > 0);
