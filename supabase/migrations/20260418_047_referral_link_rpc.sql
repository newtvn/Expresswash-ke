-- Safe RPC to link a referral to a new user after signup
-- Runs as SECURITY DEFINER to bypass RLS on referrals table
-- Called from the frontend after successful signup

CREATE OR REPLACE FUNCTION link_referral_signup(
  p_referral_code TEXT,
  p_user_id UUID,
  p_user_name TEXT
) RETURNS JSONB AS $$
DECLARE
  v_referral RECORD;
BEGIN
  -- Find the pending referral by code
  SELECT * INTO v_referral
  FROM referrals
  WHERE referral_code = p_referral_code
    AND status = 'pending'
    AND referee_id IS NULL
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'Referral code not found or already used');
  END IF;

  -- Link the user to the referral
  UPDATE referrals
  SET referee_id = p_user_id,
      referee_name = p_user_name
  WHERE id = v_referral.id;

  RETURN jsonb_build_object('success', true, 'message', 'Referral linked');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION link_referral_signup(TEXT, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION link_referral_signup(TEXT, UUID, TEXT) TO anon;
