-- ============================================
-- AUTOMATED NOTIFICATION CAMPAIGNS
-- Trigger-based email/SMS campaigns
-- ============================================

-- ============================================
-- NOTIFICATION CAMPAIGNS
-- ============================================

CREATE TABLE IF NOT EXISTS notification_campaigns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Campaign Info
  name VARCHAR(255) NOT NULL,
  description TEXT,

  -- Target Audience
  target_type VARCHAR(30) NOT NULL CHECK (target_type IN ('members', 'teachers', 'all_users', 'custom')),
  target_roles TEXT[] DEFAULT ARRAY['student'], -- Filter by user role

  -- Trigger Type
  trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
    'membership_expiring',      -- X days before expiration
    'membership_expired',       -- X days after expiration
    'inactive_member',          -- No visits in X days
    'declining_attendance',     -- Attendance dropped X%
    'new_member_welcome',       -- X days after signup
    'attendance_milestone',     -- After X classes
    'no_upcoming_bookings',     -- Has membership but no future bookings
    'low_credits',              -- Credits below threshold
    'teacher_no_classes',       -- Teacher hasn't taught in X days
    'birthday',                 -- On user's birthday
    'anniversary',              -- X years since joined
    'abandoned_booking',        -- Started but didn't complete booking
    'class_reminder',           -- X hours before class
    'review_request',           -- X days after class
    'custom'                    -- Custom SQL query
  )),

  -- Trigger Configuration (JSON)
  trigger_config JSONB DEFAULT '{}', -- { "days": 7, "threshold": 50, etc. }

  -- Message Content
  channel VARCHAR(20) DEFAULT 'email' CHECK (channel IN ('email', 'sms', 'both')),
  email_subject VARCHAR(255),
  email_body TEXT,
  email_template VARCHAR(50), -- Reference to email template
  sms_message TEXT,

  -- Scheduling
  is_active BOOLEAN DEFAULT true,
  run_frequency VARCHAR(20) DEFAULT 'daily' CHECK (run_frequency IN ('hourly', 'daily', 'weekly')),
  run_time TIME DEFAULT '09:00:00', -- What time to check/send
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,

  -- Limits & Throttling
  max_sends_per_run INTEGER, -- Prevent email overload
  cooldown_days INTEGER DEFAULT 30, -- Don't resend to same user within X days

  -- Tracking
  total_sent INTEGER DEFAULT 0,
  total_opened INTEGER DEFAULT 0,
  total_clicked INTEGER DEFAULT 0,

  -- Metadata
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_active ON notification_campaigns(is_active, next_run_at);
CREATE INDEX idx_campaigns_trigger ON notification_campaigns(trigger_type);

-- ============================================
-- NOTIFICATION CAMPAIGN LOG
-- Track individual sends
-- ============================================

CREATE TABLE IF NOT EXISTS notification_campaign_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  campaign_id UUID NOT NULL REFERENCES notification_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Send Details
  channel VARCHAR(20) NOT NULL,
  sent_at TIMESTAMPTZ DEFAULT NOW(),

  -- Content Sent
  subject VARCHAR(255),
  message TEXT,

  -- Engagement
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,

  -- Status
  status VARCHAR(30) DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced', 'opened', 'clicked')),
  error_message TEXT
);

CREATE INDEX idx_campaign_logs_campaign ON notification_campaign_logs(campaign_id, sent_at DESC);
CREATE INDEX idx_campaign_logs_user ON notification_campaign_logs(user_id, sent_at DESC);
CREATE INDEX idx_campaign_logs_status ON notification_campaign_logs(status);

-- ============================================
-- USER NOTIFICATION PREFERENCES
-- Allow users to opt out of specific campaigns
-- ============================================

CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,

  -- Global Preferences
  email_enabled BOOLEAN DEFAULT true,
  sms_enabled BOOLEAN DEFAULT false,

  -- Campaign Type Opt-outs
  marketing_emails BOOLEAN DEFAULT true,
  transactional_emails BOOLEAN DEFAULT true, -- Can't opt out
  class_reminders BOOLEAN DEFAULT true,
  attendance_nudges BOOLEAN DEFAULT true,
  promotional_sms BOOLEAN DEFAULT false,

  -- Specific Campaign Opt-outs
  opted_out_campaigns UUID[], -- Array of campaign IDs

  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEMBER ENGAGEMENT METRICS (Computed View)
-- ============================================

CREATE OR REPLACE VIEW member_engagement_metrics AS
SELECT
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name,
  u.role,

  -- Membership Info
  m.id as membership_id,
  m.status as membership_status,
  m.end_date as membership_end_date,
  CASE
    WHEN m.end_date IS NOT NULL THEN m.end_date - CURRENT_DATE
    ELSE NULL
  END as days_until_expiration,

  -- Attendance Metrics
  COUNT(DISTINCT b.id) FILTER (WHERE b.created_at >= NOW() - INTERVAL '30 days') as classes_last_30_days,
  COUNT(DISTINCT b.id) FILTER (WHERE b.created_at >= NOW() - INTERVAL '60 days' AND b.created_at < NOW() - INTERVAL '30 days') as classes_prev_30_days,
  MAX(b.class_date) as last_class_date,
  CURRENT_DATE - MAX(b.class_date) as days_since_last_class,
  COUNT(DISTINCT b.id) as total_classes_all_time,

  -- Engagement Trend
  CASE
    WHEN COUNT(DISTINCT b.id) FILTER (WHERE b.created_at >= NOW() - INTERVAL '30 days') >
         COUNT(DISTINCT b.id) FILTER (WHERE b.created_at >= NOW() - INTERVAL '60 days' AND b.created_at < NOW() - INTERVAL '30 days')
    THEN 'increasing'
    WHEN COUNT(DISTINCT b.id) FILTER (WHERE b.created_at >= NOW() - INTERVAL '30 days') <
         COUNT(DISTINCT b.id) FILTER (WHERE b.created_at >= NOW() - INTERVAL '60 days' AND b.created_at < NOW() - INTERVAL '30 days')
    THEN 'decreasing'
    ELSE 'stable'
  END as engagement_trend,

  -- Upcoming Bookings
  COUNT(DISTINCT fb.id) FILTER (WHERE fb.class_date >= CURRENT_DATE) as upcoming_bookings,

  -- Credits (if applicable)
  m.credits_remaining,

  -- Risk Flags
  CASE WHEN m.end_date IS NOT NULL AND m.end_date - CURRENT_DATE <= 7 THEN true ELSE false END as expiring_soon,
  CASE WHEN CURRENT_DATE - MAX(b.class_date) > 14 THEN true ELSE false END as inactive_14_days,
  CASE WHEN CURRENT_DATE - MAX(b.class_date) > 30 THEN true ELSE false END as inactive_30_days,
  CASE WHEN m.credits_remaining IS NOT NULL AND m.credits_remaining <= 2 THEN true ELSE false END as low_credits,

  u.created_at as member_since

FROM users u
LEFT JOIN memberships m ON u.id = m.user_id AND m.status = 'active'
LEFT JOIN bookings b ON u.id = b.user_id AND b.status = 'confirmed'
LEFT JOIN bookings fb ON u.id = fb.user_id AND fb.status = 'confirmed' AND fb.class_date >= CURRENT_DATE
WHERE u.role = 'student'
GROUP BY u.id, u.email, u.first_name, u.last_name, u.role, m.id, m.status, m.end_date, m.credits_remaining, u.created_at;

-- ============================================
-- TEACHER ENGAGEMENT METRICS (Computed View)
-- ============================================

CREATE OR REPLACE VIEW teacher_engagement_metrics AS
SELECT
  u.id as user_id,
  u.email,
  u.first_name,
  u.last_name,

  -- Teaching Activity
  COUNT(DISTINCT c.id) FILTER (WHERE c.date >= NOW() - INTERVAL '30 days') as classes_taught_last_30_days,
  COUNT(DISTINCT c.id) FILTER (WHERE c.date >= NOW() - INTERVAL '60 days' AND c.date < NOW() - INTERVAL '30 days') as classes_taught_prev_30_days,
  MAX(c.date) as last_taught_date,
  CURRENT_DATE - MAX(c.date) as days_since_last_class,

  -- Upcoming Classes
  COUNT(DISTINCT fc.id) FILTER (WHERE fc.date >= CURRENT_DATE) as upcoming_classes,

  -- Attendance Stats
  AVG(c.checked_in_count) FILTER (WHERE c.date >= NOW() - INTERVAL '90 days') as avg_attendance_last_90_days,

  -- Activity Flags
  CASE WHEN CURRENT_DATE - MAX(c.date) > 30 THEN true ELSE false END as inactive_30_days,
  CASE WHEN COUNT(DISTINCT fc.id) FILTER (WHERE fc.date >= CURRENT_DATE) = 0 THEN true ELSE false END as no_upcoming_classes,

  u.created_at as teacher_since

FROM users u
LEFT JOIN classes c ON u.id = c.teacher_id
LEFT JOIN classes fc ON u.id = fc.teacher_id AND fc.date >= CURRENT_DATE
WHERE u.role = 'teacher'
GROUP BY u.id, u.email, u.first_name, u.last_name, u.created_at;

-- ============================================
-- SEED: EXAMPLE CAMPAIGNS
-- ============================================

INSERT INTO notification_campaigns (name, description, target_type, target_roles, trigger_type, trigger_config, channel, email_subject, email_body, run_frequency, is_active) VALUES

-- Member Campaigns
('Membership Expiring Soon', 'Remind members 7 days before membership expires', 'members', ARRAY['student'], 'membership_expiring',
 '{"days_before": 7}', 'email',
 'Your membership expires in 7 days',
 'Hi {{first_name}},\n\nYour membership at The Studio Reno expires on {{expiration_date}}.\n\nRenew now to keep your practice going!\n\nRenew here: {{renewal_link}}\n\nSee you on the mat!',
 'daily', true),

('Inactive Member Check-in', 'Reach out to members who haven''t visited in 14 days', 'members', ARRAY['student'], 'inactive_member',
 '{"days_inactive": 14}', 'email',
 'We miss you at The Studio!',
 'Hi {{first_name}},\n\nWe haven''t seen you in a couple weeks. Everything okay?\n\nYour membership is still active. Come back and join us!\n\nCheck the schedule: {{schedule_link}}\n\nWe''d love to see you soon.',
 'daily', true),

('Declining Attendance Alert', 'Engage with members whose attendance is dropping', 'members', ARRAY['student'], 'declining_attendance',
 '{"threshold_percent": 50}', 'email',
 'Is everything okay?',
 'Hi {{first_name}},\n\nWe''ve noticed your visits have decreased recently. If there''s anything we can do to support your practice, please let us know.\n\nHave you tried our new classes? {{new_classes}}\n\nWe''re here for you!',
 'weekly', true),

('Low Credits Warning', 'Alert members when credits are running low', 'members', ARRAY['student'], 'low_credits',
 '{"threshold": 2}', 'email',
 'You''re running low on class credits',
 'Hi {{first_name}},\n\nYou have {{credits_remaining}} class credits remaining.\n\nPurchase more credits or upgrade to unlimited: {{purchase_link}}\n\nNever miss a class!',
 'daily', true),

('No Upcoming Bookings', 'Nudge active members who have no future bookings', 'members', ARRAY['student'], 'no_upcoming_bookings',
 '{}', 'email',
 'Book your next class!',
 'Hi {{first_name}},\n\nYou don''t have any upcoming classes booked. Don''t break your streak!\n\nBrowse the schedule and reserve your spot: {{schedule_link}}\n\nSee you soon!',
 'daily', true),

-- Teacher Campaigns
('Teacher Inactive Check-in', 'Check in with teachers who haven''t taught recently', 'teachers', ARRAY['teacher'], 'teacher_no_classes',
 '{"days_inactive": 21}', 'email',
 'We''d love to see you back on the schedule',
 'Hi {{first_name}},\n\nWe haven''t seen you teaching lately. Is everything okay?\n\nIf you''d like to get back on the schedule, let us know!\n\nYour students miss you!',
 'weekly', true),

-- Milestone Campaigns
('10 Class Milestone', 'Celebrate members who complete 10 classes', 'members', ARRAY['student'], 'attendance_milestone',
 '{"milestone": 10}', 'email',
 '🎉 You''ve completed 10 classes!',
 'Hi {{first_name}},\n\nCongratulations! You''ve completed 10 classes at The Studio Reno.\n\nYour dedication inspires us. Keep showing up for yourself!\n\nNameste 🙏',
 'daily', true);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to get users matching campaign criteria
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
BEGIN
  -- Get campaign details
  SELECT * INTO campaign FROM notification_campaigns WHERE id = campaign_id_param;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Campaign not found';
  END IF;

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

    -- Not opted out
    AND (p.email_enabled IS NULL OR p.email_enabled = true)
    AND (p.opted_out_campaigns IS NULL OR campaign_id_param != ANY(p.opted_out_campaigns))

    -- Cooldown period (don't resend too soon)
    AND (l.sent_at IS NULL OR l.sent_at < NOW() - (campaign.cooldown_days || ' days')::INTERVAL)

    -- Trigger-specific conditions
    AND CASE campaign.trigger_type
      WHEN 'membership_expiring' THEN
        m.days_until_expiration = (campaign.trigger_config->>'days_before')::INTEGER
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
      ELSE false
    END;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PERMISSIONS
-- ============================================

INSERT INTO permissions (name, description, category) VALUES
('manage_campaigns', 'Create and manage automated email campaigns', 'marketing'),
('view_campaign_reports', 'View campaign performance reports', 'marketing')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions WHERE name IN ('manage_campaigns', 'view_campaign_reports')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name IN ('manage_campaigns', 'view_campaign_reports')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name = 'view_campaign_reports'
ON CONFLICT DO NOTHING;
