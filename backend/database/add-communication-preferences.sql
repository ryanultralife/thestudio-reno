-- ============================================
-- COMMUNICATION PREFERENCES MIGRATION
-- Adds proper distinction between transactional and marketing communications
-- ============================================

-- Add communication preference columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

-- Add comments to clarify usage
COMMENT ON COLUMN users.notifications_enabled IS
'Transactional notifications (class reminders, membership updates, booking confirmations).
Always enabled - required for core functionality. Cannot be opted out.';

COMMENT ON COLUMN users.email_opt_in IS
'Marketing email opt-in (promotions, newsletters, special offers).
User can opt out. Defaults to TRUE but user must explicitly consent during signup.';

COMMENT ON COLUMN users.sms_opt_in IS
'Marketing SMS opt-in (promotional texts).
User must explicitly opt in. Defaults to FALSE. Requires phone number.';

-- Create view for campaign-eligible users (respects opt-in preferences)
CREATE OR REPLACE VIEW campaign_eligible_users AS
SELECT
  u.id,
  u.email,
  u.phone,
  u.first_name,
  u.last_name,
  u.email_opt_in,
  u.sms_opt_in,
  u.notifications_enabled,
  u.is_active,
  CASE
    WHEN u.email_opt_in = true AND u.email IS NOT NULL THEN true
    ELSE false
  END as can_email_marketing,
  CASE
    WHEN u.sms_opt_in = true AND u.phone IS NOT NULL THEN true
    ELSE false
  END as can_sms_marketing,
  CASE
    WHEN u.notifications_enabled = true AND u.email IS NOT NULL THEN true
    ELSE false
  END as can_email_transactional,
  CASE
    WHEN u.notifications_enabled = true AND u.phone IS NOT NULL THEN true
    ELSE false
  END as can_sms_transactional
FROM users u
WHERE u.is_active = true;

COMMENT ON VIEW campaign_eligible_users IS
'Users eligible for different types of communications based on their preferences.
- can_email_marketing: User opted in to promotional emails
- can_sms_marketing: User opted in to promotional texts
- can_email_transactional: Can receive class reminders, booking confirmations (always enabled)
- can_sms_transactional: Can receive transactional texts (always enabled if phone provided)';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email_opt_in ON users(email_opt_in) WHERE email_opt_in = true;
CREATE INDEX IF NOT EXISTS idx_users_sms_opt_in ON users(sms_opt_in) WHERE sms_opt_in = true;
CREATE INDEX IF NOT EXISTS idx_users_notifications_enabled ON users(notifications_enabled) WHERE notifications_enabled = true;

-- Update existing users to have notifications enabled by default
UPDATE users
SET notifications_enabled = true
WHERE notifications_enabled IS NULL;

-- Grant permissions
GRANT SELECT ON campaign_eligible_users TO thestudio_admin;
