-- Fix: The original trigger tried to UPDATE auth.users inside an AFTER INSERT
-- trigger on auth.users, which caused a recursive error.
-- Solution: Only link the referral (no auth.users update).
-- Email confirmation is handled by disabling the setting in Supabase Dashboard.

CREATE OR REPLACE FUNCTION auto_confirm_referral_signup()
RETURNS TRIGGER AS $$
BEGIN
  -- Link pending referral to the new user (by email match)
  UPDATE referrals
  SET referee_id = NEW.id,
      referee_name = COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  WHERE referee_email = NEW.email
    AND status = 'pending'
    AND referee_id IS NULL;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_confirm_referral ON auth.users;
CREATE TRIGGER trg_auto_confirm_referral
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION auto_confirm_referral_signup();
