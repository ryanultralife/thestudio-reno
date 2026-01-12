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
