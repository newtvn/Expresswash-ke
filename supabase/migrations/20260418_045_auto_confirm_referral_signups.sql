-- Auto-confirm users who sign up via a referral link
-- Triggered after a new user is created in auth.users
-- Checks if their email matches a pending referral, and if so, confirms them

CREATE OR REPLACE FUNCTION auto_confirm_referral_signup()
RETURNS TRIGGER AS $$
DECLARE
  v_referral RECORD;
BEGIN
  -- Check if this new user's email matches a pending referral
  SELECT * INTO v_referral
  FROM referrals
  WHERE referee_email = NEW.email
    AND status = 'pending'
  LIMIT 1;

  IF FOUND THEN
    -- Auto-confirm the email (skip verification for referred users)
    UPDATE auth.users
    SET email_confirmed_at = NOW()
    WHERE id = NEW.id
      AND email_confirmed_at IS NULL;

    -- Link the referral to this user
    UPDATE referrals
    SET referee_id = NEW.id,
        referee_name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
    WHERE id = v_referral.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fire AFTER INSERT on auth.users (after the user is created but before they try to log in)
DROP TRIGGER IF EXISTS trg_auto_confirm_referral ON auth.users;
CREATE TRIGGER trg_auto_confirm_referral
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_referral_signup();
