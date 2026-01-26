-- ============================================
-- MARKETING AUTOMATION SCHEMA
-- Email campaigns, segmentation, and automation
-- ============================================

-- ============================================
-- 1. EMAIL TEMPLATES (Enhanced)
-- ============================================

-- Drop and recreate for better structure
DROP TABLE IF EXISTS marketing_email_templates CASCADE;

CREATE TABLE marketing_email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Template content
    subject VARCHAR(255) NOT NULL,
    preview_text VARCHAR(255), -- Email preview/preheader text
    body_html TEXT NOT NULL,
    body_text TEXT, -- Plain text fallback
    -- Template type
    template_type VARCHAR(30) DEFAULT 'marketing' CHECK (template_type IN (
        'marketing', 'transactional', 'automation', 'newsletter'
    )),
    -- Design
    header_image_url TEXT,
    footer_html TEXT,
    -- Personalization tokens available
    available_tokens TEXT[] DEFAULT ARRAY['first_name', 'last_name', 'email'],
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default templates
INSERT INTO marketing_email_templates (name, subject, preview_text, body_html, template_type, available_tokens) VALUES
('Welcome Series - Day 1', 'Welcome to The Studio Reno, {{first_name}}!', 'Your yoga journey starts here',
'<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2d3748;">Welcome, {{first_name}}!</h1>
<p>We''re so excited to have you join our community at The Studio Reno.</p>
<p>Here''s what you can expect:</p>
<ul>
<li>A welcoming, judgment-free space</li>
<li>Expert instructors passionate about yoga</li>
<li>Classes for every level, from beginner to advanced</li>
</ul>
<p><strong>Your next step:</strong> Book your first class!</p>
<a href="{{booking_url}}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Schedule</a>
<p style="margin-top: 24px;">Namaste,<br>The Studio Reno Team</p>
</div>', 'automation', ARRAY['first_name', 'last_name', 'booking_url']),

('Win-Back Campaign', 'We miss you, {{first_name}}!', 'It''s been a while - come back to your practice',
'<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2d3748;">We Miss You, {{first_name}}!</h1>
<p>It''s been {{days_since_visit}} days since your last class, and we''d love to see you back on the mat.</p>
<p>Life gets busy, but your practice is always here waiting for you.</p>
<p><strong>Special offer:</strong> Use code <strong>WELCOME10</strong> for 10% off your next class pack!</p>
<a href="{{booking_url}}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Book a Class</a>
</div>', 'automation', ARRAY['first_name', 'days_since_visit', 'booking_url']),

('New Class Announcement', 'New Class Alert: {{class_name}}', 'A new class has been added to the schedule',
'<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2d3748;">New Class: {{class_name}}</h1>
<p>Hi {{first_name}},</p>
<p>We''re excited to announce a new class on our schedule!</p>
<div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
<h2 style="margin: 0 0 10px;">{{class_name}}</h2>
<p style="margin: 5px 0;"><strong>Instructor:</strong> {{teacher_name}}</p>
<p style="margin: 5px 0;"><strong>When:</strong> {{class_schedule}}</p>
<p style="margin: 5px 0;"><strong>Level:</strong> {{class_level}}</p>
<p style="margin: 10px 0 0;">{{class_description}}</p>
</div>
<a href="{{booking_url}}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Book Now</a>
</div>', 'marketing', ARRAY['first_name', 'class_name', 'teacher_name', 'class_schedule', 'class_level', 'class_description', 'booking_url']),

('Membership Expiring', 'Your membership expires in {{days_remaining}} days', 'Don''t lose your unlimited access',
'<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2d3748;">Your Membership is Expiring Soon</h1>
<p>Hi {{first_name}},</p>
<p>Your <strong>{{membership_name}}</strong> expires in <strong>{{days_remaining}} days</strong>.</p>
<p>Renew now to keep your practice going without interruption.</p>
<div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
<p><strong>Current plan:</strong> {{membership_name}}</p>
<p><strong>Expires:</strong> {{expiry_date}}</p>
<p><strong>Classes attended:</strong> {{total_classes}}</p>
</div>
<a href="{{renew_url}}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Renew Membership</a>
</div>', 'automation', ARRAY['first_name', 'membership_name', 'days_remaining', 'expiry_date', 'total_classes', 'renew_url']),

('Workshop Follow-Up', 'How was {{workshop_name}}?', 'We''d love your feedback',
'<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2d3748;">Thanks for Attending!</h1>
<p>Hi {{first_name}},</p>
<p>Thank you for joining us at <strong>{{workshop_name}}</strong> with {{teacher_name}}.</p>
<p>We hope you found it valuable! Here are some ways to continue your journey:</p>
<ul>
<li>Practice what you learned in our regular {{related_classes}}</li>
<li>Check out upcoming workshops</li>
<li>Share your experience with friends</li>
</ul>
<p><strong>We''d love your feedback:</strong></p>
<a href="{{feedback_url}}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Share Feedback</a>
</div>', 'automation', ARRAY['first_name', 'workshop_name', 'teacher_name', 'related_classes', 'feedback_url']),

('Monthly Newsletter', '{{month}} at The Studio Reno', 'This month''s classes, events, and more',
'<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2d3748;">{{month}} Newsletter</h1>
<p>Hi {{first_name}},</p>
{{newsletter_content}}
<hr style="border: none; border-top: 1px solid #e2e8f0; margin: 30px 0;">
<p style="color: #718096; font-size: 14px;">The Studio Reno | 1085 S Virginia St, Reno, NV</p>
</div>', 'newsletter', ARRAY['first_name', 'month', 'newsletter_content']);

-- ============================================
-- 2. SEGMENTS (Dynamic User Groups)
-- ============================================

CREATE TABLE marketing_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Segment rules (JSON-based query builder)
    rules JSONB NOT NULL DEFAULT '{"conditions": [], "match": "all"}',
    -- Cached count (updated periodically)
    member_count INT DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE, -- System segments can't be deleted
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default segments
INSERT INTO marketing_segments (name, description, rules, is_system) VALUES
('All Active Members', 'Users with active memberships',
'{"match": "all", "conditions": [{"field": "membership_status", "operator": "equals", "value": "active"}]}', true),

('New Students (30 days)', 'Users who signed up in the last 30 days',
'{"match": "all", "conditions": [{"field": "created_at", "operator": "within_days", "value": 30}]}', true),

('At-Risk Members', 'Active members who haven''t visited in 14+ days',
'{"match": "all", "conditions": [
  {"field": "membership_status", "operator": "equals", "value": "active"},
  {"field": "last_visit", "operator": "more_than_days_ago", "value": 14}
]}', true),

('Lapsed Members', 'Members who haven''t visited in 30+ days',
'{"match": "all", "conditions": [{"field": "last_visit", "operator": "more_than_days_ago", "value": 30}]}', true),

('Unlimited Members', 'Members with unlimited memberships',
'{"match": "all", "conditions": [{"field": "membership_type", "operator": "equals", "value": "unlimited"}]}', true),

('Class Pack Members', 'Members with class pack memberships',
'{"match": "all", "conditions": [{"field": "membership_type", "operator": "equals", "value": "credits"}]}', true),

('Low Credits (<3)', 'Class pack members with fewer than 3 credits',
'{"match": "all", "conditions": [
  {"field": "membership_type", "operator": "equals", "value": "credits"},
  {"field": "credits_remaining", "operator": "less_than", "value": 3}
]}', true),

('Expiring Soon (7 days)', 'Memberships expiring in the next 7 days',
'{"match": "all", "conditions": [{"field": "membership_expires_in_days", "operator": "less_than", "value": 7}]}', true),

('Workshop Attendees', 'Users who have attended any workshop',
'{"match": "all", "conditions": [{"field": "attended_workshop", "operator": "equals", "value": true}]}', true),

('VIP Members', 'Members tagged as VIP',
'{"match": "all", "conditions": [{"field": "has_tag", "operator": "equals", "value": "vip"}]}', true),

('Hot Yoga Lovers', 'Members who frequently attend heated classes',
'{"match": "all", "conditions": [{"field": "attended_class_category", "operator": "includes", "value": "heated", "min_count": 3}]}', false),

('Morning Practitioners', 'Members who primarily attend morning classes',
'{"match": "all", "conditions": [{"field": "preferred_class_time", "operator": "equals", "value": "morning"}]}', false);

-- ============================================
-- 3. EMAIL CAMPAIGNS
-- ============================================

CREATE TABLE marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Campaign type
    campaign_type VARCHAR(30) DEFAULT 'one_time' CHECK (campaign_type IN (
        'one_time', 'recurring', 'automated', 'ab_test'
    )),
    -- Content
    template_id UUID REFERENCES marketing_email_templates(id),
    subject_line VARCHAR(255),
    preview_text VARCHAR(255),
    -- Custom content overrides
    custom_html TEXT,
    -- Targeting
    segment_id UUID REFERENCES marketing_segments(id),
    -- Or manual list
    recipient_list UUID[], -- Array of user IDs for manual campaigns
    -- Scheduling
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
    )),
    scheduled_for TIMESTAMPTZ,
    send_at_user_timezone BOOLEAN DEFAULT FALSE,
    -- Recurring settings
    recurring_schedule VARCHAR(50), -- Cron expression for recurring
    recurring_until DATE,
    -- Stats (denormalized for quick access)
    total_recipients INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    total_opened INT DEFAULT 0,
    total_clicked INT DEFAULT 0,
    total_unsubscribed INT DEFAULT 0,
    total_bounced INT DEFAULT 0,
    -- Metadata
    created_by UUID REFERENCES users(id),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaigns_status ON marketing_campaigns(status);
CREATE INDEX idx_campaigns_scheduled ON marketing_campaigns(scheduled_for) WHERE status = 'scheduled';

-- ============================================
-- 4. CAMPAIGN SENDS (Individual Emails)
-- ============================================

CREATE TABLE marketing_campaign_sends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Recipient info (stored in case user is deleted)
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(200),
    -- Personalization data used
    personalization_data JSONB DEFAULT '{}',
    -- Status tracking
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed'
    )),
    -- Provider tracking
    provider_message_id VARCHAR(255), -- SendGrid message ID
    -- Events
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    first_clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    bounce_reason TEXT,
    -- Click tracking
    click_count INT DEFAULT 0,
    -- Error tracking
    error_message TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_campaign_sends_campaign ON marketing_campaign_sends(campaign_id);
CREATE INDEX idx_campaign_sends_user ON marketing_campaign_sends(user_id);
CREATE INDEX idx_campaign_sends_status ON marketing_campaign_sends(status);
CREATE INDEX idx_campaign_sends_email ON marketing_campaign_sends(recipient_email);

-- ============================================
-- 5. CLICK TRACKING
-- ============================================

CREATE TABLE marketing_click_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    send_id UUID REFERENCES marketing_campaign_sends(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Click details
    original_url TEXT NOT NULL,
    link_name VARCHAR(100), -- Optional link identifier
    -- Context
    ip_address INET,
    user_agent TEXT,
    -- Timestamp
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_click_tracking_send ON marketing_click_tracking(send_id);
CREATE INDEX idx_click_tracking_campaign ON marketing_click_tracking(campaign_id);

-- ============================================
-- 6. AUTOMATIONS (Lifecycle Emails)
-- ============================================

CREATE TABLE marketing_automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Trigger configuration
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
        'user_signup',           -- New user registration
        'first_class_booked',    -- First booking ever
        'first_class_attended',  -- First check-in
        'membership_purchased',  -- New membership
        'membership_expiring',   -- X days before expiry
        'membership_expired',    -- On expiry date
        'credits_low',           -- Below threshold
        'inactive_days',         -- No visit for X days
        'birthday',              -- On birthday
        'class_attended',        -- After any class
        'workshop_attended',     -- After workshop
        'booking_cancelled',     -- Cancelled a booking
        'no_show',               -- Marked as no-show
        'tag_added',             -- When tag is added
        'custom_date',           -- Custom date field
        'manual'                 -- Manually triggered
    )),
    trigger_config JSONB DEFAULT '{}', -- e.g., {"days_before": 7} for membership_expiring
    -- Targeting (optional - narrows down who receives)
    segment_id UUID REFERENCES marketing_segments(id),
    -- Automation steps
    -- (Stored in marketing_automation_steps)
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    -- Stats
    total_enrolled INT DEFAULT 0,
    total_completed INT DEFAULT 0,
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE marketing_automation_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID REFERENCES marketing_automations(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    -- Step type
    step_type VARCHAR(30) NOT NULL CHECK (step_type IN (
        'send_email',
        'wait',
        'condition',
        'add_tag',
        'remove_tag',
        'update_field',
        'notify_staff',
        'enroll_in_automation'
    )),
    -- Configuration based on type
    config JSONB NOT NULL,
    -- For send_email: {"template_id": "uuid", "subject_override": "...", "custom_data": {...}}
    -- For wait: {"duration": 24, "unit": "hours"} or {"until": "specific_time", "time": "09:00"}
    -- For condition: {"field": "membership_status", "operator": "equals", "value": "active", "true_step": 3, "false_step": 5}
    -- For add_tag/remove_tag: {"tag": "engaged"}
    -- For notify_staff: {"emails": ["..."], "message": "..."}
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_automation_steps_automation ON marketing_automation_steps(automation_id, step_order);

-- ============================================
-- 7. AUTOMATION ENROLLMENTS
-- ============================================

CREATE TABLE marketing_automation_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID REFERENCES marketing_automations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    -- Progress
    current_step INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
        'active', 'completed', 'paused', 'exited', 'failed'
    )),
    -- Scheduling
    next_step_at TIMESTAMPTZ,
    -- Context data passed through automation
    context_data JSONB DEFAULT '{}',
    -- Timestamps
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    exited_at TIMESTAMPTZ,
    exit_reason TEXT,
    -- Prevent duplicate enrollments
    UNIQUE(automation_id, user_id)
);

CREATE INDEX idx_enrollments_automation ON marketing_automation_enrollments(automation_id);
CREATE INDEX idx_enrollments_user ON marketing_automation_enrollments(user_id);
CREATE INDEX idx_enrollments_next_step ON marketing_automation_enrollments(next_step_at) WHERE status = 'active';

-- ============================================
-- 8. AUTOMATION EXECUTION LOG
-- ============================================

CREATE TABLE marketing_automation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID REFERENCES marketing_automation_enrollments(id) ON DELETE CASCADE,
    step_id UUID REFERENCES marketing_automation_steps(id) ON DELETE SET NULL,
    -- Execution details
    step_type VARCHAR(30),
    status VARCHAR(20) CHECK (status IN ('success', 'failed', 'skipped')),
    result JSONB, -- Step-specific result data
    error_message TEXT,
    -- Timing
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INT
);

CREATE INDEX idx_automation_log_enrollment ON marketing_automation_log(enrollment_id);

-- ============================================
-- 9. SUBSCRIBER PREFERENCES
-- ============================================

-- Enhance existing notification_preferences or create marketing-specific
CREATE TABLE marketing_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    -- Global opt-out
    email_marketing_enabled BOOLEAN DEFAULT TRUE,
    sms_marketing_enabled BOOLEAN DEFAULT TRUE,
    -- Category preferences
    receive_newsletters BOOLEAN DEFAULT TRUE,
    receive_promotions BOOLEAN DEFAULT TRUE,
    receive_class_announcements BOOLEAN DEFAULT TRUE,
    receive_workshop_announcements BOOLEAN DEFAULT TRUE,
    receive_event_invitations BOOLEAN DEFAULT TRUE,
    -- Frequency
    max_emails_per_week INT DEFAULT 3,
    -- Unsubscribe tracking
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_reason TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create marketing preferences for users
CREATE OR REPLACE FUNCTION create_marketing_prefs()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO marketing_preferences (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_marketing_prefs
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_marketing_prefs();

-- ============================================
-- 10. A/B TESTING
-- ============================================

CREATE TABLE marketing_ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    -- Test type
    test_type VARCHAR(30) CHECK (test_type IN ('subject_line', 'content', 'send_time')),
    -- Variants
    variant_a JSONB NOT NULL, -- {"subject": "...", "content_override": "..."}
    variant_b JSONB NOT NULL,
    -- Distribution
    variant_a_percentage INT DEFAULT 50 CHECK (variant_a_percentage BETWEEN 1 AND 99),
    -- Winner selection
    winning_metric VARCHAR(30) DEFAULT 'open_rate' CHECK (winning_metric IN ('open_rate', 'click_rate')),
    auto_select_winner BOOLEAN DEFAULT TRUE,
    winner_selection_after_hours INT DEFAULT 24,
    -- Results
    winner VARCHAR(1), -- 'A' or 'B'
    variant_a_sent INT DEFAULT 0,
    variant_a_opened INT DEFAULT 0,
    variant_a_clicked INT DEFAULT 0,
    variant_b_sent INT DEFAULT 0,
    variant_b_opened INT DEFAULT 0,
    variant_b_clicked INT DEFAULT 0,
    -- Status
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'cancelled')),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 11. SUPPRESSION LIST
-- ============================================

CREATE TABLE marketing_suppression_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    reason VARCHAR(50) CHECK (reason IN (
        'unsubscribed', 'bounced', 'complained', 'manual', 'invalid'
    )),
    source VARCHAR(100), -- Where the suppression came from
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES users(id)
);

CREATE INDEX idx_suppression_email ON marketing_suppression_list(email);

-- ============================================
-- 12. VIEWS FOR REPORTING
-- ============================================

CREATE OR REPLACE VIEW marketing_campaign_stats AS
SELECT
    c.id,
    c.name,
    c.campaign_type,
    c.status,
    c.scheduled_for,
    c.sent_at,
    c.total_recipients,
    c.total_sent,
    c.total_delivered,
    c.total_opened,
    c.total_clicked,
    c.total_bounced,
    c.total_unsubscribed,
    CASE WHEN c.total_sent > 0
        THEN ROUND((c.total_delivered::DECIMAL / c.total_sent) * 100, 2)
        ELSE 0
    END as delivery_rate,
    CASE WHEN c.total_delivered > 0
        THEN ROUND((c.total_opened::DECIMAL / c.total_delivered) * 100, 2)
        ELSE 0
    END as open_rate,
    CASE WHEN c.total_opened > 0
        THEN ROUND((c.total_clicked::DECIMAL / c.total_opened) * 100, 2)
        ELSE 0
    END as click_rate,
    s.name as segment_name
FROM marketing_campaigns c
LEFT JOIN marketing_segments s ON c.segment_id = s.id;

CREATE OR REPLACE VIEW marketing_automation_stats AS
SELECT
    a.id,
    a.name,
    a.trigger_type,
    a.is_active,
    a.total_enrolled,
    a.total_completed,
    CASE WHEN a.total_enrolled > 0
        THEN ROUND((a.total_completed::DECIMAL / a.total_enrolled) * 100, 2)
        ELSE 0
    END as completion_rate,
    (SELECT COUNT(*) FROM marketing_automation_enrollments e WHERE e.automation_id = a.id AND e.status = 'active') as currently_active,
    (SELECT COUNT(*) FROM marketing_automation_steps s WHERE s.automation_id = a.id) as step_count
FROM marketing_automations a;

-- ============================================
-- 13. INSERT DEFAULT AUTOMATIONS
-- ============================================

-- Welcome Series Automation
INSERT INTO marketing_automations (name, description, trigger_type, trigger_config, is_active)
VALUES ('Welcome Series', 'Multi-step welcome sequence for new members', 'user_signup', '{}', true)
RETURNING id AS welcome_automation_id;

-- Get the template IDs for the steps
DO $$
DECLARE
    v_automation_id UUID;
    v_template_id UUID;
BEGIN
    -- Get welcome automation ID
    SELECT id INTO v_automation_id FROM marketing_automations WHERE name = 'Welcome Series';
    SELECT id INTO v_template_id FROM marketing_email_templates WHERE name = 'Welcome Series - Day 1';

    -- Step 1: Send welcome email immediately
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 1, 'send_email', jsonb_build_object('template_id', v_template_id));

    -- Step 2: Wait 2 days
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 2, 'wait', '{"duration": 2, "unit": "days"}');

    -- Step 3: Add "new-student" tag
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 3, 'add_tag', '{"tag": "new-student"}');
END $$;

-- Win-Back Automation
INSERT INTO marketing_automations (name, description, trigger_type, trigger_config, is_active)
VALUES ('Win-Back Campaign', 'Re-engage inactive members', 'inactive_days', '{"days": 30}', true)
RETURNING id AS winback_automation_id;

DO $$
DECLARE
    v_automation_id UUID;
    v_template_id UUID;
BEGIN
    SELECT id INTO v_automation_id FROM marketing_automations WHERE name = 'Win-Back Campaign';
    SELECT id INTO v_template_id FROM marketing_email_templates WHERE name = 'Win-Back Campaign';

    -- Step 1: Send win-back email
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 1, 'send_email', jsonb_build_object('template_id', v_template_id));

    -- Step 2: Add at-risk tag
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 2, 'add_tag', '{"tag": "at-risk"}');
END $$;

-- Membership Expiring Automation
INSERT INTO marketing_automations (name, description, trigger_type, trigger_config, is_active)
VALUES ('Membership Expiry Reminder', 'Remind members before membership expires', 'membership_expiring', '{"days_before": 7}', true);

DO $$
DECLARE
    v_automation_id UUID;
    v_template_id UUID;
BEGIN
    SELECT id INTO v_automation_id FROM marketing_automations WHERE name = 'Membership Expiry Reminder';
    SELECT id INTO v_template_id FROM marketing_email_templates WHERE name = 'Membership Expiring';

    -- Step 1: Send expiry reminder (7 days before)
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 1, 'send_email', jsonb_build_object('template_id', v_template_id));

    -- Step 2: Wait 4 days
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 2, 'wait', '{"duration": 4, "unit": "days"}');

    -- Step 3: Send second reminder (3 days before)
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 3, 'send_email', jsonb_build_object(
        'template_id', v_template_id,
        'subject_override', 'Only {{days_remaining}} days left on your membership!'
    ));
END $$;

-- Low Credits Automation
INSERT INTO marketing_automations (name, description, trigger_type, trigger_config, is_active)
VALUES ('Low Credits Alert', 'Notify members when credits are running low', 'credits_low', '{"threshold": 2}', true);

-- Workshop Follow-Up Automation
INSERT INTO marketing_automations (name, description, trigger_type, trigger_config, is_active)
VALUES ('Workshop Follow-Up', 'Follow up after workshop attendance', 'workshop_attended', '{}', true);

DO $$
DECLARE
    v_automation_id UUID;
    v_template_id UUID;
BEGIN
    SELECT id INTO v_automation_id FROM marketing_automations WHERE name = 'Workshop Follow-Up';
    SELECT id INTO v_template_id FROM marketing_email_templates WHERE name = 'Workshop Follow-Up';

    -- Step 1: Wait 1 day
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 1, 'wait', '{"duration": 1, "unit": "days"}');

    -- Step 2: Send follow-up email
    INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
    VALUES (v_automation_id, 2, 'send_email', jsonb_build_object('template_id', v_template_id));
END $$;

-- ============================================
-- 14. HELPER FUNCTIONS
-- ============================================

-- Function to check if user should receive marketing email
CREATE OR REPLACE FUNCTION can_receive_marketing_email(p_user_id UUID, p_category VARCHAR DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_email VARCHAR;
    v_suppressed BOOLEAN;
    v_prefs RECORD;
BEGIN
    -- Get user email
    SELECT email INTO v_email FROM users WHERE id = p_user_id AND is_active = true;
    IF v_email IS NULL THEN RETURN FALSE; END IF;

    -- Check suppression list
    SELECT EXISTS(SELECT 1 FROM marketing_suppression_list WHERE email = v_email) INTO v_suppressed;
    IF v_suppressed THEN RETURN FALSE; END IF;

    -- Check marketing preferences
    SELECT * INTO v_prefs FROM marketing_preferences WHERE user_id = p_user_id;
    IF v_prefs IS NULL THEN RETURN TRUE; END IF; -- Default to allowing if no prefs

    IF NOT v_prefs.email_marketing_enabled THEN RETURN FALSE; END IF;

    -- Check category-specific preferences
    IF p_category IS NOT NULL THEN
        CASE p_category
            WHEN 'newsletter' THEN RETURN v_prefs.receive_newsletters;
            WHEN 'promotion' THEN RETURN v_prefs.receive_promotions;
            WHEN 'class_announcement' THEN RETURN v_prefs.receive_class_announcements;
            WHEN 'workshop' THEN RETURN v_prefs.receive_workshop_announcements;
            WHEN 'event' THEN RETURN v_prefs.receive_event_invitations;
            ELSE RETURN TRUE;
        END CASE;
    END IF;

    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Update timestamps trigger
CREATE TRIGGER update_marketing_templates_timestamp
    BEFORE UPDATE ON marketing_email_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_marketing_segments_timestamp
    BEFORE UPDATE ON marketing_segments
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_marketing_campaigns_timestamp
    BEFORE UPDATE ON marketing_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_marketing_automations_timestamp
    BEFORE UPDATE ON marketing_automations
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_marketing_preferences_timestamp
    BEFORE UPDATE ON marketing_preferences
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();
