-- ============================================================
-- Migration: Server-side pricing function
-- WK2 Step 7b: calculate_order_pricing() for price validation
-- ============================================================

CREATE OR REPLACE FUNCTION calculate_order_pricing(
  p_items     JSONB,
  p_zone_name TEXT,
  p_promo_code TEXT DEFAULT NULL
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
  v_vat_rate      NUMERIC := 0.16;
  v_vat_amount    NUMERIC;
  v_discount      NUMERIC := 0;
  v_total         NUMERIC;
  v_zone_fee      NUMERIC;
  v_promo         RECORD;
  v_items_out     JSONB := '[]'::JSONB;
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
      IF v_promo.discount_type = 'percentage' THEN
        v_discount := ROUND(v_subtotal * (v_promo.discount_value / 100));
      ELSIF v_promo.discount_type = 'fixed_amount' THEN
        v_discount := LEAST(v_promo.discount_value, v_subtotal);
      END IF;
    END IF;
  END IF;

  -- Calculate VAT on (subtotal - discount + delivery)
  v_vat_amount := ROUND((v_subtotal - v_discount + v_delivery_fee) * v_vat_rate);

  -- Calculate total
  v_total := v_subtotal - v_discount + v_delivery_fee + v_vat_amount;

  RETURN jsonb_build_object(
    'subtotal', v_subtotal,
    'delivery_fee', v_delivery_fee,
    'discount', v_discount,
    'vat_rate', v_vat_rate,
    'vat_amount', v_vat_amount,
    'total', v_total,
    'zone', p_zone_name,
    'promo_code', p_promo_code,
    'items', v_items_out
  );
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION calculate_order_pricing(JSONB, TEXT, TEXT) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE '[OK] calculate_order_pricing function created';
END $$;
