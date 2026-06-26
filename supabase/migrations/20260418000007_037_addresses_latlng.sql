-- Add lat/lng to addresses and orders for map-based location picking
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_lat DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_lng DOUBLE PRECISION;
