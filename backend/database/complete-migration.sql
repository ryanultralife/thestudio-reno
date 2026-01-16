-- ============================================
-- THE STUDIO RENO - UNIFIED DATABASE SCHEMA
-- PostgreSQL 14+
-- ============================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For fuzzy search

-- ============================================
-- 1. USERS & AUTHENTICATION
-- ============================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100),
    phone VARCHAR(20),
    avatar_url TEXT,
    emergency_contact_name VARCHAR(100),
    emergency_contact_phone VARCHAR(20),
    date_of_birth DATE,
    
    -- Role-based access
    role VARCHAR(20) DEFAULT 'student' CHECK (role IN (
        'student', 'teacher', 'front_desk', 'manager', 'owner', 'admin'
    )),
    
    -- Status
    email_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_name ON users USING gin((first_name || ' ' || last_name) gin_trgm_ops);

-- ============================================
-- 2. PERMISSIONS SYSTEM (RBAC)
-- ============================================

CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50)
);

CREATE TABLE role_permissions (
    role VARCHAR(20) NOT NULL,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role, permission_id)
);

-- Individual permission overrides (grant or deny)
CREATE TABLE user_permissions (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    granted BOOLEAN DEFAULT TRUE, -- false = explicitly denied
    PRIMARY KEY (user_id, permission_id)
);

-- Insert core permissions
INSERT INTO permissions (name, description, category) VALUES
-- Booking permissions
('booking.view_own', 'View own bookings', 'booking'),
('booking.view_all', 'View all bookings', 'booking'),
('booking.create_self', 'Book classes for self', 'booking'),
('booking.create_others', 'Book classes for other users', 'booking'),
('booking.cancel_self', 'Cancel own bookings', 'booking'),
('booking.cancel_others', 'Cancel any booking', 'booking'),
('booking.checkin', 'Check in students', 'booking'),
-- Class permissions
('class.view_schedule', 'View class schedule', 'class'),
('class.view_roster_own', 'View roster for own classes', 'class'),
('class.view_roster_all', 'View any class roster', 'class'),
('class.create', 'Create classes', 'class'),
('class.edit', 'Edit classes', 'class'),
('class.cancel', 'Cancel classes', 'class'),
('class.manage_types', 'Manage class types', 'class'),
-- User permissions
('user.view_own', 'View own profile', 'user'),
('user.view_basic', 'View basic user info (name, email)', 'user'),
('user.view_full', 'View full user profiles', 'user'),
('user.edit_own', 'Edit own profile', 'user'),
('user.edit_all', 'Edit any user', 'user'),
('user.create', 'Create new users', 'user'),
('user.deactivate', 'Deactivate users', 'user'),
-- Membership permissions
('membership.view_own', 'View own membership', 'membership'),
('membership.view_all', 'View all memberships', 'membership'),
('membership.sell', 'Sell memberships', 'membership'),
('membership.manage', 'Manage membership types/pricing', 'membership'),
('membership.comp', 'Give complimentary memberships', 'membership'),
-- Financial
('transaction.view_own', 'View own transactions', 'financial'),
('transaction.view_all', 'View all transactions', 'financial'),
('transaction.refund', 'Process refunds', 'financial'),
('report.basic', 'View basic reports', 'financial'),
('report.financial', 'View financial reports', 'financial'),
('report.custom', 'Run custom report queries', 'financial'),
-- Teacher specific
('sub_request.create', 'Create sub requests', 'teacher'),
('sub_request.claim', 'Claim sub requests', 'teacher'),
('sub_request.approve', 'Approve sub requests', 'teacher'),
('teacher.view_pay', 'View own pay info', 'teacher'),
('teacher.manage_pay', 'Manage teacher pay rates', 'teacher'),
-- Admin
('waiver.view', 'View signed waivers', 'admin'),
('waiver.manage', 'Manage waiver templates', 'admin'),
('notification.send_bulk', 'Send bulk notifications', 'admin'),
('import.run', 'Run data imports', 'admin'),
('settings.view', 'View system settings', 'admin'),
('settings.edit', 'Edit system settings', 'admin'),
('staff.manage', 'Manage staff accounts', 'admin'),
('location.manage', 'Manage locations', 'admin');

-- Assign permissions to roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'student', id FROM permissions WHERE name IN (
    'booking.view_own', 'booking.create_self', 'booking.cancel_self',
    'class.view_schedule', 'user.view_own', 'user.edit_own',
    'membership.view_own', 'transaction.view_own'
);

INSERT INTO role_permissions (role, permission_id)
SELECT 'teacher', id FROM permissions WHERE name IN (
    'booking.view_own', 'booking.create_self', 'booking.cancel_self',
    'class.view_schedule', 'class.view_roster_own', 'booking.checkin',
    'user.view_own', 'user.edit_own', 'user.view_basic',
    'membership.view_own', 'transaction.view_own',
    'sub_request.create', 'sub_request.claim', 'teacher.view_pay'
);

INSERT INTO role_permissions (role, permission_id)
SELECT 'front_desk', id FROM permissions WHERE name IN (
    'booking.view_own', 'booking.view_all', 'booking.create_self', 'booking.create_others',
    'booking.cancel_self', 'booking.cancel_others', 'booking.checkin',
    'class.view_schedule', 'class.view_roster_all',
    'user.view_own', 'user.edit_own', 'user.view_basic', 'user.view_full', 'user.create',
    'membership.view_own', 'membership.view_all', 'membership.sell',
    'transaction.view_own', 'transaction.view_all',
    'report.basic', 'waiver.view'
);

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN (
    'booking.view_own', 'booking.view_all', 'booking.create_self', 'booking.create_others',
    'booking.cancel_self', 'booking.cancel_others', 'booking.checkin',
    'class.view_schedule', 'class.view_roster_all', 'class.create', 'class.edit', 'class.cancel',
    'user.view_own', 'user.edit_own', 'user.view_basic', 'user.view_full', 'user.create',
    'membership.view_own', 'membership.view_all', 'membership.sell', 'membership.comp',
    'transaction.view_own', 'transaction.view_all', 'transaction.refund',
    'report.basic', 'report.financial',
    'sub_request.approve', 'waiver.view', 'settings.view'
);

INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions WHERE name NOT IN (
    'settings.edit'  -- Only admin can edit core settings
);

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions;

-- ============================================
-- 3. LOCATIONS
-- ============================================

CREATE TABLE locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    address VARCHAR(255),
    city VARCHAR(100) DEFAULT 'Reno',
    state VARCHAR(50) DEFAULT 'NV',
    zip VARCHAR(20),
    phone VARCHAR(20),
    email VARCHAR(255),
    capacity INT DEFAULT 20,
    is_active BOOLEAN DEFAULT TRUE,
    timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO locations (name, short_name, address) VALUES 
('Main Studio', 'S. Virginia', '1085 S Virginia St'),
('Moran Studio', 'Moran St', '600 S Virginia St');

-- ============================================
-- 4. TEACHERS
-- ============================================

CREATE TABLE teachers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    title VARCHAR(100),
    bio TEXT,
    photo_url TEXT,
    specialties TEXT[],
    certifications TEXT[],
    hire_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Pay configuration
    default_hourly_rate DECIMAL(10,2),
    default_per_class_rate DECIMAL(10,2),
    default_per_head_rate DECIMAL(10,2),
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teachers_user ON teachers(user_id);

-- Pay rates per class type (optional overrides)
CREATE TABLE teacher_pay_rates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    class_type_id UUID, -- References class_types
    location_id UUID REFERENCES locations(id),
    pay_type VARCHAR(20) CHECK (pay_type IN ('hourly', 'per_class', 'per_head')),
    rate DECIMAL(10,2) NOT NULL,
    effective_date DATE DEFAULT CURRENT_DATE,
    UNIQUE(teacher_id, class_type_id, location_id, effective_date)
);

-- ============================================
-- 5. SUB REQUESTS
-- ============================================

CREATE TABLE sub_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_id UUID NOT NULL, -- References classes
    requesting_teacher_id UUID REFERENCES teachers(id),
    reason TEXT,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'claimed', 'approved', 'filled', 'cancelled')),
    
    claimed_by_teacher_id UUID REFERENCES teachers(id),
    claimed_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    
    -- Notification tracking
    notified_teachers UUID[] DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sub_requests_status ON sub_requests(status);
CREATE INDEX idx_sub_requests_class ON sub_requests(class_id);

-- ============================================
-- 6. CLASS TYPES
-- ============================================

CREATE TABLE class_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    short_description VARCHAR(255),
    duration INT NOT NULL DEFAULT 60,
    category VARCHAR(50) CHECK (category IN ('flow', 'power', 'yin', 'heated', 'beginner', 'meditation', 'workshop', 'private')),
    level VARCHAR(20) CHECK (level IN ('all', 'beginner', 'intermediate', 'advanced')),
    is_heated BOOLEAN DEFAULT FALSE,
    default_capacity INT DEFAULT 20,
    drop_in_price DECIMAL(10,2) DEFAULT 20.00,
    color VARCHAR(20),
    icon VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teacher_pay_rates 
    ADD CONSTRAINT fk_class_type 
    FOREIGN KEY (class_type_id) REFERENCES class_types(id) ON DELETE CASCADE;

INSERT INTO class_types (name, duration, category, level, is_heated, description, sort_order) VALUES
('Vinyasa Flow', 60, 'flow', 'all', false, 'Connect breath with movement through creative sequences.', 1),
('Hot Vinyasa', 60, 'heated', 'all', true, 'Energizing flow in a heated room (85-95°F).', 2),
('Power & Peace', 60, 'power', 'intermediate', false, 'Build stamina with steady-paced, energizing vinyasa.', 3),
('All Levels Flow', 60, 'flow', 'all', false, 'Mindful slow flow for all experience levels.', 4),
('Yin Yoga', 75, 'yin', 'all', false, 'Deep stretches held 3-5 minutes with Reiki healing.', 5),
('Dynamic Release Flow', 75, 'flow', 'intermediate', false, 'Vinyasa flow with self-myofascial release.', 6),
('Beginners Yoga', 60, 'beginner', 'beginner', false, 'Perfect for newcomers. Learn alignment and breath.', 7),
('Warm Vinyasa & Stretch', 60, 'heated', 'all', true, 'Gentle heat with focus on flexibility.', 8),
('Sound Meditation', 60, 'meditation', 'all', false, 'Guided meditation with sound healing.', 9),
('Mysore Ashtanga', 150, 'power', 'advanced', false, 'Independent practice with hands-on guidance.', 10);

-- ============================================
-- 7. SCHEDULE TEMPLATES
-- ============================================

CREATE TABLE class_schedule_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_type_id UUID REFERENCES class_types(id),
    teacher_id UUID REFERENCES teachers(id),
    location_id UUID REFERENCES locations(id),
    day_of_week INT CHECK (day_of_week BETWEEN 0 AND 6),
    start_time TIME NOT NULL,
    capacity INT,
    is_active BOOLEAN DEFAULT TRUE,
    valid_from DATE DEFAULT CURRENT_DATE,
    valid_until DATE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 8. CLASS INSTANCES
-- ============================================

CREATE TABLE classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    class_type_id UUID REFERENCES class_types(id),
    teacher_id UUID REFERENCES teachers(id),
    location_id UUID REFERENCES locations(id),
    template_id UUID REFERENCES class_schedule_templates(id),
    
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME,
    capacity INT NOT NULL DEFAULT 20,
    
    -- Status
    is_cancelled BOOLEAN DEFAULT FALSE,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES users(id),
    
    -- Substitution
    substitute_teacher_id UUID REFERENCES teachers(id),
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_classes_date ON classes(date);
CREATE INDEX idx_classes_teacher ON classes(teacher_id);
CREATE INDEX idx_classes_location_date ON classes(location_id, date);

ALTER TABLE sub_requests 
    ADD CONSTRAINT fk_class 
    FOREIGN KEY (class_id) REFERENCES classes(id) ON DELETE CASCADE;

-- ============================================
-- 9. MEMBERSHIPS
-- ============================================

CREATE TABLE membership_types (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    type VARCHAR(20) CHECK (type IN ('unlimited', 'credits', 'single', 'intro')),
    duration_days INT,
    credits INT,
    
    -- Restrictions
    is_intro_offer BOOLEAN DEFAULT FALSE,
    intro_limit_per_user INT DEFAULT 1,
    requires_autopay BOOLEAN DEFAULT FALSE,
    
    -- Stripe
    stripe_price_id VARCHAR(100),
    
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO membership_types (name, description, price, type, duration_days, credits, is_intro_offer, sort_order) VALUES
('Intro Month', 'Unlimited classes for new students', 40.00, 'intro', 30, NULL, true, 1),
('Monthly Unlimited', 'Unlimited classes with autopay', 99.00, 'unlimited', 30, NULL, false, 2),
('10-Class Pack', '10 classes, use anytime', 180.00, 'credits', 365, 10, false, 3),
('20-Class Pack', '20 classes, best value', 320.00, 'credits', 365, 20, false, 4),
('5-Class Pack', '5 classes for beginners', 95.00, 'credits', 90, 5, false, 5),
('Single Class', 'Drop-in rate', 22.00, 'single', 1, 1, false, 6),
('Student Monthly', 'Unlimited for students (ID required)', 79.00, 'unlimited', 30, NULL, false, 7);

CREATE TABLE user_memberships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    membership_type_id UUID REFERENCES membership_types(id),
    
    start_date DATE DEFAULT CURRENT_DATE,
    end_date DATE,
    credits_remaining INT,
    
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled', 'paused', 'pending')),
    
    -- Stripe subscription
    stripe_subscription_id VARCHAR(100),
    stripe_customer_id VARCHAR(100),
    
    -- Pause feature
    paused_at TIMESTAMPTZ,
    pause_until DATE,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_memberships_user ON user_memberships(user_id);
CREATE INDEX idx_user_memberships_status ON user_memberships(status);
CREATE INDEX idx_user_memberships_end ON user_memberships(end_date) WHERE status = 'active';

-- ============================================
-- 10. BOOKINGS
-- ============================================

CREATE TABLE bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    membership_id UUID REFERENCES user_memberships(id),
    
    status VARCHAR(20) DEFAULT 'booked' CHECK (status IN (
        'booked', 'checked_in', 'cancelled', 'late_cancel', 'no_show'
    )),
    
    credits_used INT DEFAULT 0,
    booked_at TIMESTAMPTZ DEFAULT NOW(),
    checked_in_at TIMESTAMPTZ,
    checked_in_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMPTZ,
    
    -- Booking metadata
    booked_by UUID REFERENCES users(id), -- Staff who booked for user
    booking_source VARCHAR(20) DEFAULT 'web', -- web, app, front_desk, import
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, class_id)
);

CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_class ON bookings(class_id);
CREATE INDEX idx_bookings_status ON bookings(status);

CREATE TABLE waitlist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    position INT NOT NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    notified_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    UNIQUE(user_id, class_id)
);

CREATE INDEX idx_waitlist_class ON waitlist(class_id);

-- ============================================
-- 11. TRANSACTIONS
-- ============================================

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    
    type VARCHAR(30) CHECK (type IN (
        'membership_purchase', 'drop_in', 'retail', 'gift_card_purchase',
        'gift_card_redemption', 'refund', 'adjustment', 'comp'
    )),
    
    amount DECIMAL(10,2) NOT NULL,
    tax DECIMAL(10,2) DEFAULT 0,
    total DECIMAL(10,2) NOT NULL,
    
    -- Payment details
    payment_method VARCHAR(50),
    stripe_payment_id VARCHAR(100),
    
    -- What was purchased
    membership_type_id UUID REFERENCES membership_types(id),
    gift_card_id UUID,
    
    status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    
    -- Staff & notes
    processed_by UUID REFERENCES users(id),
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(created_at);
CREATE INDEX idx_transactions_type ON transactions(type);

-- ============================================
-- 12. GIFT CARDS & PROMO CREDITS
-- ============================================

CREATE TABLE gift_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(20) UNIQUE NOT NULL,
    original_amount DECIMAL(10,2) NOT NULL,
    remaining_amount DECIMAL(10,2) NOT NULL,
    
    -- Purchaser
    purchased_by UUID REFERENCES users(id),
    recipient_email VARCHAR(255),
    recipient_name VARCHAR(100),
    message TEXT,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'redeemed', 'expired', 'cancelled')),
    expires_at DATE,
    
    -- Redemption
    redeemed_by UUID REFERENCES users(id),
    redeemed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_gift_cards_code ON gift_cards(code);

ALTER TABLE transactions 
    ADD CONSTRAINT fk_gift_card 
    FOREIGN KEY (gift_card_id) REFERENCES gift_cards(id);

-- ============================================
-- 13. DIGITAL WAIVERS
-- ============================================

CREATE TABLE waiver_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    version INT DEFAULT 1,
    content TEXT NOT NULL, -- HTML content
    is_required BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO waiver_templates (name, content) VALUES
('Liability Waiver', '<h2>Liability Waiver and Release</h2>
<p>I understand that yoga involves physical activity and that I participate at my own risk...</p>
<p>I release The Studio Reno, its owners, employees, and instructors from any liability...</p>
<p>I confirm that I am in good health and have consulted a physician if necessary...</p>'),
('Photo Release', '<h2>Photo/Video Release</h2>
<p>I grant The Studio Reno permission to use photographs or videos that may include my likeness for marketing purposes...</p>');

CREATE TABLE signed_waivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    waiver_template_id UUID REFERENCES waiver_templates(id),
    
    signature_data TEXT, -- Base64 signature image or typed name
    signature_type VARCHAR(20) CHECK (signature_type IN ('drawn', 'typed')),
    ip_address INET,
    user_agent TEXT,
    
    signed_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, waiver_template_id)
);

CREATE INDEX idx_signed_waivers_user ON signed_waivers(user_id);

-- ============================================
-- 14. NOTIFICATIONS
-- ============================================

CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE UNIQUE,
    
    -- Global toggles
    email_enabled BOOLEAN DEFAULT TRUE,
    sms_enabled BOOLEAN DEFAULT TRUE,
    sms_phone VARCHAR(20),
    
    -- Email preferences
    email_booking_confirmation BOOLEAN DEFAULT TRUE,
    email_booking_reminder BOOLEAN DEFAULT TRUE,
    email_class_cancelled BOOLEAN DEFAULT TRUE,
    email_waitlist BOOLEAN DEFAULT TRUE,
    email_membership_expiring BOOLEAN DEFAULT TRUE,
    email_promotions BOOLEAN DEFAULT TRUE,
    
    -- SMS preferences
    sms_booking_confirmation BOOLEAN DEFAULT TRUE,
    sms_booking_reminder BOOLEAN DEFAULT TRUE,
    sms_class_cancelled BOOLEAN DEFAULT TRUE,
    sms_waitlist BOOLEAN DEFAULT TRUE,
    
    -- Timing
    reminder_hours INT DEFAULT 24,
    timezone VARCHAR(50) DEFAULT 'America/Los_Angeles',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create preferences for new users
CREATE OR REPLACE FUNCTION create_notification_prefs()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notification_preferences (user_id, sms_phone)
    VALUES (NEW.id, NEW.phone)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_notification_prefs
    AFTER INSERT ON users
    FOR EACH ROW EXECUTE FUNCTION create_notification_prefs();

CREATE TABLE email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    subject VARCHAR(255) NOT NULL,
    body_html TEXT NOT NULL,
    body_text TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE notification_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    channel VARCHAR(10) CHECK (channel IN ('email', 'sms')),
    template_name VARCHAR(100),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    status VARCHAR(20) DEFAULT 'sent',
    provider_id VARCHAR(255),
    error TEXT,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_log_user ON notification_log(user_id);
CREATE INDEX idx_notification_log_date ON notification_log(sent_at);

-- ============================================
-- 15. WORKFLOWS (AUTOMATION)
-- ============================================

CREATE TABLE workflows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    trigger_type VARCHAR(50) NOT NULL CHECK (trigger_type IN (
        'user_signup', 'first_class', 'class_attended', 'no_show',
        'membership_purchased', 'membership_expiring', 'credits_low',
        'inactive_days', 'birthday', 'manual'
    )),
    trigger_config JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
    step_order INT NOT NULL,
    action_type VARCHAR(30) CHECK (action_type IN (
        'send_email', 'send_sms', 'wait', 'add_tag', 'remove_tag', 'notify_staff'
    )),
    action_config JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workflow_executions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID REFERENCES workflows(id),
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'running',
    current_step INT DEFAULT 0,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE TABLE workflow_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID REFERENCES workflow_executions(id) ON DELETE CASCADE,
    step_id UUID REFERENCES workflow_steps(id),
    scheduled_for TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_workflow_tasks_pending ON workflow_tasks(scheduled_for) WHERE status = 'pending';

-- Default workflows
INSERT INTO workflows (name, trigger_type, trigger_config) VALUES
('Welcome Series', 'user_signup', '{}'),
('First Class Follow-up', 'first_class', '{}'),
('No-Show Recovery', 'no_show', '{}'),
('Membership Expiring', 'membership_expiring', '{"days_before": 7}'),
('Low Credits Alert', 'credits_low', '{"threshold": 3}'),
('Win-Back Campaign', 'inactive_days', '{"days": 30}'),
('Birthday Wishes', 'birthday', '{}');

-- ============================================
-- 16. TAGS (SEGMENTATION)
-- ============================================

CREATE TABLE tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    color VARCHAR(20) DEFAULT '#6B7280',
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_tags (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    tag_id UUID REFERENCES tags(id) ON DELETE CASCADE,
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, tag_id)
);

INSERT INTO tags (name, color, is_system) VALUES
('new-student', '#10B981', true),
('vip', '#F59E0B', false),
('at-risk', '#EF4444', true),
('teacher-training', '#3B82F6', false);

-- ============================================
-- 17. IMPORTS
-- ============================================

CREATE TABLE imports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source VARCHAR(50) NOT NULL,
    filename VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    total_records INT DEFAULT 0,
    processed INT DEFAULT 0,
    created INT DEFAULT 0,
    updated INT DEFAULT 0,
    skipped INT DEFAULT 0,
    errors JSONB DEFAULT '[]',
    field_mapping JSONB,
    created_by UUID REFERENCES users(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 18. REPORTS
-- ============================================

CREATE TABLE report_definitions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    query_template TEXT NOT NULL,
    default_params JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE scheduled_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID REFERENCES report_definitions(id),
    schedule VARCHAR(20) CHECK (schedule IN ('daily', 'weekly', 'monthly')),
    recipients TEXT[] NOT NULL,
    params JSONB DEFAULT '{}',
    last_run TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 19. NOTES & ACTIVITY
-- ============================================

CREATE TABLE user_notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    created_by UUID REFERENCES users(id),
    note TEXT NOT NULL,
    is_private BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_notes_user ON user_notes(user_id);

-- ============================================
-- 20. SETTINGS & FAQ
-- ============================================

CREATE TABLE settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO settings (key, value, description) VALUES
('business', '{"name": "The Studio Reno", "email": "thestudioreno@gmail.com", "phone": "(775) 284-5545"}', 'Business info'),
('booking', '{"advance_days": 14, "cancel_hours": 2, "waitlist_enabled": true}', 'Booking rules'),
('notifications', '{"reminder_hours": 24, "send_confirmations": true}', 'Notification settings');

CREATE TABLE faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    category VARCHAR(50),
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO faqs (question, answer, category, sort_order) VALUES
('What should I bring?', 'Just yourself! We provide mats, props, and towels.', 'Getting Started', 1),
('How early should I arrive?', 'Please arrive 15 minutes early for check-in.', 'Getting Started', 2),
('What is the cancellation policy?', 'Cancel at least 2 hours before class to avoid losing a credit.', 'Policies', 3);

-- ============================================
-- 21. HELPER FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_timestamp BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_classes_timestamp BEFORE UPDATE ON classes FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_bookings_timestamp BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_memberships_timestamp BEFORE UPDATE ON user_memberships FOR EACH ROW EXECUTE FUNCTION update_timestamp();

-- Check if user has permission
CREATE OR REPLACE FUNCTION user_has_permission(user_uuid UUID, permission_name VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
    user_role VARCHAR;
    has_perm BOOLEAN;
BEGIN
    -- Get user role
    SELECT role INTO user_role FROM users WHERE id = user_uuid;
    IF user_role IS NULL THEN RETURN FALSE; END IF;
    
    -- Check for explicit user override first
    SELECT granted INTO has_perm 
    FROM user_permissions up
    JOIN permissions p ON up.permission_id = p.id
    WHERE up.user_id = user_uuid AND p.name = permission_name;
    
    IF has_perm IS NOT NULL THEN RETURN has_perm; END IF;
    
    -- Fall back to role permission
    SELECT EXISTS(
        SELECT 1 FROM role_permissions rp
        JOIN permissions p ON rp.permission_id = p.id
        WHERE rp.role = user_role AND p.name = permission_name
    ) INTO has_perm;
    
    RETURN has_perm;
END;
$$ LANGUAGE plpgsql;

-- Get class availability
CREATE OR REPLACE FUNCTION get_class_availability(class_uuid UUID)
RETURNS TABLE (capacity INT, booked INT, available INT, waitlist_count INT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.capacity,
        COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in'))::INT,
        (c.capacity - COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')))::INT,
        (SELECT COUNT(*) FROM waitlist w WHERE w.class_id = c.id)::INT
    FROM classes c
    LEFT JOIN bookings b ON b.class_id = c.id
    WHERE c.id = class_uuid
    GROUP BY c.id;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 22. VIEWS
-- ============================================

CREATE VIEW class_details AS
SELECT 
    c.id, c.date, c.start_time, c.end_time, c.capacity, c.is_cancelled,
    c.teacher_id, c.substitute_teacher_id, c.location_id,
    ct.name as class_name, ct.duration, ct.category, ct.is_heated, ct.level,
    l.name as location_name, l.short_name as location_short,
    u.first_name as teacher_first_name, u.last_name as teacher_last_name,
    t.photo_url as teacher_photo,
    COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as booked_count,
    c.capacity - COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as spots_left
FROM classes c
JOIN class_types ct ON c.class_type_id = ct.id
JOIN locations l ON c.location_id = l.id
JOIN teachers t ON c.teacher_id = t.id
JOIN users u ON t.user_id = u.id
LEFT JOIN bookings b ON b.class_id = c.id
GROUP BY c.id, ct.id, l.id, t.id, u.id;

CREATE VIEW active_members AS
SELECT 
    u.id, u.email, u.first_name, u.last_name, u.phone, u.created_at,
    mt.name as membership_name, mt.type as membership_type,
    um.end_date, um.credits_remaining, um.status as membership_status,
    (SELECT COUNT(*) FROM bookings b WHERE b.user_id = u.id AND b.status = 'checked_in') as total_classes,
    (SELECT MAX(c.date) FROM bookings b JOIN classes c ON b.class_id = c.id WHERE b.user_id = u.id AND b.status = 'checked_in') as last_visit
FROM users u
LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
LEFT JOIN membership_types mt ON mt.id = um.membership_type_id
WHERE u.role = 'student' AND u.is_active = true;

-- ============================================
-- SOCIAL MEDIA POSTS
-- ============================================

CREATE TABLE IF NOT EXISTS social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID REFERENCES classes(id),
  content TEXT NOT NULL,
  image_url TEXT,
  facebook_post_id TEXT,
  instagram_post_id TEXT,
  posted_by UUID REFERENCES users(id),
  posted_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS scheduled_social_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  image_url TEXT,
  link TEXT,
  platforms TEXT[] DEFAULT ARRAY['facebook'],
  scheduled_for TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  result JSONB,
  posted_at TIMESTAMPTZ,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_scheduled_social_status ON scheduled_social_posts(status, scheduled_for);
-- ============================================
-- THE STUDIO RENO - SEED DATA
-- Run after schema.sql for testing
-- ============================================

-- ============================================
-- ADMIN USER (password: admin123)
-- ============================================

INSERT INTO users (email, password_hash, first_name, last_name, role, email_verified)
VALUES (
  'admin@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Admin',
  'User',
  'admin',
  true
);

-- ============================================
-- SAMPLE TEACHERS
-- ============================================

-- Teacher 1 (password: teacher123)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'sarah@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Sarah',
  'Johnson',
  '775-555-0101',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'RYT-500', 'Sarah has been teaching yoga for over 10 years...', 
       ARRAY['Vinyasa', 'Power Yoga'], 45.00
FROM users WHERE email = 'sarah@thestudioreno.com';

-- Teacher 2
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'mike@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Mike',
  'Chen',
  '775-555-0102',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'RYT-200', 'Mike specializes in heated yoga and meditation...', 
       ARRAY['Hot Yoga', 'Meditation'], 40.00
FROM users WHERE email = 'mike@thestudioreno.com';

-- Teacher 3
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'emma@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Emma',
  'Davis',
  '775-555-0103',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'E-RYT 500', 'Emma is passionate about making yoga accessible to all...', 
       ARRAY['Yin', 'Beginners', 'Restorative'], 45.00
FROM users WHERE email = 'emma@thestudioreno.com';

-- ============================================
-- FRONT DESK STAFF
-- ============================================

INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'frontdesk@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Front',
  'Desk',
  '775-555-0100',
  'front_desk',
  true
);

-- ============================================
-- SAMPLE STUDENTS
-- ============================================

INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES 
  ('student1@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.', 'Jane', 'Smith', '775-555-1001', 'student', true),
  ('student2@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.', 'John', 'Doe', '775-555-1002', 'student', true),
  ('student3@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.', 'Alice', 'Brown', '775-555-1003', 'student', true);

-- ============================================
-- SAMPLE MEMBERSHIPS FOR STUDENTS
-- ============================================

-- Jane gets monthly unlimited
INSERT INTO user_memberships (user_id, membership_type_id, end_date, status)
SELECT u.id, mt.id, CURRENT_DATE + INTERVAL '30 days', 'active'
FROM users u, membership_types mt
WHERE u.email = 'student1@example.com' AND mt.name = 'Monthly Unlimited';

-- John gets 10-class pack
INSERT INTO user_memberships (user_id, membership_type_id, credits_remaining, end_date, status)
SELECT u.id, mt.id, 10, CURRENT_DATE + INTERVAL '365 days', 'active'
FROM users u, membership_types mt
WHERE u.email = 'student2@example.com' AND mt.name = '10-Class Pack';

-- Alice gets intro offer
INSERT INTO user_memberships (user_id, membership_type_id, end_date, status)
SELECT u.id, mt.id, CURRENT_DATE + INTERVAL '30 days', 'active'
FROM users u, membership_types mt
WHERE u.email = 'student3@example.com' AND mt.name = 'Intro Month';

-- ============================================
-- SAMPLE SCHEDULE TEMPLATES
-- ============================================

-- Get IDs for reference
DO $$
DECLARE
  loc_main UUID;
  loc_moran UUID;
  teacher_sarah UUID;
  teacher_mike UUID;
  teacher_emma UUID;
  ct_vinyasa UUID;
  ct_hot UUID;
  ct_yin UUID;
  ct_beginner UUID;
  ct_meditation UUID;
BEGIN
  SELECT id INTO loc_main FROM locations WHERE short_name = 'S. Virginia';
  SELECT id INTO loc_moran FROM locations WHERE short_name = 'Moran St';
  
  SELECT t.id INTO teacher_sarah FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Sarah';
  SELECT t.id INTO teacher_mike FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Mike';
  SELECT t.id INTO teacher_emma FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Emma';
  
  SELECT id INTO ct_vinyasa FROM class_types WHERE name = 'Vinyasa Flow';
  SELECT id INTO ct_hot FROM class_types WHERE name = 'Hot Vinyasa';
  SELECT id INTO ct_yin FROM class_types WHERE name = 'Yin Yoga';
  SELECT id INTO ct_beginner FROM class_types WHERE name = 'Beginners Yoga';
  SELECT id INTO ct_meditation FROM class_types WHERE name = 'Sound Meditation';

  -- Monday schedule
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES 
    (ct_vinyasa, teacher_sarah, loc_main, 1, '06:00', 20),
    (ct_hot, teacher_mike, loc_main, 1, '09:00', 18),
    (ct_beginner, teacher_emma, loc_main, 1, '12:00', 15),
    (ct_vinyasa, teacher_sarah, loc_main, 1, '17:30', 20),
    (ct_yin, teacher_emma, loc_main, 1, '19:30', 20);

  -- Tuesday schedule
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES 
    (ct_hot, teacher_mike, loc_main, 2, '06:00', 18),
    (ct_vinyasa, teacher_sarah, loc_main, 2, '09:00', 20),
    (ct_meditation, teacher_emma, loc_moran, 2, '12:00', 25),
    (ct_hot, teacher_mike, loc_main, 2, '17:30', 18);

  -- Wednesday schedule  
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES 
    (ct_vinyasa, teacher_sarah, loc_main, 3, '06:00', 20),
    (ct_beginner, teacher_emma, loc_main, 3, '09:00', 15),
    (ct_hot, teacher_mike, loc_main, 3, '12:00', 18),
    (ct_vinyasa, teacher_sarah, loc_main, 3, '17:30', 20),
    (ct_yin, teacher_emma, loc_main, 3, '19:30', 20);

  -- Thursday schedule
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES 
    (ct_hot, teacher_mike, loc_main, 4, '06:00', 18),
    (ct_vinyasa, teacher_sarah, loc_main, 4, '09:00', 20),
    (ct_beginner, teacher_emma, loc_main, 4, '17:30', 15);

  -- Friday schedule
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES 
    (ct_vinyasa, teacher_sarah, loc_main, 5, '06:00', 20),
    (ct_hot, teacher_mike, loc_main, 5, '09:00', 18),
    (ct_yin, teacher_emma, loc_main, 5, '17:30', 20);

  -- Saturday schedule
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES 
    (ct_vinyasa, teacher_sarah, loc_main, 6, '08:00', 20),
    (ct_hot, teacher_mike, loc_main, 6, '10:00', 18),
    (ct_beginner, teacher_emma, loc_main, 6, '12:00', 15);

  -- Sunday schedule
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES 
    (ct_yin, teacher_emma, loc_main, 0, '09:00', 20),
    (ct_vinyasa, teacher_sarah, loc_main, 0, '11:00', 20),
    (ct_meditation, teacher_emma, loc_moran, 0, '17:00', 25);

END $$;

-- ============================================
-- GENERATE CLASSES FOR NEXT 2 WEEKS
-- ============================================

-- This would normally be done via the API, but for seed data:
DO $$
DECLARE
  template RECORD;
  current_date DATE := CURRENT_DATE;
  end_date DATE := CURRENT_DATE + INTERVAL '14 days';
  check_date DATE;
  end_time TIME;
BEGIN
  check_date := current_date;
  
  WHILE check_date <= end_date LOOP
    FOR template IN 
      SELECT t.*, ct.duration 
      FROM class_schedule_templates t
      JOIN class_types ct ON t.class_type_id = ct.id
      WHERE t.is_active = true AND t.day_of_week = EXTRACT(DOW FROM check_date)
    LOOP
      -- Calculate end time
      end_time := template.start_time + (template.duration || ' minutes')::interval;
      
      INSERT INTO classes (class_type_id, teacher_id, location_id, template_id, date, start_time, end_time, capacity)
      VALUES (template.class_type_id, template.teacher_id, template.location_id, template.id, 
              check_date, template.start_time, end_time, template.capacity)
      ON CONFLICT DO NOTHING;
    END LOOP;
    
    check_date := check_date + INTERVAL '1 day';
  END LOOP;
END $$;

-- ============================================
-- SAMPLE BOOKINGS
-- ============================================

-- Book Jane (unlimited) into tomorrow's 6am class
INSERT INTO bookings (user_id, class_id, membership_id, status)
SELECT u.id, c.id, um.id, 'booked'
FROM users u
JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
JOIN classes c ON c.date = CURRENT_DATE + INTERVAL '1 day' AND c.start_time = '06:00'
WHERE u.email = 'student1@example.com'
LIMIT 1;

-- Book John (credits) into tomorrow's 9am class
INSERT INTO bookings (user_id, class_id, membership_id, credits_used, status)
SELECT u.id, c.id, um.id, 1, 'booked'
FROM users u
JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
JOIN classes c ON c.date = CURRENT_DATE + INTERVAL '1 day' AND c.start_time = '09:00'
WHERE u.email = 'student2@example.com'
LIMIT 1;

-- Deduct the credit
UPDATE user_memberships um
SET credits_remaining = credits_remaining - 1
FROM users u
WHERE um.user_id = u.id AND u.email = 'student2@example.com';

-- ============================================
-- SAMPLE TRANSACTIONS
-- ============================================

INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, status)
SELECT u.id, 'membership_purchase', mt.price, mt.price, 'stripe', mt.id, 'completed'
FROM users u, membership_types mt
WHERE u.email = 'student1@example.com' AND mt.name = 'Monthly Unlimited';

INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, status)
SELECT u.id, 'membership_purchase', mt.price, mt.price, 'stripe', mt.id, 'completed'
FROM users u, membership_types mt
WHERE u.email = 'student2@example.com' AND mt.name = '10-Class Pack';

INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, status)
SELECT u.id, 'membership_purchase', mt.price, mt.price, 'in_person', mt.id, 'completed'
FROM users u, membership_types mt
WHERE u.email = 'student3@example.com' AND mt.name = 'Intro Month';

-- ============================================
-- DONE
-- ============================================

SELECT 'Seed data loaded successfully!' as status;
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as teachers FROM teachers;
SELECT COUNT(*) as templates FROM class_schedule_templates;
SELECT COUNT(*) as classes FROM classes;
SELECT COUNT(*) as bookings FROM bookings;
-- ============================================
-- THE STUDIO RENO - RETAIL & INVENTORY SCHEMA
-- Future-proofed for wholesale/white-label
-- ============================================

-- ============================================
-- PRODUCT CATEGORIES
-- ============================================

CREATE TABLE IF NOT EXISTS product_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  description TEXT,
  parent_id UUID REFERENCES product_categories(id),
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCTS
-- ============================================

CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200) NOT NULL,
  slug VARCHAR(200) UNIQUE NOT NULL,
  description TEXT,
  category_id UUID REFERENCES product_categories(id),
  
  -- Pricing
  cost_price DECIMAL(10,2),              -- What we pay
  retail_price DECIMAL(10,2) NOT NULL,   -- In-studio price
  online_price DECIMAL(10,2),            -- Website price (if different)
  wholesale_price DECIMAL(10,2),         -- B2B price (Phase 3)
  
  -- Inventory
  track_inventory BOOLEAN DEFAULT true,
  allow_backorder BOOLEAN DEFAULT false,
  low_stock_threshold INTEGER DEFAULT 5,
  
  -- Product type for future wholesale
  product_type VARCHAR(50) DEFAULT 'retail', -- retail, wholesale, both
  is_customizable BOOLEAN DEFAULT false,     -- Can add custom logo?
  base_product_id UUID REFERENCES products(id), -- For variants
  
  -- Media
  image_url TEXT,
  images JSONB DEFAULT '[]',
  
  -- Metadata
  brand VARCHAR(100) DEFAULT 'The Studio',
  vendor VARCHAR(100),
  tags TEXT[],
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  available_online BOOLEAN DEFAULT true,
  available_instore BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PRODUCT VARIANTS (Size/Color combos)
-- ============================================

CREATE TABLE IF NOT EXISTS product_variants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(200),                     -- e.g., "Small / Black"
  
  -- Options
  size VARCHAR(20),
  color VARCHAR(50),
  color_hex VARCHAR(7),                  -- For UI display
  
  -- Pricing (override product price if set)
  retail_price DECIMAL(10,2),
  wholesale_price DECIMAL(10,2),
  
  -- Inventory
  quantity_on_hand INTEGER DEFAULT 0,
  quantity_reserved INTEGER DEFAULT 0,   -- In carts, pending orders
  quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INVENTORY TRANSACTIONS (Stock movements)
-- ============================================

CREATE TABLE IF NOT EXISTS inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id UUID NOT NULL REFERENCES product_variants(id),
  
  -- Transaction type
  transaction_type VARCHAR(30) NOT NULL, -- purchase, sale, adjustment, return, transfer, shrinkage
  
  -- Quantities
  quantity INTEGER NOT NULL,             -- Positive for in, negative for out
  quantity_before INTEGER NOT NULL,
  quantity_after INTEGER NOT NULL,
  
  -- Reference
  reference_type VARCHAR(30),            -- order, purchase_order, adjustment
  reference_id UUID,
  
  -- Details
  unit_cost DECIMAL(10,2),
  notes TEXT,
  
  -- Who/when
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RETAIL ORDERS (Online + In-store)
-- ============================================

CREATE TABLE IF NOT EXISTS retail_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number VARCHAR(20) UNIQUE NOT NULL,
  
  -- Customer (can be guest for online)
  user_id UUID REFERENCES users(id),
  customer_email VARCHAR(255),
  customer_name VARCHAR(200),
  customer_phone VARCHAR(30),
  
  -- Order type
  order_type VARCHAR(20) DEFAULT 'in_store', -- in_store, online, wholesale
  order_source VARCHAR(50) DEFAULT 'pos',     -- pos, website, wholesale_portal
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending',       -- pending, paid, processing, shipped, delivered, cancelled, refunded
  payment_status VARCHAR(30) DEFAULT 'pending', -- pending, paid, partial, refunded
  fulfillment_status VARCHAR(30) DEFAULT 'unfulfilled', -- unfulfilled, partial, fulfilled
  
  -- Totals
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  shipping_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  
  -- Discount
  discount_code VARCHAR(50),
  discount_id UUID REFERENCES discounts(id),
  
  -- Payment
  payment_method VARCHAR(30),
  stripe_payment_intent_id VARCHAR(255),
  paid_at TIMESTAMPTZ,
  
  -- Shipping (for online orders)
  shipping_address JSONB,
  shipping_method VARCHAR(50),
  tracking_number VARCHAR(100),
  shipped_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  
  -- Staff
  staff_id UUID REFERENCES users(id),        -- Who processed the sale
  location_id UUID REFERENCES locations(id), -- Which studio
  
  -- Notes
  notes TEXT,
  internal_notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RETAIL ORDER ITEMS
-- ============================================

CREATE TABLE IF NOT EXISTS retail_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES retail_orders(id) ON DELETE CASCADE,
  
  -- Product
  product_id UUID REFERENCES products(id),
  variant_id UUID REFERENCES product_variants(id),
  
  -- Snapshot (in case product changes)
  product_name VARCHAR(200) NOT NULL,
  variant_name VARCHAR(200),
  sku VARCHAR(50),
  
  -- Quantities
  quantity INTEGER NOT NULL DEFAULT 1,
  quantity_fulfilled INTEGER DEFAULT 0,
  
  -- Pricing
  unit_price DECIMAL(10,2) NOT NULL,
  discount_amount DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL,
  
  -- For customizable products (wholesale)
  customization JSONB,                   -- {logo_url, placement, color, etc.}
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- DISCOUNTS / PROMO CODES
-- ============================================

CREATE TABLE IF NOT EXISTS discounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  
  -- Type
  discount_type VARCHAR(20) NOT NULL,    -- percentage, fixed_amount, free_shipping
  discount_value DECIMAL(10,2) NOT NULL,
  
  -- Scope
  applies_to VARCHAR(30) DEFAULT 'all',  -- all, specific_products, specific_categories
  product_ids UUID[],
  category_ids UUID[],
  
  -- Limits
  minimum_purchase DECIMAL(10,2),
  maximum_discount DECIMAL(10,2),
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  one_per_customer BOOLEAN DEFAULT true,
  
  -- Validity
  starts_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  
  -- Wholesale only?
  wholesale_only BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- WHOLESALE ACCOUNTS (Phase 3 prep)
-- ============================================

CREATE TABLE IF NOT EXISTS wholesale_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  
  -- Business info
  business_name VARCHAR(200) NOT NULL,
  business_type VARCHAR(50),             -- yoga_studio, gym, retail_store, brand
  tax_id VARCHAR(50),
  website VARCHAR(255),
  
  -- Contact
  contact_name VARCHAR(200),
  contact_email VARCHAR(255) NOT NULL,
  contact_phone VARCHAR(30),
  
  -- Address
  billing_address JSONB,
  shipping_address JSONB,
  
  -- Pricing tier
  pricing_tier VARCHAR(30) DEFAULT 'standard', -- standard, premium, vip
  discount_percentage DECIMAL(5,2) DEFAULT 0,
  
  -- Credit
  credit_limit DECIMAL(10,2) DEFAULT 0,
  credit_balance DECIMAL(10,2) DEFAULT 0,
  payment_terms INTEGER DEFAULT 0,       -- Net days (0 = prepay)
  
  -- Status
  status VARCHAR(30) DEFAULT 'pending',  -- pending, approved, suspended
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- SUPPLIERS / VENDORS (for your supply chain)
-- ============================================

CREATE TABLE IF NOT EXISTS suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200),
  email VARCHAR(255),
  phone VARCHAR(30),
  website VARCHAR(255),
  
  -- Address
  address JSONB,
  
  -- Terms
  payment_terms INTEGER DEFAULT 30,
  minimum_order DECIMAL(10,2),
  lead_time_days INTEGER,
  
  -- Capabilities
  services TEXT[],                       -- screen_print, dtg, embroidery, etc.
  
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PURCHASE ORDERS (Restocking)
-- ============================================

CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_number VARCHAR(20) UNIQUE NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  
  -- Status
  status VARCHAR(30) DEFAULT 'draft',    -- draft, submitted, confirmed, partial, received, cancelled
  
  -- Totals
  subtotal DECIMAL(10,2) DEFAULT 0,
  shipping_cost DECIMAL(10,2) DEFAULT 0,
  tax_amount DECIMAL(10,2) DEFAULT 0,
  total_amount DECIMAL(10,2) DEFAULT 0,
  
  -- Dates
  order_date TIMESTAMPTZ,
  expected_date TIMESTAMPTZ,
  received_date TIMESTAMPTZ,
  
  -- Shipping
  shipping_method VARCHAR(100),
  tracking_number VARCHAR(100),
  
  notes TEXT,
  
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id),
  
  -- Details
  description VARCHAR(255),
  quantity_ordered INTEGER NOT NULL,
  quantity_received INTEGER DEFAULT 0,
  unit_cost DECIMAL(10,2) NOT NULL,
  total_cost DECIMAL(10,2) NOT NULL,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);
CREATE INDEX idx_products_type ON products(product_type);
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE INDEX idx_variants_sku ON product_variants(sku);
CREATE INDEX idx_inventory_variant ON inventory_transactions(variant_id);
CREATE INDEX idx_orders_user ON retail_orders(user_id);
CREATE INDEX idx_orders_status ON retail_orders(status);
CREATE INDEX idx_orders_date ON retail_orders(created_at);
CREATE INDEX idx_order_items_order ON retail_order_items(order_id);
CREATE INDEX idx_wholesale_status ON wholesale_accounts(status);

-- ============================================
-- SEED DATA - PRODUCT CATEGORIES
-- ============================================

INSERT INTO product_categories (name, slug, description, sort_order) VALUES
('Apparel', 'apparel', 'Yoga and athleisure clothing', 1),
('Tops', 'tops', 'Tanks, tees, and long sleeves', 2),
('Bottoms', 'bottoms', 'Leggings, shorts, and joggers', 3),
('Outerwear', 'outerwear', 'Hoodies, jackets, and wraps', 4),
('Accessories', 'accessories', 'Mats, towels, bags, and more', 5),
('Equipment', 'equipment', 'Yoga props and equipment', 6);

-- Link subcategories
UPDATE product_categories SET parent_id = (SELECT id FROM product_categories WHERE slug = 'apparel') WHERE slug IN ('tops', 'bottoms', 'outerwear');

-- ============================================
-- SEED DATA - SAMPLE PRODUCTS
-- ============================================

INSERT INTO products (sku, name, slug, description, category_id, cost_price, retail_price, wholesale_price, product_type, is_customizable, brand, tags) VALUES
-- Studio branded
('TSR-TANK-001', 'The Studio Flow Tank', 'studio-flow-tank', 'Lightweight, breathable tank perfect for hot yoga. Features our signature logo.', (SELECT id FROM product_categories WHERE slug = 'tops'), 8.00, 32.00, 18.00, 'both', false, 'The Studio', ARRAY['bestseller', 'yoga', 'tank']),
('TSR-LEG-001', 'The Studio High-Rise Legging', 'studio-high-rise-legging', 'Buttery soft high-rise leggings with hidden pocket. 4-way stretch.', (SELECT id FROM product_categories WHERE slug = 'bottoms'), 12.00, 68.00, 35.00, 'both', false, 'The Studio', ARRAY['bestseller', 'yoga', 'legging']),
('TSR-HOOD-001', 'The Studio Zip Hoodie', 'studio-zip-hoodie', 'Cozy zip-up hoodie for before and after class.', (SELECT id FROM product_categories WHERE slug = 'outerwear'), 15.00, 58.00, 32.00, 'both', false, 'The Studio', ARRAY['hoodie', 'warmup']),
-- Customizable blanks for wholesale
('BLK-TANK-001', 'Blank Flow Tank', 'blank-flow-tank', 'Premium blank tank ready for your custom logo.', (SELECT id FROM product_categories WHERE slug = 'tops'), 6.00, 24.00, 12.00, 'wholesale', true, 'The Studio Supply', ARRAY['blank', 'customizable']),
('BLK-LEG-001', 'Blank High-Rise Legging', 'blank-high-rise-legging', 'Premium blank legging ready for your custom branding.', (SELECT id FROM product_categories WHERE slug = 'bottoms'), 10.00, 48.00, 24.00, 'wholesale', true, 'The Studio Supply', ARRAY['blank', 'customizable']),
-- Accessories
('TSR-MAT-001', 'The Studio Yoga Mat', 'studio-yoga-mat', '5mm eco-friendly yoga mat with alignment lines.', (SELECT id FROM product_categories WHERE slug = 'equipment'), 18.00, 68.00, 38.00, 'retail', false, 'The Studio', ARRAY['mat', 'eco']),
('TSR-TWL-001', 'Hot Yoga Towel', 'hot-yoga-towel', 'Microfiber towel with grip dots. Mat-sized.', (SELECT id FROM product_categories WHERE slug = 'accessories'), 8.00, 28.00, 16.00, 'both', false, 'The Studio', ARRAY['towel', 'hot yoga']),
('TSR-BAG-001', 'The Studio Tote', 'studio-tote', 'Canvas tote for your yoga gear.', (SELECT id FROM product_categories WHERE slug = 'accessories'), 5.00, 22.00, 12.00, 'both', true, 'The Studio', ARRAY['bag', 'tote']);

-- ============================================
-- SEED DATA - PRODUCT VARIANTS
-- ============================================

-- Flow Tank variants
INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand) 
SELECT p.id, CONCAT('TSR-TANK-001-', s.size, '-', c.color_code), CONCAT(s.size, ' / ', c.color_name), s.size, c.color_name, c.color_hex, 10
FROM products p
CROSS JOIN (VALUES ('XS'), ('S'), ('M'), ('L'), ('XL')) AS s(size)
CROSS JOIN (VALUES ('BLK', 'Black', '#000000'), ('WHT', 'White', '#FFFFFF'), ('NVY', 'Navy', '#1e3a5f')) AS c(color_code, color_name, color_hex)
WHERE p.sku = 'TSR-TANK-001';

-- Legging variants
INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand) 
SELECT p.id, CONCAT('TSR-LEG-001-', s.size, '-', c.color_code), CONCAT(s.size, ' / ', c.color_name), s.size, c.color_name, c.color_hex, 8
FROM products p
CROSS JOIN (VALUES ('XS'), ('S'), ('M'), ('L'), ('XL')) AS s(size)
CROSS JOIN (VALUES ('BLK', 'Black', '#000000'), ('CHAR', 'Charcoal', '#36454F'), ('WINE', 'Wine', '#722F37')) AS c(color_code, color_name, color_hex)
WHERE p.sku = 'TSR-LEG-001';

-- Hoodie variants
INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand) 
SELECT p.id, CONCAT('TSR-HOOD-001-', s.size, '-', c.color_code), CONCAT(s.size, ' / ', c.color_name), s.size, c.color_name, c.color_hex, 6
FROM products p
CROSS JOIN (VALUES ('XS'), ('S'), ('M'), ('L'), ('XL'), ('2XL')) AS s(size)
CROSS JOIN (VALUES ('BLK', 'Black', '#000000'), ('HTH', 'Heather Grey', '#9CA3AF')) AS c(color_code, color_name, color_hex)
WHERE p.sku = 'TSR-HOOD-001';

-- Single variant products (mats, towels, bags)
INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand)
SELECT id, CONCAT(sku, '-STD'), 'Standard', NULL, 'Sage', '#9CAF88', 15 FROM products WHERE sku = 'TSR-MAT-001';

INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand)
SELECT id, CONCAT(sku, '-STD'), 'Standard', NULL, 'Charcoal', '#36454F', 20 FROM products WHERE sku = 'TSR-TWL-001';

INSERT INTO product_variants (product_id, sku, name, size, color, color_hex, quantity_on_hand)
SELECT id, CONCAT(sku, '-STD'), 'Standard', NULL, 'Natural', '#F5F5DC', 12 FROM products WHERE sku = 'TSR-BAG-001';

-- ============================================
-- SAMPLE DISCOUNT CODES
-- ============================================

INSERT INTO discounts (code, description, discount_type, discount_value, minimum_purchase, expires_at) VALUES
('WELCOME10', 'Welcome discount - 10% off first purchase', 'percentage', 10.00, 25.00, NOW() + INTERVAL '1 year'),
('MEMBER15', 'Member discount - 15% off retail', 'percentage', 15.00, NULL, NULL),
('FREESHIP50', 'Free shipping on orders $50+', 'free_shipping', 0, 50.00, NOW() + INTERVAL '6 months');

-- ============================================
-- RETAIL PERMISSIONS
-- ============================================

INSERT INTO permissions (name, description, category) VALUES
-- Retail/Inventory permissions
('view_products', 'View product catalog', 'retail'),
('manage_products', 'Create and edit products', 'retail'),
('manage_inventory', 'Adjust inventory levels', 'retail'),
('view_retail_orders', 'View retail orders', 'retail'),
('manage_retail_orders', 'Process retail orders', 'retail'),
('manage_discounts', 'Create and manage discount codes', 'retail'),
-- Wholesale permissions (Phase 3)
('view_wholesale', 'Access wholesale portal', 'wholesale'),
('manage_wholesale_accounts', 'Approve wholesale accounts', 'wholesale'),
('view_wholesale_pricing', 'View wholesale pricing', 'wholesale')
ON CONFLICT (name) DO NOTHING;

-- Grant retail permissions to roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'front_desk', id FROM permissions WHERE name IN ('view_products', 'manage_retail_orders', 'view_retail_orders')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN ('view_products', 'manage_products', 'manage_inventory', 'view_retail_orders', 'manage_retail_orders', 'manage_discounts')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions WHERE name IN ('view_products', 'manage_products', 'manage_inventory', 'view_retail_orders', 'manage_retail_orders', 'manage_discounts', 'view_wholesale', 'manage_wholesale_accounts', 'view_wholesale_pricing')
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE category IN ('retail', 'wholesale')
ON CONFLICT DO NOTHING;
-- ============================================
-- SPACE RENTAL INQUIRIES
-- ============================================

CREATE TABLE IF NOT EXISTS space_rental_inquiries (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Contact Info
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),

    -- Rental Preferences
    room_type VARCHAR(20) CHECK (room_type IN ('large', 'small', 'either')),
    rental_type VARCHAR(20) CHECK (rental_type IN ('hourly', 'monthly', 'not_sure')),
    preferred_days TEXT, -- e.g., "Weekday evenings, Saturday mornings"
    start_date DATE,

    -- About Their Practice
    practice_type VARCHAR(100), -- e.g., "Yoga", "Breathwork", "Sound Bath", etc.
    experience_years INTEGER,
    has_insurance BOOLEAN DEFAULT FALSE,
    following_size VARCHAR(50), -- e.g., "5-10", "10-20", "20+", "Building from scratch"

    -- Additional Info
    message TEXT,
    hear_about_us VARCHAR(100), -- How they found us

    -- Status
    status VARCHAR(20) DEFAULT 'new' CHECK (status IN (
        'new', 'contacted', 'scheduled_tour', 'approved', 'declined', 'archived'
    )),

    -- Admin Notes
    admin_notes TEXT,
    contacted_at TIMESTAMPTZ,
    contacted_by UUID REFERENCES users(id),

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rental_inquiries_email ON space_rental_inquiries(email);
CREATE INDEX idx_rental_inquiries_status ON space_rental_inquiries(status);
CREATE INDEX idx_rental_inquiries_created ON space_rental_inquiries(created_at DESC);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_rental_inquiry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rental_inquiry_updated_at
    BEFORE UPDATE ON space_rental_inquiries
    FOR EACH ROW
    EXECUTE FUNCTION update_rental_inquiry_updated_at();
-- ============================================
-- THE STUDIO RENO - CMS & SETTINGS SCHEMA
-- Content management for public website
-- ============================================

-- ============================================
-- SITE SETTINGS
-- ============================================

CREATE TABLE IF NOT EXISTS site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) UNIQUE NOT NULL,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- ============================================
-- LOCATIONS (Multi-location support)
-- ============================================

CREATE TABLE IF NOT EXISTS locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  address_line1 VARCHAR(255),
  address_line2 VARCHAR(255),
  city VARCHAR(100) DEFAULT 'Reno',
  state VARCHAR(50) DEFAULT 'NV',
  zip VARCHAR(20),
  phone VARCHAR(30),
  email VARCHAR(255),
  
  -- Display
  description TEXT,
  image_url TEXT,
  images JSONB DEFAULT '[]',
  
  -- Hours
  hours JSONB DEFAULT '{}',
  
  -- Features
  has_tea_lounge BOOLEAN DEFAULT false,
  has_retail BOOLEAN DEFAULT false,
  
  -- Maps
  google_maps_url TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- MEDIA LIBRARY
-- ============================================

CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- File info
  filename VARCHAR(255) NOT NULL,
  original_filename VARCHAR(255),
  mime_type VARCHAR(100),
  file_size INTEGER,
  
  -- URLs (Cloudinary or local)
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  
  -- Metadata
  alt_text VARCHAR(255),
  caption TEXT,
  
  -- Organization
  folder VARCHAR(100) DEFAULT 'general',
  tags TEXT[],
  
  -- Cloudinary specific
  cloudinary_public_id VARCHAR(255),
  
  uploaded_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PAGE CONTENT BLOCKS
-- ============================================

CREATE TABLE IF NOT EXISTS content_blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Location
  page VARCHAR(50) NOT NULL,           -- home, about, tea-lounge, etc.
  section VARCHAR(50) NOT NULL,        -- hero, intro, features, etc.
  
  -- Content
  title TEXT,
  subtitle TEXT,
  body TEXT,
  
  -- Media
  image_id UUID REFERENCES media(id),
  image_url TEXT,                      -- Direct URL fallback
  background_image_url TEXT,
  video_url TEXT,
  
  -- Button/CTA
  button_text VARCHAR(100),
  button_url TEXT,
  button_style VARCHAR(30) DEFAULT 'primary',
  
  -- Layout
  layout VARCHAR(30) DEFAULT 'default', -- default, split, full-width, cards
  alignment VARCHAR(20) DEFAULT 'center',
  
  -- Styling
  background_color VARCHAR(20),
  text_color VARCHAR(20),
  custom_classes TEXT,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

-- ============================================
-- WORKSHOPS & EVENTS
-- ============================================

CREATE TABLE IF NOT EXISTS events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  description TEXT,
  short_description VARCHAR(500),
  
  -- Timing
  start_date DATE NOT NULL,
  start_time TIME,
  end_date DATE,
  end_time TIME,
  is_recurring BOOLEAN DEFAULT false,
  recurrence_rule TEXT,               -- iCal RRULE format
  
  -- Location
  location_id UUID REFERENCES locations(id),
  location_name VARCHAR(200),          -- For external venues
  
  -- Pricing
  price DECIMAL(10,2),
  member_price DECIMAL(10,2),
  early_bird_price DECIMAL(10,2),
  early_bird_deadline DATE,
  
  -- Capacity
  capacity INTEGER,
  registered_count INTEGER DEFAULT 0,
  waitlist_enabled BOOLEAN DEFAULT true,
  
  -- Media
  image_url TEXT,
  images JSONB DEFAULT '[]',
  
  -- Instructor
  instructor_id UUID REFERENCES users(id),
  instructor_name VARCHAR(200),
  
  -- Registration
  registration_url TEXT,               -- External link if needed
  registration_open BOOLEAN DEFAULT true,
  
  -- Categorization
  event_type VARCHAR(50),              -- workshop, sound_bath, training, party, etc.
  tags TEXT[],
  
  -- Status
  status VARCHAR(30) DEFAULT 'published', -- draft, published, cancelled
  is_featured BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- EVENT REGISTRATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS event_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES events(id),
  user_id UUID REFERENCES users(id),
  
  -- Contact info (for guests)
  email VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(30),
  
  -- Registration
  quantity INTEGER DEFAULT 1,
  status VARCHAR(30) DEFAULT 'confirmed', -- confirmed, cancelled, waitlist
  
  -- Payment
  amount_paid DECIMAL(10,2),
  payment_method VARCHAR(30),
  transaction_id UUID,
  
  -- Notes
  notes TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BLOG POSTS
-- ============================================

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  excerpt TEXT,
  content TEXT,
  
  -- Media
  featured_image_url TEXT,
  
  -- Author
  author_id UUID REFERENCES users(id),
  author_name VARCHAR(200),
  
  -- Categorization
  category VARCHAR(50),
  tags TEXT[],
  
  -- SEO
  meta_title VARCHAR(255),
  meta_description VARCHAR(500),
  
  -- Status
  status VARCHAR(30) DEFAULT 'draft',   -- draft, published, archived
  published_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TEACHER PROFILES (extended)
-- ============================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS bio TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS certifications TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS specialties TEXT[];
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS instagram VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;

-- ============================================
-- TESTIMONIALS
-- ============================================

CREATE TABLE IF NOT EXISTS testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  quote TEXT NOT NULL,
  author_name VARCHAR(100),
  author_title VARCHAR(100),          -- e.g., "Member since 2020"
  author_photo_url TEXT,
  
  -- Rating
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  
  -- Display
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  
  -- Source
  source VARCHAR(50),                  -- google, yelp, direct, etc.
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NEWSLETTER SUBSCRIBERS
-- ============================================

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  
  -- Preferences
  subscribed_lists TEXT[] DEFAULT ARRAY['general'],
  
  -- Status
  status VARCHAR(30) DEFAULT 'active',  -- active, unsubscribed, bounced
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ,
  
  -- Source
  source VARCHAR(50) DEFAULT 'website', -- website, checkout, event, import
  
  -- SMS
  phone VARCHAR(30),
  sms_opt_in BOOLEAN DEFAULT false,
  sms_opt_in_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_media_folder ON media(folder);
CREATE INDEX idx_content_page ON content_blocks(page, section);
CREATE INDEX idx_events_date ON events(start_date);
CREATE INDEX idx_events_type ON events(event_type);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_blog_status ON blog_posts(status, published_at);
CREATE INDEX idx_newsletter_status ON newsletter_subscribers(status);

-- ============================================
-- SEED: LOCATIONS
-- ============================================

INSERT INTO locations (name, slug, address_line1, city, state, zip, phone, email, description, has_tea_lounge, google_maps_url, sort_order) VALUES
('The Studio - Original', 'south-virginia', '1085 S Virginia St', 'Reno', 'NV', '89502', '(775) 284-5545', 'thestudioreno@gmail.com', 'Our original location featuring the Tea & Elixir Lounge', true, 'https://www.google.com/maps/place/The+Studio+Reno/@39.513131,-119.807137,15z', 1),
('The Studio - Moran', 'moran-street', '600 S Virginia St', 'Reno', 'NV', '89501', '(775) 284-5545', 'thestudioreno@gmail.com', 'Our second location with entrance on Moran Street', false, 'https://goo.gl/maps/WZ4tESMspe1mdMm66', 2);

-- ============================================
-- SEED: SITE SETTINGS
-- ============================================

INSERT INTO site_settings (key, value) VALUES
('branding', '{
  "logo_url": "https://thestudioreno.com/wp-content/uploads/2025/06/400-the-studio.png",
  "tagline": "Your Conscious Community Center",
  "mission": "Our mission is to create a safe place where people can come to share their gifts, connect with other like-minded people, and grow their practice.",
  "footer_text": "namasté"
}'),
('colors', '{
  "primary": "#8B7355",
  "secondary": "#D4C5B5", 
  "accent": "#C9A86C",
  "dark": "#3D3D3D",
  "light": "#FAF8F5"
}'),
('fonts', '{
  "heading": "Cormorant Garamond",
  "body": "Lato",
  "accent": "Sacramento"
}'),
('social', '{
  "instagram": "thestudioreno",
  "facebook": "thestudioreno",
  "email": "thestudioreno@gmail.com"
}'),
('tea_lounge', '{
  "enabled": true,
  "name": "Tea & Elixir Lounge",
  "tagline": "Renos only late night Tea and Elixir Lounge",
  "hours": [
    {"day": "Wednesday", "open": "8:00 PM", "close": "1:00 AM"},
    {"day": "Friday", "open": "8:00 PM", "close": "1:00 AM"}
  ]
}'),
('intro_offer', '{
  "enabled": true,
  "title": "New Student Special",
  "description": "First month for $40",
  "price": 40,
  "duration_days": 30
}');

-- ============================================
-- SEED: HOMEPAGE CONTENT BLOCKS
-- ============================================

INSERT INTO content_blocks (page, section, title, subtitle, body, button_text, button_url, sort_order) VALUES
('home', 'hero', 'Welcome to The Studio', 'Your Conscious Community Center', 'A place to nurture minds, bodies & spirits.', 'View Schedule', '/schedule', 1),
('home', 'intro', 'Enliven & Enlighten', NULL, 'The atmosphere at The Studio is relaxing, comfortable, and inviting. It is our priority to make your experience enjoyable and revitalizing. We have made it easy to find your source of health and wellness, whether you are ready to make yoga a part of your life, or have been practicing for years!', 'About Us', '/about', 2),
('home', 'new-student', 'New to The Studio?', 'First yoga class? We have got you covered.', 'New students enjoy our Intro month for $40', 'Get Started', '/pricing', 3),
('home', 'tea-lounge', 'Tea & Elixir Lounge', 'Renos only late night Tea and Elixir Lounge', 'Offering specialty teas, elixirs, and community. Open Wednesdays and Fridays 8pm-1am.', 'Learn More', '/tea-lounge', 4),
('home', 'community', 'Find Your Community', NULL, 'Join The Studio and connect with like-minded people on a journey of growth and wellness.', 'Join Now', '/pricing', 5);

-- ============================================
-- SEED: SAMPLE EVENTS
-- ============================================

INSERT INTO events (title, slug, description, short_description, start_date, start_time, end_time, price, capacity, event_type, is_featured, status) VALUES
('First Friday Sound Meditation', 'first-friday-sound-jan', 'Experience somatic grounding to ease you into the sound meditation, allowing your body to soften, your breath to deepen, and your whole system to receive the full restorative effect of the planetary gongs.', 'Start the new year with a powerful and grounding experience.', '2025-01-03', '19:00', '20:30', 40.00, 30, 'sound_bath', true, 'published'),
('Winter Solstice Sound Immersion', 'winter-solstice-2024', 'Celebrate the Solstice with a beautifully curated evening of intention, breath, and sound. Featuring tea, breath work and sound.', 'Celebrate the Solstice with intention, breath, and sound.', '2024-12-21', '19:30', '21:00', 55.00, 25, 'sound_bath', true, 'published');

-- ============================================
-- CMS PERMISSIONS
-- ============================================

INSERT INTO permissions (name, description, category) VALUES
('manage_content', 'Edit website content blocks', 'cms'),
('manage_media', 'Upload and manage media files', 'cms'),
('manage_events', 'Create and manage events/workshops', 'cms'),
('manage_blog', 'Create and manage blog posts', 'cms'),
('manage_settings', 'Edit site settings and branding', 'cms'),
('manage_locations', 'Manage studio locations', 'cms')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions WHERE category = 'cms'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE category = 'cms'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN ('manage_content', 'manage_media', 'manage_events', 'manage_blog')
ON CONFLICT DO NOTHING;

-- ============================================
-- DISPLAY BOARD / DIGITAL SIGNAGE
-- ============================================

CREATE TABLE IF NOT EXISTS display_slides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Content
  title VARCHAR(255),
  subtitle TEXT,
  body TEXT,
  
  -- Media
  image_url TEXT,
  background_url TEXT,
  video_url TEXT,
  
  -- Styling
  layout VARCHAR(30) DEFAULT 'centered',  -- centered, split, full-image
  text_color VARCHAR(20) DEFAULT 'white',
  overlay_opacity DECIMAL(3,2) DEFAULT 0.5,
  
  -- Scheduling
  start_date DATE,
  end_date DATE,
  days_of_week INTEGER[] DEFAULT ARRAY[0,1,2,3,4,5,6], -- 0=Sun, 6=Sat
  start_time TIME,
  end_time TIME,
  
  -- Display settings
  duration_seconds INTEGER DEFAULT 15,
  sort_order INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  slide_type VARCHAR(30) DEFAULT 'promo',  -- promo, announcement, event, custom
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Display settings
INSERT INTO site_settings (key, value) VALUES
('display', '{
  "enabled": true,
  "show_schedule": true,
  "show_events": true,
  "show_promos": true,
  "schedule_slide_duration": 15,
  "promo_slide_duration": 10,
  "refresh_interval": 300,
  "theme": "dark"
}')
ON CONFLICT (key) DO NOTHING;

CREATE INDEX idx_display_slides_active ON display_slides(is_active, start_date, end_date);
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
-- ============================================
-- THEME CUSTOMIZATION FOR SAAS/WHITE-LABELING
-- Allows each studio to customize branding and appearance
-- ============================================

-- Theme settings table (for multi-tenant SaaS)
CREATE TABLE IF NOT EXISTS theme_settings (
  id SERIAL PRIMARY KEY,

  -- Multi-tenant support (null = default theme)
  studio_id UUID REFERENCES studios(id) ON DELETE CASCADE,

  -- Branding
  studio_name VARCHAR(100) DEFAULT 'The Studio',
  logo_url TEXT,
  favicon_url TEXT,

  -- Color Scheme (CSS color values)
  primary_color VARCHAR(20) DEFAULT '#d97706', -- amber-600
  primary_hover VARCHAR(20) DEFAULT '#b45309', -- amber-700
  secondary_color VARCHAR(20) DEFAULT '#ea580c', -- orange-600
  accent_color VARCHAR(20) DEFAULT '#f59e0b', -- amber-500

  -- Text Colors
  text_primary VARCHAR(20) DEFAULT '#111827', -- gray-900
  text_secondary VARCHAR(20) DEFAULT '#6b7280', -- gray-500

  -- Background Colors
  bg_primary VARCHAR(20) DEFAULT '#ffffff',
  bg_secondary VARCHAR(20) DEFAULT '#f9fafb', -- gray-50
  bg_accent VARCHAR(20) DEFAULT '#fef3c7', -- amber-50

  -- Typography
  font_heading VARCHAR(100) DEFAULT 'system-ui, -apple-system, sans-serif',
  font_body VARCHAR(100) DEFAULT 'system-ui, -apple-system, sans-serif',

  -- Layout Options
  layout_style VARCHAR(20) DEFAULT 'modern' CHECK (layout_style IN ('modern', 'classic', 'minimal', 'bold')),
  border_radius VARCHAR(10) DEFAULT 'lg', -- sm, md, lg, xl, 2xl, full

  -- Public Website Settings
  hero_image_url TEXT,
  hero_title TEXT DEFAULT 'Find Your Balance',
  hero_subtitle TEXT DEFAULT 'Join our community and discover the transformative power of yoga',

  -- Custom CSS (advanced)
  custom_css TEXT,

  -- Social Media
  instagram_url TEXT,
  facebook_url TEXT,
  twitter_url TEXT,

  -- Contact Info
  contact_email VARCHAR(255),
  contact_phone VARCHAR(20),
  contact_address TEXT,

  -- Business Hours
  hours_of_operation JSONB DEFAULT '{"monday": "6am-8pm", "tuesday": "6am-8pm", "wednesday": "6am-8pm", "thursday": "6am-8pm", "friday": "6am-8pm", "saturday": "8am-6pm", "sunday": "8am-6pm"}',

  -- Feature Flags
  show_retail_shop BOOLEAN DEFAULT false,
  show_teacher_rentals BOOLEAN DEFAULT false,
  show_tea_lounge BOOLEAN DEFAULT false,
  enable_dark_mode BOOLEAN DEFAULT false,

  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Only one theme per studio
  UNIQUE(studio_id)
);

-- Create studios table if it doesn't exist (for multi-tenant support)
CREATE TABLE IF NOT EXISTS studios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug VARCHAR(50) UNIQUE NOT NULL, -- subdomain or path
  name VARCHAR(100) NOT NULL,
  owner_id UUID REFERENCES users(id),
  subscription_tier VARCHAR(20) DEFAULT 'starter' CHECK (subscription_tier IN ('starter', 'professional', 'enterprise')),
  subscription_status VARCHAR(20) DEFAULT 'active' CHECK (subscription_status IN ('active', 'trial', 'suspended', 'cancelled')),
  custom_domain VARCHAR(100) UNIQUE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

COMMENT ON TABLE studios IS
'Multi-tenant studio management. Each studio gets its own subdomain/custom domain and theme customization.
Example: thestudioreno.yoursaas.com or their own domain.com';

COMMENT ON TABLE theme_settings IS
'Theme customization settings per studio. Allows white-labeling for SaaS.
Each studio can customize colors, fonts, logos, and layout to match their brand.';

-- Insert default theme
INSERT INTO theme_settings (studio_id, studio_name) VALUES (NULL, 'The Studio')
ON CONFLICT (studio_id) DO NOTHING;

-- Color presets for quick theming
CREATE TABLE IF NOT EXISTS theme_presets (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) UNIQUE NOT NULL,
  description TEXT,
  primary_color VARCHAR(20),
  primary_hover VARCHAR(20),
  secondary_color VARCHAR(20),
  accent_color VARCHAR(20),
  bg_accent VARCHAR(20),
  preview_image_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Seed some preset themes
INSERT INTO theme_presets (name, description, primary_color, primary_hover, secondary_color, accent_color, bg_accent, preview_image_url) VALUES
('Amber Warmth', 'Warm, welcoming amber tones (default)', '#d97706', '#b45309', '#ea580c', '#f59e0b', '#fef3c7', NULL),
('Ocean Blue', 'Calming blue like ocean waves', '#0ea5e9', '#0284c7', '#06b6d4', '#38bdf8', '#e0f2fe', NULL),
('Forest Green', 'Natural, grounding green tones', '#10b981', '#059669', '#14b8a6', '#34d399', '#d1fae5', NULL),
('Sunset Purple', 'Spiritual purple and violet', '#8b5cf6', '#7c3aed', '#a78bfa', '#c4b5fd', '#ede9fe', NULL),
('Rose Pink', 'Gentle, feminine pink', '#ec4899', '#db2777', '#f472b6', '#f9a8d4', '#fce7f3', NULL),
('Slate Minimal', 'Modern, minimalist gray', '#64748b', '#475569', '#94a3b8', '#cbd5e1', '#f1f5f9', NULL),
('Earth Terracotta', 'Earthy, warm terracotta', '#ea580c', '#c2410c', '#f97316', '#fb923c', '#fed7aa', NULL)
ON CONFLICT (name) DO NOTHING;

-- View for getting theme with fallback to defaults
CREATE OR REPLACE VIEW active_theme_settings AS
SELECT
  COALESCE(ts.id, 1) as id,
  ts.studio_id,
  COALESCE(ts.studio_name, 'The Studio') as studio_name,
  COALESCE(ts.logo_url, '') as logo_url,
  COALESCE(ts.favicon_url, '') as favicon_url,
  COALESCE(ts.primary_color, '#d97706') as primary_color,
  COALESCE(ts.primary_hover, '#b45309') as primary_hover,
  COALESCE(ts.secondary_color, '#ea580c') as secondary_color,
  COALESCE(ts.accent_color, '#f59e0b') as accent_color,
  COALESCE(ts.text_primary, '#111827') as text_primary,
  COALESCE(ts.text_secondary, '#6b7280') as text_secondary,
  COALESCE(ts.bg_primary, '#ffffff') as bg_primary,
  COALESCE(ts.bg_secondary, '#f9fafb') as bg_secondary,
  COALESCE(ts.bg_accent, '#fef3c7') as bg_accent,
  COALESCE(ts.font_heading, 'system-ui, -apple-system, sans-serif') as font_heading,
  COALESCE(ts.font_body, 'system-ui, -apple-system, sans-serif') as font_body,
  COALESCE(ts.layout_style, 'modern') as layout_style,
  COALESCE(ts.border_radius, 'lg') as border_radius,
  COALESCE(ts.hero_image_url, '') as hero_image_url,
  COALESCE(ts.hero_title, 'Find Your Balance') as hero_title,
  COALESCE(ts.hero_subtitle, 'Join our community and discover the transformative power of yoga') as hero_subtitle,
  COALESCE(ts.custom_css, '') as custom_css,
  COALESCE(ts.instagram_url, '') as instagram_url,
  COALESCE(ts.facebook_url, '') as facebook_url,
  COALESCE(ts.twitter_url, '') as twitter_url,
  COALESCE(ts.contact_email, '') as contact_email,
  COALESCE(ts.contact_phone, '') as contact_phone,
  COALESCE(ts.contact_address, '') as contact_address,
  COALESCE(ts.hours_of_operation, '{}') as hours_of_operation,
  COALESCE(ts.show_retail_shop, false) as show_retail_shop,
  COALESCE(ts.show_teacher_rentals, false) as show_teacher_rentals,
  COALESCE(ts.show_tea_lounge, false) as show_tea_lounge,
  COALESCE(ts.enable_dark_mode, false) as enable_dark_mode
FROM theme_settings ts
WHERE ts.studio_id IS NULL; -- Default theme

-- Function to generate CSS variables from theme
CREATE OR REPLACE FUNCTION get_theme_css(studio_id_param UUID DEFAULT NULL)
RETURNS TEXT AS $$
DECLARE
  theme RECORD;
  css_output TEXT;
BEGIN
  -- Get theme settings
  SELECT * INTO theme FROM theme_settings WHERE studio_id = studio_id_param OR (studio_id_param IS NULL AND studio_id IS NULL) LIMIT 1;

  -- Generate CSS custom properties
  css_output := ':root {
  --color-primary: ' || COALESCE(theme.primary_color, '#d97706') || ';
  --color-primary-hover: ' || COALESCE(theme.primary_hover, '#b45309') || ';
  --color-secondary: ' || COALESCE(theme.secondary_color, '#ea580c') || ';
  --color-accent: ' || COALESCE(theme.accent_color, '#f59e0b') || ';
  --color-text-primary: ' || COALESCE(theme.text_primary, '#111827') || ';
  --color-text-secondary: ' || COALESCE(theme.text_secondary, '#6b7280') || ';
  --color-bg-primary: ' || COALESCE(theme.bg_primary, '#ffffff') || ';
  --color-bg-secondary: ' || COALESCE(theme.bg_secondary, '#f9fafb') || ';
  --color-bg-accent: ' || COALESCE(theme.bg_accent, '#fef3c7') || ';
  --font-heading: ' || COALESCE(theme.font_heading, 'system-ui, -apple-system, sans-serif') || ';
  --font-body: ' || COALESCE(theme.font_body, 'system-ui, -apple-system, sans-serif') || ';
  --border-radius: ' ||
    CASE COALESCE(theme.border_radius, 'lg')
      WHEN 'sm' THEN '0.125rem'
      WHEN 'md' THEN '0.375rem'
      WHEN 'lg' THEN '0.5rem'
      WHEN 'xl' THEN '0.75rem'
      WHEN '2xl' THEN '1rem'
      WHEN 'full' THEN '9999px'
      ELSE '0.5rem'
    END || ';
}';

  RETURN css_output;
END;
$$ LANGUAGE plpgsql;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_theme_settings_studio_id ON theme_settings(studio_id);
CREATE INDEX IF NOT EXISTS idx_studios_slug ON studios(slug);
CREATE INDEX IF NOT EXISTS idx_studios_custom_domain ON studios(custom_domain);

-- Permissions
GRANT ALL ON theme_settings TO thestudio_admin;
GRANT ALL ON theme_presets TO thestudio_admin;
GRANT ALL ON studios TO thestudio_admin;
GRANT SELECT ON active_theme_settings TO thestudio_admin;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_theme_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER theme_settings_updated_at
BEFORE UPDATE ON theme_settings
FOR EACH ROW EXECUTE FUNCTION update_theme_updated_at();
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
-- ============================================
-- MINDBODY MIGRATION SCHEMA
-- Tracks import progress and stores Mindbody reference IDs
-- ============================================

-- Add Mindbody reference columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS mindbody_id VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS imported_from_mindbody BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mindbody_import_date TIMESTAMP;

-- Add Mindbody reference columns to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS mindbody_class_id VARCHAR(50) UNIQUE;

-- Add Mindbody reference columns to class_bookings (visits)
ALTER TABLE class_bookings ADD COLUMN IF NOT EXISTS mindbody_visit_id VARCHAR(50) UNIQUE;

-- Migration progress tracking table
CREATE TABLE IF NOT EXISTS mindbody_migration_progress (
  id SERIAL PRIMARY KEY,
  phase VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  records_total INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize migration phases
INSERT INTO mindbody_migration_progress (phase, status) VALUES
  ('clients', 'pending'),
  ('sms_optin', 'pending'),
  ('visits', 'pending'),
  ('memberships', 'pending'),
  ('credits', 'pending'),
  ('metrics', 'pending')
ON CONFLICT (phase) DO NOTHING;

-- Migration error log
CREATE TABLE IF NOT EXISTS mindbody_migration_errors (
  id SERIAL PRIMARY KEY,
  phase VARCHAR(50) NOT NULL,
  record_id VARCHAR(100),
  error_type VARCHAR(100),
  error_message TEXT,
  error_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Mindbody API rate limit tracking
CREATE TABLE IF NOT EXISTS mindbody_api_usage (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE UNIQUE,
  calls_made INTEGER DEFAULT 0,
  calls_limit INTEGER DEFAULT 1000,
  overage_cost DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Function to increment API usage counter
CREATE OR REPLACE FUNCTION increment_mindbody_api_usage()
RETURNS void AS $$
BEGIN
  INSERT INTO mindbody_api_usage (date, calls_made)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (date)
  DO UPDATE SET calls_made = mindbody_api_usage.calls_made + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to check if we're within rate limits
CREATE OR REPLACE FUNCTION check_mindbody_rate_limit()
RETURNS TABLE (
  calls_today INTEGER,
  calls_remaining INTEGER,
  within_limit BOOLEAN,
  estimated_cost DECIMAL(10,2)
) AS $$
DECLARE
  v_calls_today INTEGER;
  v_calls_limit INTEGER;
BEGIN
  SELECT COALESCE(calls_made, 0), calls_limit
  INTO v_calls_today, v_calls_limit
  FROM mindbody_api_usage
  WHERE date = CURRENT_DATE;

  IF v_calls_today IS NULL THEN
    v_calls_today := 0;
    v_calls_limit := 1000;
  END IF;

  RETURN QUERY SELECT
    v_calls_today,
    GREATEST(v_calls_limit - v_calls_today, 0),
    v_calls_today < v_calls_limit,
    CASE
      WHEN v_calls_today > v_calls_limit
      THEN (v_calls_today - v_calls_limit)::DECIMAL * 0.0033
      ELSE 0.00
    END;
END;
$$ LANGUAGE plpgsql;

-- View for migration dashboard
CREATE OR REPLACE VIEW mindbody_migration_dashboard AS
SELECT
  p.phase,
  p.status,
  p.records_total,
  p.records_processed,
  p.records_failed,
  CASE
    WHEN p.records_total > 0
    THEN ROUND((p.records_processed::DECIMAL / p.records_total * 100), 2)
    ELSE 0
  END as progress_percentage,
  p.error_message,
  p.started_at,
  p.completed_at,
  EXTRACT(EPOCH FROM (p.completed_at - p.started_at)) as duration_seconds,
  (SELECT COUNT(*) FROM mindbody_migration_errors e WHERE e.phase = p.phase) as error_count
FROM mindbody_migration_progress p
ORDER BY
  CASE p.phase
    WHEN 'clients' THEN 1
    WHEN 'sms_optin' THEN 2
    WHEN 'visits' THEN 3
    WHEN 'memberships' THEN 4
    WHEN 'credits' THEN 5
    WHEN 'metrics' THEN 6
  END;

-- Grant permissions
GRANT ALL ON mindbody_migration_progress TO thestudio_admin;
GRANT ALL ON mindbody_migration_errors TO thestudio_admin;
GRANT ALL ON mindbody_api_usage TO thestudio_admin;
GRANT SELECT ON mindbody_migration_dashboard TO thestudio_admin;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_mindbody_id ON users(mindbody_id) WHERE mindbody_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_imported FROM mindbody ON users(imported_from_mindbody) WHERE imported_from_mindbody = true;
CREATE INDEX IF NOT EXISTS idx_migration_errors_phase ON mindbody_migration_errors(phase);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON mindbody_api_usage(date);

-- Sample query to check migration status
COMMENT ON VIEW mindbody_migration_dashboard IS
'Query this view to see real-time migration progress:
SELECT * FROM mindbody_migration_dashboard;';

-- Sample query to check rate limits
COMMENT ON FUNCTION check_mindbody_rate_limit IS
'Check current API usage:
SELECT * FROM check_mindbody_rate_limit();';
-- ============================================
-- FIX WEBHOOK REPLAY VULNERABILITY
-- Track processed Stripe events to prevent replay attacks
-- ============================================

-- Table to track processed webhook events
CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  id SERIAL PRIMARY KEY,

  -- Stripe event ID (unique identifier from Stripe)
  stripe_event_id VARCHAR(255) UNIQUE NOT NULL,

  -- Event type (checkout.session.completed, etc.)
  event_type VARCHAR(100) NOT NULL,

  -- Event data (stored for debugging/audit trail)
  event_data JSONB,

  -- Processing status
  status VARCHAR(20) DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),

  -- Error message if processing failed
  error_message TEXT,

  -- Timestamps
  received_at TIMESTAMP DEFAULT NOW(),
  processed_at TIMESTAMP,

  -- Prevent duplicate event processing
  CONSTRAINT unique_stripe_event UNIQUE(stripe_event_id)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_stripe_events_event_id ON stripe_webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_stripe_events_type ON stripe_webhook_events(event_type);
CREATE INDEX IF NOT EXISTS idx_stripe_events_status ON stripe_webhook_events(status);

-- Function to check if event was already processed
CREATE OR REPLACE FUNCTION is_stripe_event_processed(event_id VARCHAR)
RETURNS BOOLEAN AS $$
DECLARE
  event_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM stripe_webhook_events
    WHERE stripe_event_id = event_id AND status = 'completed'
  ) INTO event_exists;

  RETURN event_exists;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as processing (prevents concurrent processing)
CREATE OR REPLACE FUNCTION start_processing_stripe_event(
  event_id VARCHAR,
  event_type_param VARCHAR,
  event_data_param JSONB
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Try to insert the event
  INSERT INTO stripe_webhook_events (stripe_event_id, event_type, event_data, status)
  VALUES (event_id, event_type_param, event_data_param, 'processing')
  ON CONFLICT (stripe_event_id) DO NOTHING;

  -- Return true if we successfully inserted (i.e., we should process it)
  -- Return false if event already exists (already being processed or completed)
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as completed
CREATE OR REPLACE FUNCTION complete_stripe_event(event_id VARCHAR)
RETURNS VOID AS $$
BEGIN
  UPDATE stripe_webhook_events
  SET status = 'completed', processed_at = NOW()
  WHERE stripe_event_id = event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to mark event as failed
CREATE OR REPLACE FUNCTION fail_stripe_event(event_id VARCHAR, error_msg TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE stripe_webhook_events
  SET status = 'failed', error_message = error_msg, processed_at = NOW()
  WHERE stripe_event_id = event_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE stripe_webhook_events IS
'Tracks all Stripe webhook events to prevent replay attacks.
Each Stripe event ID can only be processed once (UNIQUE constraint).
This prevents attackers from replaying legitimate webhooks to get free memberships.';

COMMENT ON FUNCTION is_stripe_event_processed IS
'Returns true if the Stripe event has already been successfully processed.
Use this to prevent replay attacks.';

COMMENT ON FUNCTION start_processing_stripe_event IS
'Marks a Stripe event as being processed. Returns true if this is the first time
processing this event. Returns false if event was already processed (replay attack).
Uses ON CONFLICT to handle race conditions.';

-- Grant permissions
GRANT ALL ON stripe_webhook_events TO thestudio_admin;
GRANT ALL ON stripe_webhook_events_id_seq TO thestudio_admin;

-- Cleanup old events (optional - run monthly)
-- Keeps last 90 days of events for audit trail
CREATE OR REPLACE FUNCTION cleanup_old_stripe_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM stripe_webhook_events
  WHERE processed_at < NOW() - INTERVAL '90 days' AND status = 'completed';

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_old_stripe_events IS
'Deletes successfully processed events older than 90 days.
Keeps failed events indefinitely for debugging.
Returns count of deleted events.';
