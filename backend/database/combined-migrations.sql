-- ============================================
-- COMBINED MIGRATIONS FOR RAILWAY
-- Run this entire file in Railway's Query editor
-- ============================================

-- ============================================
-- PART 1: MINDBODY API INTEGRATION
-- ============================================

CREATE TABLE IF NOT EXISTS mindbody_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id VARCHAR(50) NOT NULL UNIQUE,
    site_name VARCHAR(255),
    api_key VARCHAR(255) NOT NULL,
    staff_username VARCHAR(255),
    staff_password_encrypted TEXT,
    user_token TEXT,
    user_token_expires_at TIMESTAMPTZ,
    auto_sync_enabled BOOLEAN DEFAULT TRUE,
    sync_interval_minutes INT DEFAULT 15,
    last_full_sync TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mindbody_client_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_client_id VARCHAR(100) NOT NULL,
    studioflow_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    mb_first_name VARCHAR(255),
    mb_last_name VARCHAR(255),
    mb_email VARCHAR(255),
    mb_phone VARCHAR(50),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_direction VARCHAR(20) DEFAULT 'mb_to_sf' CHECK (sync_direction IN ('mb_to_sf', 'sf_to_mb', 'bidirectional')),
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_client_id)
);

CREATE INDEX IF NOT EXISTS idx_mb_client_map_user ON mindbody_client_map(studioflow_user_id);
CREATE INDEX IF NOT EXISTS idx_mb_client_map_email ON mindbody_client_map(mb_email);
CREATE INDEX IF NOT EXISTS idx_mb_client_map_status ON mindbody_client_map(sync_status);

CREATE TABLE IF NOT EXISTS mindbody_staff_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_staff_id VARCHAR(100) NOT NULL,
    studioflow_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    studioflow_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    mb_first_name VARCHAR(255),
    mb_last_name VARCHAR(255),
    mb_email VARCHAR(255),
    mb_is_male BOOLEAN,
    mb_bio TEXT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_staff_id)
);

CREATE INDEX IF NOT EXISTS idx_mb_staff_map_teacher ON mindbody_staff_map(studioflow_teacher_id);

CREATE TABLE IF NOT EXISTS mindbody_class_type_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_class_description_id VARCHAR(100) NOT NULL,
    studioflow_class_type_id UUID REFERENCES class_types(id) ON DELETE SET NULL,
    mb_name VARCHAR(255),
    mb_description TEXT,
    mb_duration INT,
    mb_category VARCHAR(100),
    mb_subcategory VARCHAR(100),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_class_description_id)
);

CREATE INDEX IF NOT EXISTS idx_mb_class_type_map ON mindbody_class_type_map(studioflow_class_type_id);

CREATE TABLE IF NOT EXISTS mindbody_class_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_class_id VARCHAR(100) NOT NULL,
    mindbody_class_schedule_id VARCHAR(100),
    studioflow_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    mb_start_datetime TIMESTAMPTZ,
    mb_end_datetime TIMESTAMPTZ,
    mb_staff_id VARCHAR(100),
    mb_location_id VARCHAR(100),
    mb_class_description_id VARCHAR(100),
    mb_is_cancelled BOOLEAN DEFAULT FALSE,
    mb_max_capacity INT,
    mb_total_booked INT,
    mb_waitlist_size INT,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_class_id)
);

CREATE INDEX IF NOT EXISTS idx_mb_class_map_class ON mindbody_class_map(studioflow_class_id);
CREATE INDEX IF NOT EXISTS idx_mb_class_map_date ON mindbody_class_map(mb_start_datetime);

CREATE TABLE IF NOT EXISTS mindbody_location_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_location_id VARCHAR(100) NOT NULL,
    studioflow_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    mb_name VARCHAR(255),
    mb_address VARCHAR(255),
    mb_city VARCHAR(100),
    mb_state VARCHAR(50),
    mb_postal_code VARCHAR(20),
    mb_phone VARCHAR(50),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_location_id)
);

CREATE INDEX IF NOT EXISTS idx_mb_location_map ON mindbody_location_map(studioflow_location_id);

CREATE TABLE IF NOT EXISTS mindbody_booking_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_visit_id VARCHAR(100) NOT NULL,
    studioflow_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    mb_class_id VARCHAR(100),
    mb_client_id VARCHAR(100),
    mb_service_id VARCHAR(100),
    mb_signed_in BOOLEAN DEFAULT FALSE,
    mb_make_up BOOLEAN DEFAULT FALSE,
    mb_late_cancelled BOOLEAN DEFAULT FALSE,
    mb_last_modified TIMESTAMPTZ,
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_visit_id)
);

CREATE INDEX IF NOT EXISTS idx_mb_booking_map_booking ON mindbody_booking_map(studioflow_booking_id);
CREATE INDEX IF NOT EXISTS idx_mb_booking_map_class ON mindbody_booking_map(mb_class_id);

CREATE TABLE IF NOT EXISTS mindbody_membership_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_client_contract_id VARCHAR(100) NOT NULL,
    mindbody_contract_id VARCHAR(100),
    studioflow_user_membership_id UUID REFERENCES user_memberships(id) ON DELETE SET NULL,
    mb_client_id VARCHAR(100),
    mb_contract_name VARCHAR(255),
    mb_start_date DATE,
    mb_end_date DATE,
    mb_remaining_count INT,
    mb_is_auto_renewing BOOLEAN,
    mb_status VARCHAR(50),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_client_contract_id)
);

CREATE INDEX IF NOT EXISTS idx_mb_membership_map ON mindbody_membership_map(studioflow_user_membership_id);

CREATE TABLE IF NOT EXISTS mindbody_service_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_service_id VARCHAR(100) NOT NULL,
    studioflow_membership_type_id UUID REFERENCES membership_types(id) ON DELETE SET NULL,
    mb_name VARCHAR(255),
    mb_price DECIMAL(10,2),
    mb_count INT,
    mb_program_id VARCHAR(100),
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_service_id)
);

CREATE TABLE IF NOT EXISTS mindbody_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id VARCHAR(50) NOT NULL,
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN (
        'full', 'incremental', 'classes', 'clients', 'staff',
        'bookings', 'memberships', 'locations', 'services', 'webhook'
    )),
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    records_fetched INT DEFAULT 0,
    records_created INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    records_skipped INT DEFAULT 0,
    records_error INT DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    api_calls_made INT DEFAULT 0,
    errors JSONB DEFAULT '[]',
    triggered_by VARCHAR(50) DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'scheduled', 'webhook', 'api')),
    triggered_by_user UUID REFERENCES users(id),
    summary JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_mb_sync_log_site ON mindbody_sync_log(site_id);
CREATE INDEX IF NOT EXISTS idx_mb_sync_log_type ON mindbody_sync_log(sync_type);
CREATE INDEX IF NOT EXISTS idx_mb_sync_log_date ON mindbody_sync_log(started_at DESC);

CREATE TABLE IF NOT EXISTS mindbody_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    site_id VARCHAR(50),
    payload JSONB NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
    processed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INT DEFAULT 0,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mb_webhook_status ON mindbody_webhook_events(status);
CREATE INDEX IF NOT EXISTS idx_mb_webhook_type ON mindbody_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_mb_webhook_date ON mindbody_webhook_events(received_at DESC);

CREATE TABLE IF NOT EXISTS mindbody_sync_queue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id VARCHAR(50) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    action VARCHAR(20) NOT NULL CHECK (action IN ('create', 'update', 'delete', 'sync')),
    priority INT DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
    payload JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    attempts INT DEFAULT 0,
    max_attempts INT DEFAULT 3,
    last_error TEXT,
    scheduled_for TIMESTAMPTZ DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mb_queue_pending ON mindbody_sync_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_mb_queue_status ON mindbody_sync_queue(status);

-- MindBody helper functions
CREATE OR REPLACE FUNCTION get_user_from_mb_client(p_site_id VARCHAR, p_mb_client_id VARCHAR)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT studioflow_user_id INTO v_user_id
    FROM mindbody_client_map
    WHERE mindbody_site_id = p_site_id AND mindbody_client_id = p_mb_client_id;
    RETURN v_user_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_class_from_mb_class(p_site_id VARCHAR, p_mb_class_id VARCHAR)
RETURNS UUID AS $$
DECLARE
    v_class_id UUID;
BEGIN
    SELECT studioflow_class_id INTO v_class_id
    FROM mindbody_class_map
    WHERE mindbody_site_id = p_site_id AND mindbody_class_id = p_mb_class_id;
    RETURN v_class_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_mb_client_from_user(p_site_id VARCHAR, p_user_id UUID)
RETURNS VARCHAR AS $$
DECLARE
    v_mb_client_id VARCHAR;
BEGIN
    SELECT mindbody_client_id INTO v_mb_client_id
    FROM mindbody_client_map
    WHERE mindbody_site_id = p_site_id AND studioflow_user_id = p_user_id;
    RETURN v_mb_client_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW mindbody_sync_status AS
SELECT
    mc.site_id,
    mc.site_name,
    mc.is_active,
    mc.auto_sync_enabled,
    mc.last_full_sync,
    (SELECT COUNT(*) FROM mindbody_client_map WHERE mindbody_site_id = mc.site_id AND sync_status = 'synced') as clients_synced,
    (SELECT COUNT(*) FROM mindbody_client_map WHERE mindbody_site_id = mc.site_id AND sync_status = 'error') as clients_error,
    (SELECT COUNT(*) FROM mindbody_staff_map WHERE mindbody_site_id = mc.site_id AND sync_status = 'synced') as staff_synced,
    (SELECT COUNT(*) FROM mindbody_class_map WHERE mindbody_site_id = mc.site_id AND sync_status = 'synced') as classes_synced,
    (SELECT COUNT(*) FROM mindbody_booking_map WHERE mindbody_site_id = mc.site_id AND sync_status = 'synced') as bookings_synced,
    (SELECT MAX(started_at) FROM mindbody_sync_log WHERE site_id = mc.site_id) as last_sync_attempt,
    (SELECT status FROM mindbody_sync_log WHERE site_id = mc.site_id ORDER BY started_at DESC LIMIT 1) as last_sync_status
FROM mindbody_config mc;

INSERT INTO settings (key, value, description)
VALUES ('mindbody', '{
    "enabled": false,
    "sync_schedule": "0 3 * * *",
    "sync_days_ahead": 14,
    "sync_days_back": 7,
    "create_missing_users": true,
    "create_missing_classes": true,
    "update_existing": true,
    "primary_system": "mindbody"
}', 'MindBody API integration settings')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- PART 2: MARKETING AUTOMATION
-- ============================================

DROP TABLE IF EXISTS marketing_email_templates CASCADE;

CREATE TABLE marketing_email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    subject VARCHAR(255) NOT NULL,
    preview_text VARCHAR(255),
    body_html TEXT NOT NULL,
    body_text TEXT,
    template_type VARCHAR(30) DEFAULT 'marketing' CHECK (template_type IN (
        'marketing', 'transactional', 'automation', 'newsletter'
    )),
    header_image_url TEXT,
    footer_html TEXT,
    available_tokens TEXT[] DEFAULT ARRAY['first_name', 'last_name', 'email'],
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO marketing_email_templates (name, subject, preview_text, body_html, template_type, available_tokens) VALUES
('Welcome Series - Day 1', 'Welcome to The Studio Reno, {{first_name}}!', 'Your yoga journey starts here',
'<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2d3748;">Welcome, {{first_name}}!</h1>
<p>We''re so excited to have you join our community at The Studio Reno.</p>
<a href="{{booking_url}}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">View Schedule</a>
</div>', 'automation', ARRAY['first_name', 'last_name', 'booking_url']),

('Win-Back Campaign', 'We miss you, {{first_name}}!', 'It''s been a while - come back to your practice',
'<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2d3748;">We Miss You, {{first_name}}!</h1>
<p>It''s been {{days_since_visit}} days since your last class.</p>
<a href="{{booking_url}}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Book a Class</a>
</div>', 'automation', ARRAY['first_name', 'days_since_visit', 'booking_url']),

('Membership Expiring', 'Your membership expires in {{days_remaining}} days', 'Don''t lose your unlimited access',
'<div style="font-family: Georgia, serif; max-width: 600px; margin: 0 auto;">
<h1 style="color: #2d3748;">Your Membership is Expiring Soon</h1>
<p>Hi {{first_name}}, your {{membership_name}} expires in {{days_remaining}} days.</p>
<a href="{{renew_url}}" style="display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px;">Renew Membership</a>
</div>', 'automation', ARRAY['first_name', 'membership_name', 'days_remaining', 'renew_url']);

CREATE TABLE IF NOT EXISTS marketing_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    rules JSONB NOT NULL DEFAULT '{"conditions": [], "match": "all"}',
    member_count INT DEFAULT 0,
    last_calculated_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    is_system BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO marketing_segments (name, description, rules, is_system) VALUES
('All Active Members', 'Users with active memberships',
'{"match": "all", "conditions": [{"field": "membership_status", "operator": "equals", "value": "active"}]}', true),
('New Students (30 days)', 'Users who signed up in the last 30 days',
'{"match": "all", "conditions": [{"field": "created_at", "operator": "within_days", "value": 30}]}', true),
('Lapsed Members', 'Members who haven''t visited in 30+ days',
'{"match": "all", "conditions": [{"field": "last_visit", "operator": "more_than_days_ago", "value": 30}]}', true)
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS marketing_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    campaign_type VARCHAR(30) DEFAULT 'one_time' CHECK (campaign_type IN (
        'one_time', 'recurring', 'automated', 'ab_test'
    )),
    template_id UUID REFERENCES marketing_email_templates(id),
    subject_line VARCHAR(255),
    preview_text VARCHAR(255),
    custom_html TEXT,
    segment_id UUID REFERENCES marketing_segments(id),
    recipient_list UUID[],
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
    )),
    scheduled_for TIMESTAMPTZ,
    send_at_user_timezone BOOLEAN DEFAULT FALSE,
    recurring_schedule VARCHAR(50),
    recurring_until DATE,
    total_recipients INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    total_opened INT DEFAULT 0,
    total_clicked INT DEFAULT 0,
    total_unsubscribed INT DEFAULT 0,
    total_bounced INT DEFAULT 0,
    created_by UUID REFERENCES users(id),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaigns_status ON marketing_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_scheduled ON marketing_campaigns(scheduled_for) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS marketing_campaign_sends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(200),
    personalization_data JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed'
    )),
    provider_message_id VARCHAR(255),
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    opened_at TIMESTAMPTZ,
    first_clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    bounce_reason TEXT,
    click_count INT DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_sends_campaign ON marketing_campaign_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_user ON marketing_campaign_sends(user_id);
CREATE INDEX IF NOT EXISTS idx_campaign_sends_status ON marketing_campaign_sends(status);

CREATE TABLE IF NOT EXISTS marketing_click_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    send_id UUID REFERENCES marketing_campaign_sends(id) ON DELETE CASCADE,
    campaign_id UUID REFERENCES marketing_campaigns(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    original_url TEXT NOT NULL,
    link_name VARCHAR(100),
    ip_address INET,
    user_agent TEXT,
    clicked_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_click_tracking_send ON marketing_click_tracking(send_id);
CREATE INDEX IF NOT EXISTS idx_click_tracking_campaign ON marketing_click_tracking(campaign_id);

CREATE TABLE IF NOT EXISTS marketing_automations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
        'user_signup', 'first_class_booked', 'first_class_attended',
        'membership_purchased', 'membership_expiring', 'membership_expired',
        'credits_low', 'inactive_days', 'birthday', 'class_attended',
        'workshop_attended', 'booking_cancelled', 'no_show', 'tag_added',
        'custom_date', 'manual'
    )),
    trigger_config JSONB DEFAULT '{}',
    segment_id UUID REFERENCES marketing_segments(id),
    is_active BOOLEAN DEFAULT TRUE,
    total_enrolled INT DEFAULT 0,
    total_completed INT DEFAULT 0,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_automation_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID REFERENCES marketing_automations(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    step_type VARCHAR(30) NOT NULL CHECK (step_type IN (
        'send_email', 'wait', 'condition', 'add_tag', 'remove_tag',
        'update_field', 'notify_staff', 'enroll_in_automation'
    )),
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_automation_steps_automation ON marketing_automation_steps(automation_id, step_order);

CREATE TABLE IF NOT EXISTS marketing_automation_enrollments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    automation_id UUID REFERENCES marketing_automations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    current_step INT DEFAULT 0,
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
        'active', 'completed', 'paused', 'exited', 'failed'
    )),
    next_step_at TIMESTAMPTZ,
    context_data JSONB DEFAULT '{}',
    enrolled_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    exited_at TIMESTAMPTZ,
    exit_reason TEXT,
    UNIQUE(automation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_automation ON marketing_automation_enrollments(automation_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_user ON marketing_automation_enrollments(user_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_next_step ON marketing_automation_enrollments(next_step_at) WHERE status = 'active';

CREATE TABLE IF NOT EXISTS marketing_automation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    enrollment_id UUID REFERENCES marketing_automation_enrollments(id) ON DELETE CASCADE,
    step_id UUID REFERENCES marketing_automation_steps(id) ON DELETE SET NULL,
    step_type VARCHAR(30),
    status VARCHAR(20) CHECK (status IN ('success', 'failed', 'skipped')),
    result JSONB,
    error_message TEXT,
    executed_at TIMESTAMPTZ DEFAULT NOW(),
    duration_ms INT
);

CREATE INDEX IF NOT EXISTS idx_automation_log_enrollment ON marketing_automation_log(enrollment_id);

CREATE TABLE IF NOT EXISTS marketing_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    email_marketing_enabled BOOLEAN DEFAULT TRUE,
    sms_marketing_enabled BOOLEAN DEFAULT TRUE,
    receive_newsletters BOOLEAN DEFAULT TRUE,
    receive_promotions BOOLEAN DEFAULT TRUE,
    receive_class_announcements BOOLEAN DEFAULT TRUE,
    receive_workshop_announcements BOOLEAN DEFAULT TRUE,
    receive_event_invitations BOOLEAN DEFAULT TRUE,
    max_emails_per_week INT DEFAULT 3,
    unsubscribed_at TIMESTAMPTZ,
    unsubscribe_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_suppression_list (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    reason VARCHAR(50) CHECK (reason IN (
        'unsubscribed', 'bounced', 'complained', 'manual', 'invalid'
    )),
    source VARCHAR(100),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    added_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_suppression_email ON marketing_suppression_list(email);

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

CREATE OR REPLACE FUNCTION can_receive_marketing_email(p_user_id UUID, p_category VARCHAR DEFAULT NULL)
RETURNS BOOLEAN AS $$
DECLARE
    v_email VARCHAR;
    v_suppressed BOOLEAN;
    v_prefs RECORD;
BEGIN
    SELECT email INTO v_email FROM users WHERE id = p_user_id AND is_active = true;
    IF v_email IS NULL THEN RETURN FALSE; END IF;
    SELECT EXISTS(SELECT 1 FROM marketing_suppression_list WHERE email = v_email) INTO v_suppressed;
    IF v_suppressed THEN RETURN FALSE; END IF;
    SELECT * INTO v_prefs FROM marketing_preferences WHERE user_id = p_user_id;
    IF v_prefs IS NULL THEN RETURN TRUE; END IF;
    IF NOT v_prefs.email_marketing_enabled THEN RETURN FALSE; END IF;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- PART 3: SUBSCRIBER MANAGEMENT & SMS
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email_opted_in BOOLEAN DEFAULT FALSE,
    email_opt_in_date TIMESTAMPTZ,
    email_opt_in_source VARCHAR(100),
    email_opt_in_ip INET,
    email_double_opt_in BOOLEAN DEFAULT FALSE,
    email_double_opt_in_date TIMESTAMPTZ,
    sms_opted_in BOOLEAN DEFAULT FALSE,
    sms_opt_in_date TIMESTAMPTZ,
    sms_opt_in_source VARCHAR(100),
    sms_opt_in_keyword VARCHAR(50),
    sms_consent_text TEXT,
    email_opted_out BOOLEAN DEFAULT FALSE,
    email_opt_out_date TIMESTAMPTZ,
    email_opt_out_reason TEXT,
    sms_opted_out BOOLEAN DEFAULT FALSE,
    sms_opt_out_date TIMESTAMPTZ,
    sms_opt_out_reason TEXT,
    preferred_channel VARCHAR(10) DEFAULT 'email' CHECK (preferred_channel IN ('email', 'sms', 'both')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained', 'cleaned')),
    imported_from VARCHAR(100),
    imported_at TIMESTAMPTZ,
    external_id VARCHAR(255),
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_email ON marketing_subscribers(LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_subscribers_phone ON marketing_subscribers(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subscribers_user ON marketing_subscribers(user_id);
CREATE INDEX IF NOT EXISTS idx_subscribers_email_optin ON marketing_subscribers(email_opted_in) WHERE email_opted_in = true;
CREATE INDEX IF NOT EXISTS idx_subscribers_sms_optin ON marketing_subscribers(sms_opted_in) WHERE sms_opted_in = true;

CREATE TABLE IF NOT EXISTS marketing_consent_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscriber_id UUID REFERENCES marketing_subscribers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'sms')),
    action VARCHAR(20) NOT NULL CHECK (action IN ('opt_in', 'opt_out', 'double_opt_in', 'resubscribe')),
    source VARCHAR(100),
    consent_text TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_log_subscriber ON marketing_consent_log(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_consent_log_date ON marketing_consent_log(created_at);

CREATE TABLE IF NOT EXISTS marketing_sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    message TEXT NOT NULL,
    char_count INT GENERATED ALWAYS AS (LENGTH(message)) STORED,
    segment_count INT GENERATED ALWAYS AS (CEIL(LENGTH(message)::DECIMAL / 160)) STORED,
    available_tokens TEXT[] DEFAULT ARRAY['first_name'],
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO marketing_sms_templates (name, message, available_tokens) VALUES
('Class Reminder', 'Hi {{first_name}}! Reminder: {{class_name}} tomorrow at {{class_time}}. See you at The Studio! Reply STOP to opt out.', ARRAY['first_name', 'class_name', 'class_time']),
('Welcome SMS', 'Welcome to The Studio Reno, {{first_name}}! Book your first class at thestudioreno.com. Reply STOP to opt out.', ARRAY['first_name']),
('Win-Back SMS', 'Hey {{first_name}}, we miss you! Come back to The Studio - use code MISSYOU for 15% off. thestudioreno.com Reply STOP to opt out.', ARRAY['first_name'])
ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS marketing_sms_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    template_id UUID REFERENCES marketing_sms_templates(id),
    message TEXT,
    segment_id UUID REFERENCES marketing_segments(id),
    recipient_list UUID[],
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
    )),
    scheduled_for TIMESTAMPTZ,
    is_promotional BOOLEAN DEFAULT TRUE,
    total_recipients INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    total_opted_out INT DEFAULT 0,
    estimated_segments INT DEFAULT 0,
    actual_segments INT DEFAULT 0,
    created_by UUID REFERENCES users(id),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_campaigns_status ON marketing_sms_campaigns(status);

CREATE TABLE IF NOT EXISTS marketing_sms_sends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES marketing_sms_campaigns(id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    phone VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    segment_count INT DEFAULT 1,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'failed', 'undelivered', 'opted_out'
    )),
    twilio_sid VARCHAR(50),
    twilio_status VARCHAR(30),
    error_code VARCHAR(20),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_sends_campaign ON marketing_sms_sends(campaign_id);
CREATE INDEX IF NOT EXISTS idx_sms_sends_phone ON marketing_sms_sends(phone);

CREATE TABLE IF NOT EXISTS marketing_sms_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_phone VARCHAR(20) NOT NULL,
    message_body TEXT NOT NULL,
    intent VARCHAR(30),
    twilio_sid VARCHAR(50),
    twilio_status VARCHAR(30),
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    response_sent BOOLEAN DEFAULT FALSE,
    response_message TEXT,
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sms_replies_phone ON marketing_sms_replies(from_phone);
CREATE INDEX IF NOT EXISTS idx_sms_replies_received ON marketing_sms_replies(received_at);

CREATE TABLE IF NOT EXISTS marketing_consent_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscriber_id UUID REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
    subscriber_email VARCHAR(255),
    subscriber_phone VARCHAR(20),
    action VARCHAR(30) NOT NULL,
    source VARCHAR(100),
    consent_text TEXT,
    message_content TEXT,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_consent_audit_subscriber ON marketing_consent_audit_log(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_consent_audit_phone ON marketing_consent_audit_log(subscriber_phone);
CREATE INDEX IF NOT EXISTS idx_consent_audit_date ON marketing_consent_audit_log(created_at);

CREATE TABLE IF NOT EXISTS marketing_import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL,
    import_type VARCHAR(30) DEFAULT 'subscribers' CHECK (import_type IN (
        'subscribers', 'email_list', 'sms_list', 'full_sync'
    )),
    filename VARCHAR(255),
    file_url TEXT,
    field_mapping JSONB DEFAULT '{}',
    options JSONB DEFAULT '{}',
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled'
    )),
    total_records INT DEFAULT 0,
    processed_records INT DEFAULT 0,
    created_records INT DEFAULT 0,
    updated_records INT DEFAULT 0,
    skipped_records INT DEFAULT 0,
    failed_records INT DEFAULT 0,
    errors JSONB DEFAULT '[]',
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marketing_import_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_job_id UUID REFERENCES marketing_import_jobs(id) ON DELETE CASCADE,
    row_number INT,
    original_data JSONB NOT NULL,
    status VARCHAR(20) CHECK (status IN ('created', 'updated', 'skipped', 'failed')),
    subscriber_id UUID REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_import_records_job ON marketing_import_records(import_job_id);

-- Add SMS preferences to marketing_preferences
ALTER TABLE marketing_preferences
ADD COLUMN IF NOT EXISTS receive_sms_promotions BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS receive_sms_reminders BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS max_sms_per_week INT DEFAULT 2,
ADD COLUMN IF NOT EXISTS sms_opt_in_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sms_opt_in_source VARCHAR(100);

-- Helper functions
CREATE OR REPLACE FUNCTION get_or_create_subscriber(
    p_user_id UUID,
    p_email VARCHAR DEFAULT NULL,
    p_phone VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_subscriber_id UUID;
    v_user RECORD;
BEGIN
    SELECT id INTO v_subscriber_id FROM marketing_subscribers WHERE user_id = p_user_id;
    IF v_subscriber_id IS NOT NULL THEN RETURN v_subscriber_id; END IF;
    SELECT * INTO v_user FROM users WHERE id = p_user_id;
    SELECT id INTO v_subscriber_id FROM marketing_subscribers
    WHERE (email = COALESCE(p_email, v_user.email) AND email IS NOT NULL)
       OR (phone = COALESCE(p_phone, v_user.phone) AND phone IS NOT NULL);
    IF v_subscriber_id IS NOT NULL THEN
        UPDATE marketing_subscribers SET user_id = p_user_id WHERE id = v_subscriber_id;
        RETURN v_subscriber_id;
    END IF;
    INSERT INTO marketing_subscribers (user_id, email, phone, first_name, last_name, email_opted_in, email_opt_in_date, email_opt_in_source)
    VALUES (p_user_id, COALESCE(p_email, v_user.email), COALESCE(p_phone, v_user.phone), v_user.first_name, v_user.last_name, TRUE, NOW(), 'account_creation')
    RETURNING id INTO v_subscriber_id;
    RETURN v_subscriber_id;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION can_receive_sms(p_phone VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_opted_in BOOLEAN;
BEGIN
    SELECT sms_opted_in AND NOT sms_opted_out INTO v_opted_in
    FROM marketing_subscribers WHERE phone = p_phone;
    RETURN COALESCE(v_opted_in, FALSE);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION format_phone_e164(p_phone VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    v_digits VARCHAR;
BEGIN
    v_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');
    IF LENGTH(v_digits) = 10 THEN v_digits := '1' || v_digits; END IF;
    IF NOT v_digits LIKE '+%' THEN v_digits := '+' || v_digits; END IF;
    RETURN v_digits;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE VIEW marketing_subscriber_stats AS
SELECT
    COUNT(*) as total_subscribers,
    COUNT(*) FILTER (WHERE email_opted_in AND NOT email_opted_out) as email_subscribers,
    COUNT(*) FILTER (WHERE sms_opted_in AND NOT sms_opted_out) as sms_subscribers,
    COUNT(*) FILTER (WHERE email_opted_in AND sms_opted_in AND NOT email_opted_out AND NOT sms_opted_out) as both_channels,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) as linked_to_users,
    COUNT(*) FILTER (WHERE status = 'active') as active
FROM marketing_subscribers;

CREATE OR REPLACE VIEW marketing_sms_campaign_stats AS
SELECT
    c.id,
    c.name,
    c.status,
    c.scheduled_for,
    c.sent_at,
    c.total_recipients,
    c.total_sent,
    c.total_delivered,
    c.total_failed,
    c.total_opted_out,
    CASE WHEN c.total_sent > 0
        THEN ROUND((c.total_delivered::DECIMAL / c.total_sent) * 100, 2)
        ELSE 0
    END as delivery_rate,
    s.name as segment_name
FROM marketing_sms_campaigns c
LEFT JOIN marketing_segments s ON c.segment_id = s.id;

-- ============================================
-- DONE! All migrations complete.
-- ============================================
