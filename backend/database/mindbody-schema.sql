-- ============================================
-- MINDBODY API INTEGRATION SCHEMA
-- Sync tracking and ID mapping
-- ============================================

-- ============================================
-- 1. MINDBODY CONFIGURATION
-- ============================================

-- Store MindBody site/API configuration
CREATE TABLE IF NOT EXISTS mindbody_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id VARCHAR(50) NOT NULL UNIQUE,
    site_name VARCHAR(255),
    api_key VARCHAR(255) NOT NULL,
    -- User token for authenticated actions (optional)
    staff_username VARCHAR(255),
    staff_password_encrypted TEXT,
    user_token TEXT,
    user_token_expires_at TIMESTAMPTZ,
    -- Sync settings
    auto_sync_enabled BOOLEAN DEFAULT TRUE,
    sync_interval_minutes INT DEFAULT 15,
    last_full_sync TIMESTAMPTZ,
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 2. ID MAPPING TABLES
-- ============================================
-- Map MindBody IDs to StudioFlow UUIDs

-- Client (user) mapping
CREATE TABLE IF NOT EXISTS mindbody_client_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_client_id VARCHAR(100) NOT NULL,
    studioflow_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- MindBody data snapshot for conflict detection
    mb_first_name VARCHAR(255),
    mb_last_name VARCHAR(255),
    mb_email VARCHAR(255),
    mb_phone VARCHAR(50),
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_direction VARCHAR(20) DEFAULT 'mb_to_sf' CHECK (sync_direction IN ('mb_to_sf', 'sf_to_mb', 'bidirectional')),
    sync_status VARCHAR(20) DEFAULT 'synced' CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_client_id)
);

CREATE INDEX idx_mb_client_map_user ON mindbody_client_map(studioflow_user_id);
CREATE INDEX idx_mb_client_map_email ON mindbody_client_map(mb_email);
CREATE INDEX idx_mb_client_map_status ON mindbody_client_map(sync_status);

-- Staff (teacher) mapping
CREATE TABLE IF NOT EXISTS mindbody_staff_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_staff_id VARCHAR(100) NOT NULL,
    studioflow_teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    studioflow_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    -- MindBody data snapshot
    mb_first_name VARCHAR(255),
    mb_last_name VARCHAR(255),
    mb_email VARCHAR(255),
    mb_is_male BOOLEAN,
    mb_bio TEXT,
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_staff_id)
);

CREATE INDEX idx_mb_staff_map_teacher ON mindbody_staff_map(studioflow_teacher_id);

-- Class description (class type) mapping
CREATE TABLE IF NOT EXISTS mindbody_class_type_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_class_description_id VARCHAR(100) NOT NULL,
    studioflow_class_type_id UUID REFERENCES class_types(id) ON DELETE SET NULL,
    -- MindBody data snapshot
    mb_name VARCHAR(255),
    mb_description TEXT,
    mb_duration INT,
    mb_category VARCHAR(100),
    mb_subcategory VARCHAR(100),
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_class_description_id)
);

CREATE INDEX idx_mb_class_type_map ON mindbody_class_type_map(studioflow_class_type_id);

-- Class schedule mapping
CREATE TABLE IF NOT EXISTS mindbody_class_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_class_id VARCHAR(100) NOT NULL,
    mindbody_class_schedule_id VARCHAR(100),
    studioflow_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    -- MindBody data snapshot
    mb_start_datetime TIMESTAMPTZ,
    mb_end_datetime TIMESTAMPTZ,
    mb_staff_id VARCHAR(100),
    mb_location_id VARCHAR(100),
    mb_class_description_id VARCHAR(100),
    mb_is_cancelled BOOLEAN DEFAULT FALSE,
    mb_max_capacity INT,
    mb_total_booked INT,
    mb_waitlist_size INT,
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_class_id)
);

CREATE INDEX idx_mb_class_map_class ON mindbody_class_map(studioflow_class_id);
CREATE INDEX idx_mb_class_map_date ON mindbody_class_map(mb_start_datetime);

-- Location mapping
CREATE TABLE IF NOT EXISTS mindbody_location_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_location_id VARCHAR(100) NOT NULL,
    studioflow_location_id UUID REFERENCES locations(id) ON DELETE SET NULL,
    -- MindBody data snapshot
    mb_name VARCHAR(255),
    mb_address VARCHAR(255),
    mb_city VARCHAR(100),
    mb_state VARCHAR(50),
    mb_postal_code VARCHAR(20),
    mb_phone VARCHAR(50),
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_location_id)
);

CREATE INDEX idx_mb_location_map ON mindbody_location_map(studioflow_location_id);

-- Booking (visit) mapping
CREATE TABLE IF NOT EXISTS mindbody_booking_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_visit_id VARCHAR(100) NOT NULL,
    studioflow_booking_id UUID REFERENCES bookings(id) ON DELETE SET NULL,
    -- MindBody data snapshot
    mb_class_id VARCHAR(100),
    mb_client_id VARCHAR(100),
    mb_service_id VARCHAR(100),
    mb_signed_in BOOLEAN DEFAULT FALSE,
    mb_make_up BOOLEAN DEFAULT FALSE,
    mb_late_cancelled BOOLEAN DEFAULT FALSE,
    mb_last_modified TIMESTAMPTZ,
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_visit_id)
);

CREATE INDEX idx_mb_booking_map_booking ON mindbody_booking_map(studioflow_booking_id);
CREATE INDEX idx_mb_booking_map_class ON mindbody_booking_map(mb_class_id);

-- Membership/Contract mapping
CREATE TABLE IF NOT EXISTS mindbody_membership_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_client_contract_id VARCHAR(100) NOT NULL,
    mindbody_contract_id VARCHAR(100),
    studioflow_user_membership_id UUID REFERENCES user_memberships(id) ON DELETE SET NULL,
    -- MindBody data snapshot
    mb_client_id VARCHAR(100),
    mb_contract_name VARCHAR(255),
    mb_start_date DATE,
    mb_end_date DATE,
    mb_remaining_count INT,
    mb_is_auto_renewing BOOLEAN,
    mb_status VARCHAR(50),
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_client_contract_id)
);

CREATE INDEX idx_mb_membership_map ON mindbody_membership_map(studioflow_user_membership_id);

-- Service/Pricing mapping (for class packs, drop-ins)
CREATE TABLE IF NOT EXISTS mindbody_service_map (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mindbody_site_id VARCHAR(50) NOT NULL,
    mindbody_service_id VARCHAR(100) NOT NULL,
    studioflow_membership_type_id UUID REFERENCES membership_types(id) ON DELETE SET NULL,
    -- MindBody data snapshot
    mb_name VARCHAR(255),
    mb_price DECIMAL(10,2),
    mb_count INT,
    mb_program_id VARCHAR(100),
    -- Sync metadata
    last_synced_at TIMESTAMPTZ DEFAULT NOW(),
    sync_status VARCHAR(20) DEFAULT 'synced',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(mindbody_site_id, mindbody_service_id)
);

-- ============================================
-- 3. SYNC LOG / HISTORY
-- ============================================

CREATE TABLE IF NOT EXISTS mindbody_sync_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id VARCHAR(50) NOT NULL,
    sync_type VARCHAR(50) NOT NULL CHECK (sync_type IN (
        'full', 'incremental', 'classes', 'clients', 'staff',
        'bookings', 'memberships', 'locations', 'services', 'webhook'
    )),
    status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    -- Counts
    records_fetched INT DEFAULT 0,
    records_created INT DEFAULT 0,
    records_updated INT DEFAULT 0,
    records_skipped INT DEFAULT 0,
    records_error INT DEFAULT 0,
    -- Timing
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INT,
    -- API metrics
    api_calls_made INT DEFAULT 0,
    -- Error tracking
    errors JSONB DEFAULT '[]',
    -- Triggered by
    triggered_by VARCHAR(50) DEFAULT 'manual' CHECK (triggered_by IN ('manual', 'scheduled', 'webhook', 'api')),
    triggered_by_user UUID REFERENCES users(id),
    -- Summary
    summary JSONB DEFAULT '{}'
);

CREATE INDEX idx_mb_sync_log_site ON mindbody_sync_log(site_id);
CREATE INDEX idx_mb_sync_log_type ON mindbody_sync_log(sync_type);
CREATE INDEX idx_mb_sync_log_date ON mindbody_sync_log(started_at DESC);

-- ============================================
-- 4. WEBHOOK EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS mindbody_webhook_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id VARCHAR(255),
    event_type VARCHAR(100) NOT NULL,
    site_id VARCHAR(50),
    -- Raw event data
    payload JSONB NOT NULL,
    -- Processing
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'processed', 'failed', 'ignored')),
    processed_at TIMESTAMPTZ,
    error TEXT,
    retry_count INT DEFAULT 0,
    -- Timestamps
    received_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mb_webhook_status ON mindbody_webhook_events(status);
CREATE INDEX idx_mb_webhook_type ON mindbody_webhook_events(event_type);
CREATE INDEX idx_mb_webhook_date ON mindbody_webhook_events(received_at DESC);

-- ============================================
-- 5. SYNC QUEUE (for async processing)
-- ============================================

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

CREATE INDEX idx_mb_queue_pending ON mindbody_sync_queue(scheduled_for) WHERE status = 'pending';
CREATE INDEX idx_mb_queue_status ON mindbody_sync_queue(status);

-- ============================================
-- 6. HELPER FUNCTIONS
-- ============================================

-- Update timestamp trigger
CREATE TRIGGER update_mb_config_timestamp
    BEFORE UPDATE ON mindbody_config
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_mb_client_map_timestamp
    BEFORE UPDATE ON mindbody_client_map
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_mb_staff_map_timestamp
    BEFORE UPDATE ON mindbody_staff_map
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

CREATE TRIGGER update_mb_class_map_timestamp
    BEFORE UPDATE ON mindbody_class_map
    FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Function to get StudioFlow user ID from MindBody client ID
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

-- Function to get StudioFlow class ID from MindBody class ID
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

-- Function to get MindBody client ID from StudioFlow user ID
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

-- ============================================
-- 7. VIEWS
-- ============================================

-- View for sync status overview
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

-- Add MindBody settings to main settings table
INSERT INTO settings (key, value, description)
VALUES ('mindbody', '{
    "enabled": false,
    "sync_schedule": "*/15 * * * *",
    "sync_days_ahead": 14,
    "sync_days_back": 7,
    "create_missing_users": true,
    "create_missing_classes": true,
    "update_existing": true,
    "primary_system": "mindbody"
}', 'MindBody API integration settings')
ON CONFLICT (key) DO NOTHING;
