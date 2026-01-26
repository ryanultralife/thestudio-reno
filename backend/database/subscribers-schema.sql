-- ============================================
-- SUBSCRIBER MANAGEMENT SCHEMA
-- Opt-in tracking, SMS campaigns, and imports
-- ============================================

-- ============================================
-- 1. SUBSCRIBER LIST (Website signups without accounts)
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- Contact info
    email VARCHAR(255),
    phone VARCHAR(20),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    -- Linked user (if they have an account)
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Email opt-in
    email_opted_in BOOLEAN DEFAULT FALSE,
    email_opt_in_date TIMESTAMPTZ,
    email_opt_in_source VARCHAR(100), -- 'website_popup', 'checkout', 'mindbody', 'import', etc.
    email_opt_in_ip INET,
    email_double_opt_in BOOLEAN DEFAULT FALSE,
    email_double_opt_in_date TIMESTAMPTZ,
    -- SMS opt-in (TCPA compliance)
    sms_opted_in BOOLEAN DEFAULT FALSE,
    sms_opt_in_date TIMESTAMPTZ,
    sms_opt_in_source VARCHAR(100),
    sms_opt_in_keyword VARCHAR(50), -- 'YOGA', 'JOIN', etc.
    sms_consent_text TEXT, -- The exact consent language they agreed to
    -- Opt-out tracking
    email_opted_out BOOLEAN DEFAULT FALSE,
    email_opt_out_date TIMESTAMPTZ,
    email_opt_out_reason TEXT,
    sms_opted_out BOOLEAN DEFAULT FALSE,
    sms_opt_out_date TIMESTAMPTZ,
    sms_opt_out_reason TEXT,
    -- Preferences
    preferred_channel VARCHAR(10) DEFAULT 'email' CHECK (preferred_channel IN ('email', 'sms', 'both')),
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'unsubscribed', 'bounced', 'complained', 'cleaned')),
    -- Import tracking
    imported_from VARCHAR(100),
    imported_at TIMESTAMPTZ,
    external_id VARCHAR(255), -- ID from source system (MindBody, etc.)
    -- Metadata
    tags TEXT[] DEFAULT '{}',
    custom_fields JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_subscribers_email ON marketing_subscribers(LOWER(email)) WHERE email IS NOT NULL;
CREATE UNIQUE INDEX idx_subscribers_phone ON marketing_subscribers(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_subscribers_user ON marketing_subscribers(user_id);
CREATE INDEX idx_subscribers_email_optin ON marketing_subscribers(email_opted_in) WHERE email_opted_in = true;
CREATE INDEX idx_subscribers_sms_optin ON marketing_subscribers(sms_opted_in) WHERE sms_opted_in = true;

-- ============================================
-- 2. OPT-IN AUDIT LOG (Compliance)
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_consent_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscriber_id UUID REFERENCES marketing_subscribers(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- What changed
    channel VARCHAR(10) NOT NULL CHECK (channel IN ('email', 'sms')),
    action VARCHAR(20) NOT NULL CHECK (action IN ('opt_in', 'opt_out', 'double_opt_in', 'resubscribe')),
    -- Context
    source VARCHAR(100), -- Where they opted in/out
    consent_text TEXT, -- The exact language they agreed to (for TCPA)
    ip_address INET,
    user_agent TEXT,
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consent_log_subscriber ON marketing_consent_log(subscriber_id);
CREATE INDEX idx_consent_log_date ON marketing_consent_log(created_at);

-- ============================================
-- 3. SMS TEMPLATES
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_sms_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Content (160 char limit per segment)
    message TEXT NOT NULL,
    -- Character count (for segment estimation)
    char_count INT GENERATED ALWAYS AS (LENGTH(message)) STORED,
    segment_count INT GENERATED ALWAYS AS (CEIL(LENGTH(message)::DECIMAL / 160)) STORED,
    -- Personalization tokens
    available_tokens TEXT[] DEFAULT ARRAY['first_name'],
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default SMS templates
INSERT INTO marketing_sms_templates (name, message, available_tokens) VALUES
('Class Reminder', 'Hi {{first_name}}! Reminder: {{class_name}} tomorrow at {{class_time}}. See you at The Studio! Reply STOP to opt out.', ARRAY['first_name', 'class_name', 'class_time']),
('Welcome SMS', 'Welcome to The Studio Reno, {{first_name}}! Book your first class at thestudioreno.com. Reply STOP to opt out.', ARRAY['first_name']),
('Win-Back SMS', 'Hey {{first_name}}, we miss you! Come back to The Studio - use code MISSYOU for 15% off. thestudioreno.com Reply STOP to opt out.', ARRAY['first_name']),
('Membership Expiring SMS', '{{first_name}}, your Studio membership expires in {{days}} days! Renew now to keep your practice going. thestudioreno.com/renew Reply STOP to opt out.', ARRAY['first_name', 'days']),
('Flash Sale SMS', '24HR FLASH SALE! {{offer_details}} Book now: thestudioreno.com Reply STOP to opt out.', ARRAY['offer_details']),
('New Class Alert SMS', 'NEW CLASS: {{class_name}} with {{teacher}} - {{schedule}}. Spots are limited! Book: thestudioreno.com Reply STOP to opt out.', ARRAY['class_name', 'teacher', 'schedule']);

-- ============================================
-- 4. SMS CAMPAIGNS
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_sms_campaigns (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Content
    template_id UUID REFERENCES marketing_sms_templates(id),
    message TEXT, -- Custom message (if not using template)
    -- Targeting
    segment_id UUID REFERENCES marketing_segments(id),
    recipient_list UUID[], -- Manual list of subscriber IDs
    -- Scheduling
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN (
        'draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled'
    )),
    scheduled_for TIMESTAMPTZ,
    -- Stats
    total_recipients INT DEFAULT 0,
    total_sent INT DEFAULT 0,
    total_delivered INT DEFAULT 0,
    total_failed INT DEFAULT 0,
    total_opted_out INT DEFAULT 0,
    -- Cost tracking (Twilio charges per segment)
    estimated_segments INT DEFAULT 0,
    actual_segments INT DEFAULT 0,
    -- Metadata
    created_by UUID REFERENCES users(id),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_campaigns_status ON marketing_sms_campaigns(status);

-- ============================================
-- 5. SMS CAMPAIGN SENDS
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_sms_sends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    campaign_id UUID REFERENCES marketing_sms_campaigns(id) ON DELETE CASCADE,
    subscriber_id UUID REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- Recipient
    phone VARCHAR(20) NOT NULL,
    -- Message sent
    message_content TEXT NOT NULL,
    segment_count INT DEFAULT 1,
    -- Status
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'sent', 'delivered', 'failed', 'undelivered', 'opted_out'
    )),
    -- Twilio tracking
    twilio_sid VARCHAR(50),
    twilio_status VARCHAR(30),
    error_code VARCHAR(20),
    error_message TEXT,
    -- Timestamps
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_sends_campaign ON marketing_sms_sends(campaign_id);
CREATE INDEX idx_sms_sends_phone ON marketing_sms_sends(phone);

-- ============================================
-- 5b. SMS REPLIES (Incoming messages)
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_sms_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_phone VARCHAR(20) NOT NULL,
    message_body TEXT NOT NULL,
    -- Parsed intent
    intent VARCHAR(30), -- 'opt_out', 'opt_in', 'help', 'unknown'
    -- Twilio metadata
    twilio_sid VARCHAR(50),
    twilio_status VARCHAR(30),
    -- Processing
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    -- Response sent
    response_sent BOOLEAN DEFAULT FALSE,
    response_message TEXT,
    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sms_replies_phone ON marketing_sms_replies(from_phone);
CREATE INDEX idx_sms_replies_received ON marketing_sms_replies(received_at);

-- ============================================
-- 5c. CONSENT AUDIT LOG (TCPA Compliance)
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_consent_audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    subscriber_id UUID REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
    subscriber_email VARCHAR(255),
    subscriber_phone VARCHAR(20),
    -- Action
    action VARCHAR(30) NOT NULL, -- 'email_opt_in', 'email_opt_out', 'sms_opt_in', 'sms_opt_out', 'double_opt_in'
    source VARCHAR(100), -- 'website', 'sms_reply', 'mindbody_import', 'api', etc.
    -- Consent details
    consent_text TEXT, -- Exact language agreed to
    message_content TEXT, -- For SMS replies, the exact message received
    -- Technical details
    ip_address INET,
    user_agent TEXT,
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_consent_audit_subscriber ON marketing_consent_audit_log(subscriber_id);
CREATE INDEX idx_consent_audit_phone ON marketing_consent_audit_log(subscriber_phone);
CREATE INDEX idx_consent_audit_date ON marketing_consent_audit_log(created_at);

-- ============================================
-- 6. IMPORT JOBS
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_import_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    source VARCHAR(100) NOT NULL, -- 'mindbody', 'csv', 'mailchimp', etc.
    -- Import type
    import_type VARCHAR(30) DEFAULT 'subscribers' CHECK (import_type IN (
        'subscribers', 'email_list', 'sms_list', 'full_sync'
    )),
    -- File info (for CSV imports)
    filename VARCHAR(255),
    file_url TEXT,
    -- Field mapping
    field_mapping JSONB DEFAULT '{}',
    -- Options
    options JSONB DEFAULT '{}', -- e.g., {"skip_duplicates": true, "update_existing": false}
    -- Progress
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN (
        'pending', 'processing', 'completed', 'failed', 'cancelled'
    )),
    total_records INT DEFAULT 0,
    processed_records INT DEFAULT 0,
    created_records INT DEFAULT 0,
    updated_records INT DEFAULT 0,
    skipped_records INT DEFAULT 0,
    failed_records INT DEFAULT 0,
    -- Error tracking
    errors JSONB DEFAULT '[]',
    -- Timing
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    -- Metadata
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. IMPORT RECORDS (Detailed tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS marketing_import_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    import_job_id UUID REFERENCES marketing_import_jobs(id) ON DELETE CASCADE,
    row_number INT,
    -- Original data
    original_data JSONB NOT NULL,
    -- Result
    status VARCHAR(20) CHECK (status IN ('created', 'updated', 'skipped', 'failed')),
    subscriber_id UUID REFERENCES marketing_subscribers(id) ON DELETE SET NULL,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_import_records_job ON marketing_import_records(import_job_id);

-- ============================================
-- 8. ENHANCE MARKETING_PREFERENCES
-- ============================================

-- Add SMS campaign preferences to existing table
ALTER TABLE marketing_preferences
ADD COLUMN IF NOT EXISTS receive_sms_promotions BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS receive_sms_reminders BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS max_sms_per_week INT DEFAULT 2,
ADD COLUMN IF NOT EXISTS sms_opt_in_date TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sms_opt_in_source VARCHAR(100);

-- ============================================
-- 9. HELPER FUNCTIONS
-- ============================================

-- Get subscriber for a user (or create one)
CREATE OR REPLACE FUNCTION get_or_create_subscriber(
    p_user_id UUID,
    p_email VARCHAR DEFAULT NULL,
    p_phone VARCHAR DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_subscriber_id UUID;
    v_user RECORD;
BEGIN
    -- Check if subscriber exists for this user
    SELECT id INTO v_subscriber_id
    FROM marketing_subscribers
    WHERE user_id = p_user_id;

    IF v_subscriber_id IS NOT NULL THEN
        RETURN v_subscriber_id;
    END IF;

    -- Get user info
    SELECT * INTO v_user FROM users WHERE id = p_user_id;

    -- Check if subscriber exists by email/phone
    SELECT id INTO v_subscriber_id
    FROM marketing_subscribers
    WHERE (email = COALESCE(p_email, v_user.email) AND email IS NOT NULL)
       OR (phone = COALESCE(p_phone, v_user.phone) AND phone IS NOT NULL);

    IF v_subscriber_id IS NOT NULL THEN
        -- Link existing subscriber to user
        UPDATE marketing_subscribers SET user_id = p_user_id WHERE id = v_subscriber_id;
        RETURN v_subscriber_id;
    END IF;

    -- Create new subscriber
    INSERT INTO marketing_subscribers (user_id, email, phone, first_name, last_name, email_opted_in, email_opt_in_date, email_opt_in_source)
    VALUES (
        p_user_id,
        COALESCE(p_email, v_user.email),
        COALESCE(p_phone, v_user.phone),
        v_user.first_name,
        v_user.last_name,
        TRUE,
        NOW(),
        'account_creation'
    )
    RETURNING id INTO v_subscriber_id;

    RETURN v_subscriber_id;
END;
$$ LANGUAGE plpgsql;

-- Check if phone can receive SMS
CREATE OR REPLACE FUNCTION can_receive_sms(p_phone VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    v_opted_in BOOLEAN;
BEGIN
    SELECT sms_opted_in AND NOT sms_opted_out INTO v_opted_in
    FROM marketing_subscribers
    WHERE phone = p_phone;

    RETURN COALESCE(v_opted_in, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Format phone number to E.164
CREATE OR REPLACE FUNCTION format_phone_e164(p_phone VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    v_digits VARCHAR;
BEGIN
    -- Remove all non-digits
    v_digits := REGEXP_REPLACE(p_phone, '[^0-9]', '', 'g');

    -- Add country code if needed
    IF LENGTH(v_digits) = 10 THEN
        v_digits := '1' || v_digits;
    END IF;

    -- Add + prefix
    IF NOT v_digits LIKE '+%' THEN
        v_digits := '+' || v_digits;
    END IF;

    RETURN v_digits;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 10. VIEWS
-- ============================================

-- Subscriber stats overview
CREATE OR REPLACE VIEW marketing_subscriber_stats AS
SELECT
    COUNT(*) as total_subscribers,
    COUNT(*) FILTER (WHERE email_opted_in AND NOT email_opted_out) as email_subscribers,
    COUNT(*) FILTER (WHERE sms_opted_in AND NOT sms_opted_out) as sms_subscribers,
    COUNT(*) FILTER (WHERE email_opted_in AND sms_opted_in AND NOT email_opted_out AND NOT sms_opted_out) as both_channels,
    COUNT(*) FILTER (WHERE user_id IS NOT NULL) as linked_to_users,
    COUNT(*) FILTER (WHERE status = 'active') as active,
    COUNT(*) FILTER (WHERE status = 'unsubscribed') as unsubscribed,
    COUNT(*) FILTER (WHERE status = 'bounced') as bounced,
    COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') as new_last_30_days,
    COUNT(*) FILTER (WHERE email_opt_out_date >= NOW() - INTERVAL '30 days') as email_unsubs_last_30_days,
    COUNT(*) FILTER (WHERE sms_opt_out_date >= NOW() - INTERVAL '30 days') as sms_unsubs_last_30_days
FROM marketing_subscribers;

-- SMS campaign stats
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
    c.estimated_segments,
    c.actual_segments,
    s.name as segment_name
FROM marketing_sms_campaigns c
LEFT JOIN marketing_segments s ON c.segment_id = s.id;

-- ============================================
-- 11. TRIGGERS
-- ============================================

-- Auto-update timestamps
CREATE TRIGGER update_subscribers_timestamp
    BEFORE UPDATE ON marketing_subscribers
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_sms_templates_timestamp
    BEFORE UPDATE ON marketing_sms_templates
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_sms_campaigns_timestamp
    BEFORE UPDATE ON marketing_sms_campaigns
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Log consent changes
CREATE OR REPLACE FUNCTION log_consent_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Email opt-in changed
    IF OLD.email_opted_in IS DISTINCT FROM NEW.email_opted_in THEN
        INSERT INTO marketing_consent_log (subscriber_id, channel, action, source)
        VALUES (
            NEW.id,
            'email',
            CASE WHEN NEW.email_opted_in THEN 'opt_in' ELSE 'opt_out' END,
            COALESCE(NEW.email_opt_in_source, 'unknown')
        );
    END IF;

    -- SMS opt-in changed
    IF OLD.sms_opted_in IS DISTINCT FROM NEW.sms_opted_in THEN
        INSERT INTO marketing_consent_log (subscriber_id, channel, action, source, consent_text)
        VALUES (
            NEW.id,
            'sms',
            CASE WHEN NEW.sms_opted_in THEN 'opt_in' ELSE 'opt_out' END,
            COALESCE(NEW.sms_opt_in_source, 'unknown'),
            NEW.sms_consent_text
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_consent_log
    AFTER UPDATE ON marketing_subscribers
    FOR EACH ROW EXECUTE FUNCTION log_consent_change();

-- ============================================
-- 12. SYNC USERS TO SUBSCRIBERS
-- ============================================

-- Create subscribers for existing users who have opted in
INSERT INTO marketing_subscribers (user_id, email, phone, first_name, last_name, email_opted_in, email_opt_in_date, email_opt_in_source)
SELECT
    u.id,
    u.email,
    u.phone,
    u.first_name,
    u.last_name,
    COALESCE(np.email_enabled, TRUE),
    u.created_at,
    'account_migration'
FROM users u
LEFT JOIN notification_preferences np ON np.user_id = u.id
WHERE u.is_active = TRUE
  AND u.role = 'student'
  AND NOT EXISTS (SELECT 1 FROM marketing_subscribers ms WHERE ms.user_id = u.id OR ms.email = u.email)
ON CONFLICT DO NOTHING;
