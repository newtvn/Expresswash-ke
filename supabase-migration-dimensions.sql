-- ============================================================
-- Migration: Add dimension-based pricing columns
-- Run this in Supabase SQL Editor
-- ============================================================

-- Add pricing/dimension columns to order_items
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS item_type TEXT;
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS length_inches NUMERIC(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS width_inches NUMERIC(10,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS unit_price NUMERIC(12,2);
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(12,2);

-- Add address and pricing to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_fee NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS vat NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS total NUMERIC(12,2);
ALTER TABLE orders ADD COLUMN IF NOT EXISTS notes TEXT;
