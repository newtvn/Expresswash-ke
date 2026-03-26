-- Allow direct transition from PENDING (1) to DRIVER_ASSIGNED (3)
-- when admin assigns a driver without going through CONFIRMED first.
CREATE OR REPLACE FUNCTION validate_order_status_transition()
RETURNS trigger AS $$
DECLARE
  transitions JSONB := '{
    "1":  [2, 3, 13],
    "2":  [3, 13],
    "3":  [4, 13],
    "4":  [5, 13],
    "5":  [6],
    "6":  [7],
    "7":  [8],
    "8":  [9, 6],
    "9":  [10],
    "10": [11],
    "11": [12],
    "12": [14],
    "13": [],
    "14": []
  }'::JSONB;
  allowed JSONB;
  is_valid BOOLEAN := false;
  i INTEGER;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  allowed := transitions->(OLD.status::TEXT);

  IF allowed IS NULL THEN
    RAISE EXCEPTION 'Unknown current status: %. Cannot determine valid transitions.', OLD.status;
  END IF;

  FOR i IN 0..jsonb_array_length(allowed) - 1 LOOP
    IF (allowed->i)::INTEGER = NEW.status THEN
      is_valid := true;
      EXIT;
    END IF;
  END LOOP;

  IF NOT is_valid THEN
    RAISE EXCEPTION 'Invalid status transition: % → %. Allowed transitions from % are: %',
      OLD.status, NEW.status, OLD.status, allowed;
  END IF;

  IF NEW.status = 2 AND OLD.status = 1 THEN
    NEW.sla_deadline := NOW() + INTERVAL '48 hours';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
