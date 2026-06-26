-- ============================================================
-- Migration: Seed notification template for referral invites
--
-- Used by loyaltyService.createReferral() to queue an email
-- invite via the notification_history -> send-notification
-- edge function pipeline.
--
-- Template variables (camelCase, matching existing convention):
--   {{referrerName}}, {{referralCode}}, {{signupUrl}}
-- ============================================================

INSERT INTO notification_templates (name, channel, subject, body, variables, is_active)
VALUES (
  'Referral Invite',
  'email',
  '{{referrerName}} invited you to try ExpressWash!',
  E'<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">'
  || E'<h2 style="color: #2563eb;">You''ve been invited to ExpressWash!</h2>'
  || E'<p>{{referrerName}} thinks you''ll love ExpressWash Kenya''s carpet and fabric cleaning service. '
  || E'Sign up using their referral code and you''ll both earn <strong>200 loyalty points</strong> on your first completed order!</p>'
  || E'<div style="text-align: center; margin: 24px 0;">'
  || E'<span style="display: inline-block; padding: 12px 24px; background: #f3f4f6; border-radius: 8px; font-family: monospace; font-size: 20px; font-weight: bold; letter-spacing: 2px;">{{referralCode}}</span>'
  || E'</div>'
  || E'<p style="text-align: center;"><a href="{{signupUrl}}" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: 600;">Sign Up Now</a></p>'
  || E'<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;">'
  || E'<p style="color: #6b7280; font-size: 12px; text-align: center;">ExpressWash Kenya - Professional Carpet &amp; Fabric Cleaning</p>'
  || E'</div>',
  ARRAY['referrerName', 'referralCode', 'signupUrl'],
  true
)
ON CONFLICT (name, channel) DO NOTHING;
