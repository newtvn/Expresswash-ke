-- Public function to look up referee email by referral code
-- Used on the signup page when a user arrives via a referral link
-- No auth required - only returns the email, nothing sensitive
CREATE OR REPLACE FUNCTION get_referral_email(p_code TEXT)
RETURNS TEXT AS $$
DECLARE
  v_email TEXT;
BEGIN
  SELECT referee_email INTO v_email
  FROM referrals
  WHERE referral_code = p_code
    AND status = 'pending'
  LIMIT 1;

  RETURN v_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_referral_email(TEXT) TO anon;
GRANT EXECUTE ON FUNCTION get_referral_email(TEXT) TO authenticated;
