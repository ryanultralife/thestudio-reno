-- ============================================
-- UPDATE CAMPAIGN TARGETING TO RESPECT OPT-IN PREFERENCES
-- Ensures marketing campaigns only target users who opted in
-- ============================================

-- Update get_campaign_targets function to check proper opt-in fields
CREATE OR REPLACE FUNCTION get_campaign_targets(campaign_id_param UUID)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  phone VARCHAR
) AS $$
DECLARE
  campaign RECORD;
  is_marketing_campaign BOOLEAN;
BEGIN
  -- Get campaign details
  SELECT * INTO campaign FROM notification_campaigns WHERE id = campaign_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

  -- Determine if this is a marketing campaign
  -- Marketing campaigns: promotions, special offers, general news
  -- Transactional campaigns: membership expiring, class reminders, booking confirmations
  is_marketing_campaign := campaign.trigger_type IN (
    'attendance_milestone',  -- Celebratory/engagement
    'birthday',              -- Celebratory
    'new_member_welcome'     -- Welcome series
  );

  -- Return users based on trigger type
  RETURN QUERY
  SELECT DISTINCT
    u.id,
    u.email,
    u.first_name,
    u.last_name,
    u.phone
  FROM users u
  INNER JOIN member_engagement_metrics m ON u.id = m.user_id
  LEFT JOIN user_notification_preferences p ON u.id = p.user_id
  LEFT JOIN notification_campaign_logs l ON u.id = l.user_id AND l.campaign_id = campaign_id_param
  WHERE
    -- User is active
    u.is_active = true

    -- Role matches
    AND u.role = ANY(campaign.target_roles)

    -- Has email (required for email campaigns)
    AND u.email IS NOT NULL

    -- Check opt-in based on campaign type
    AND (
      CASE
        -- Marketing campaigns require explicit opt-in
        WHEN is_marketing_campaign THEN
          u.email_opt_in = true
        -- Transactional campaigns just need notifications enabled (always true)
        ELSE
          u.notifications_enabled = true
      END
    )

    -- Legacy opt-out check (from user_notification_preferences table)
    AND (p.email_enabled IS NULL OR p.email_enabled = true)
    AND (p.opted_out_campaigns IS NULL OR campaign_id_param != ANY(p.opted_out_campaigns))

    -- Cooldown period (don't resend too soon)
    AND (l.sent_at IS NULL OR l.sent_at < NOW() - (campaign.cooldown_days || ' days')::INTERVAL)

    -- Trigger-specific conditions
    AND CASE campaign.trigger_type
      WHEN 'membership_expiring' THEN
        m.days_until_expiration = (campaign.trigger_config->>'days_before')::INTEGER
      WHEN 'membership_expired' THEN
        m.days_since_expiration BETWEEN 1 AND (campaign.trigger_config->>'days_after')::INTEGER
      WHEN 'inactive_member' THEN
        m.days_since_last_class >= (campaign.trigger_config->>'days_inactive')::INTEGER
      WHEN 'declining_attendance' THEN
        m.engagement_trend = 'decreasing'
      WHEN 'low_credits' THEN
        m.low_credits = true
      WHEN 'no_upcoming_bookings' THEN
        m.upcoming_bookings = 0 AND m.membership_status = 'active'
      WHEN 'attendance_milestone' THEN
        m.total_classes_all_time = (campaign.trigger_config->>'milestone')::INTEGER
      WHEN 'new_member_welcome' THEN
        DATE_PART('day', NOW() - u.created_at) = (campaign.trigger_config->>'days_after_signup')::INTEGER
      WHEN 'birthday' THEN
        EXTRACT(MONTH FROM u.date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM u.date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
      ELSE false
    END;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_campaign_targets IS
'Returns users eligible to receive a specific campaign.
Respects opt-in preferences:
- Marketing campaigns (milestones, birthdays, welcome): Requires email_opt_in = true
- Transactional campaigns (membership expiring, class reminders): Always sent if notifications_enabled = true
Also respects cooldown periods and user-specific opt-outs.';

-- Add trigger type categorization to campaigns table
ALTER TABLE notification_campaigns ADD COLUMN IF NOT EXISTS is_marketing BOOLEAN DEFAULT false;

COMMENT ON COLUMN notification_campaigns.is_marketing IS
'Indicates if this is a marketing campaign (requires user opt-in) vs transactional (always sent).
Marketing: Promotions, milestones, birthdays, general engagement
Transactional: Membership expiring, class reminders, booking confirmations';

-- Update existing campaigns to mark marketing vs transactional
UPDATE notification_campaigns
SET is_marketing = true
WHERE trigger_type IN ('attendance_milestone', 'birthday', 'new_member_welcome');

UPDATE notification_campaigns
SET is_marketing = false
WHERE trigger_type IN (
  'membership_expiring',
  'membership_expired',
  'inactive_member',
  'declining_attendance',
  'low_credits',
  'no_upcoming_bookings',
  'teacher_no_classes'
);
