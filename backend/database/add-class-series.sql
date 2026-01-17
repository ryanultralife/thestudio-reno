-- Add support for multi-week programs, workshops, and teacher trainings
-- Examples: 200-hour YTT, 8-week meditation series, weekend intensives

-- ============================================
-- CLASS SERIES / PROGRAMS TABLE
-- ============================================

CREATE TABLE class_series (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic Info
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) CHECK (category IN ('teacher_training', 'workshop_series', 'intensive', 'retreat', 'specialty')),

    -- Scheduling
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_hours DECIMAL(6,2), -- e.g., 200.00 for YTT
    total_sessions INT, -- Number of individual class sessions

    -- Pricing
    total_price DECIMAL(10,2) NOT NULL, -- Full program price
    deposit_amount DECIMAL(10,2), -- Required deposit (if applicable)
    allow_payment_plan BOOLEAN DEFAULT FALSE,
    payment_plan_installments INT, -- Number of installments
    payment_plan_interval VARCHAR(20) CHECK (payment_plan_interval IN ('weekly', 'monthly', 'custom')),

    -- Capacity
    min_participants INT DEFAULT 5,
    max_participants INT NOT NULL,

    -- Co-op/Community tracking
    is_coop_series BOOLEAN DEFAULT FALSE,
    created_by UUID REFERENCES users(id), -- Teacher who created this

    -- Requirements
    prerequisites TEXT, -- e.g., "Must have 1 year of yoga experience"
    materials_included TEXT, -- e.g., "Includes manual, certificate"

    -- Status
    is_published BOOLEAN DEFAULT FALSE,
    is_full BOOLEAN DEFAULT FALSE,
    is_cancelled BOOLEAN DEFAULT FALSE,
    registration_deadline DATE,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_series_dates ON class_series(start_date, end_date);
CREATE INDEX idx_series_category ON class_series(category);
CREATE INDEX idx_series_created_by ON class_series(created_by);

-- ============================================
-- LINK CLASSES TO SERIES
-- ============================================

ALTER TABLE classes ADD COLUMN IF NOT EXISTS series_id UUID REFERENCES class_series(id) ON DELETE CASCADE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS session_number INT; -- 1, 2, 3... for ordering

CREATE INDEX idx_classes_series ON classes(series_id, session_number);

-- ============================================
-- SERIES REGISTRATIONS
-- ============================================

CREATE TABLE series_registrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Who and What
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    series_id UUID NOT NULL REFERENCES class_series(id) ON DELETE CASCADE,

    -- Registration Details
    registration_date TIMESTAMPTZ DEFAULT NOW(),
    status VARCHAR(20) CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled', 'waitlist')) DEFAULT 'pending',

    -- Payment Tracking
    total_paid DECIMAL(10,2) DEFAULT 0.00,
    payment_plan_active BOOLEAN DEFAULT FALSE,
    next_payment_due DATE,
    next_payment_amount DECIMAL(10,2),

    -- Notes
    special_requests TEXT,
    admin_notes TEXT,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, series_id)
);

CREATE INDEX idx_series_reg_user ON series_registrations(user_id);
CREATE INDEX idx_series_reg_series ON series_registrations(series_id);
CREATE INDEX idx_series_reg_status ON series_registrations(status);

-- ============================================
-- SERIES PAYMENTS (for payment plans)
-- ============================================

CREATE TABLE series_payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    registration_id UUID NOT NULL REFERENCES series_registrations(id) ON DELETE CASCADE,

    -- Payment Details
    amount DECIMAL(10,2) NOT NULL,
    payment_type VARCHAR(20) CHECK (payment_type IN ('deposit', 'installment', 'final', 'full')) DEFAULT 'installment',
    payment_method VARCHAR(20) CHECK (payment_method IN ('card', 'cash', 'check', 'transfer', 'other')),

    -- Status
    status VARCHAR(20) CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
    due_date DATE,
    paid_date DATE,

    -- External References
    stripe_payment_intent_id VARCHAR(255),
    transaction_id UUID REFERENCES transactions(id), -- Link to main transactions table

    -- Notes
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_series_payments_reg ON series_payments(registration_id);
CREATE INDEX idx_series_payments_status ON series_payments(status, due_date);

-- ============================================
-- SERIES ATTENDANCE TRACKING
-- ============================================

CREATE TABLE series_attendance (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    registration_id UUID NOT NULL REFERENCES series_registrations(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES classes(id) ON DELETE CASCADE,

    -- Attendance
    attended BOOLEAN DEFAULT FALSE,
    check_in_time TIMESTAMPTZ,

    -- Notes
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(registration_id, class_id)
);

CREATE INDEX idx_series_attendance_reg ON series_attendance(registration_id);
CREATE INDEX idx_series_attendance_class ON series_attendance(class_id);

-- ============================================
-- SERIES COMPLETION CERTIFICATES
-- ============================================

CREATE TABLE series_certificates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    registration_id UUID NOT NULL REFERENCES series_registrations(id) ON DELETE CASCADE,

    -- Certificate Details
    certificate_number VARCHAR(50) UNIQUE, -- e.g., "YTT-200-2026-001"
    issue_date DATE NOT NULL,
    hours_completed DECIMAL(6,2), -- Actual hours attended

    -- PDF Storage (if generated)
    pdf_url TEXT,

    -- Notes
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(registration_id)
);

CREATE INDEX idx_certificates_series ON series_certificates(registration_id);

-- ============================================
-- PERMISSIONS FOR SERIES MANAGEMENT
-- ============================================

INSERT INTO permissions (name, description) VALUES
    ('series.create', 'Create class series and programs'),
    ('series.edit_own', 'Edit own class series'),
    ('series.delete_own', 'Delete own class series'),
    ('series.view_all', 'View all series'),
    ('series.manage_all', 'Manage all series (admin)'),
    ('series.manage_registrations', 'Manage series registrations'),
    ('series.issue_certificates', 'Issue completion certificates')
ON CONFLICT (name) DO NOTHING;

-- Grant series permissions to teachers (for co-op series)
INSERT INTO role_permissions (role, permission_id)
SELECT 'teacher', id FROM permissions
WHERE name IN ('series.create', 'series.edit_own', 'series.delete_own', 'series.view_all')
ON CONFLICT DO NOTHING;

-- Grant admin permissions to admin role
INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions
WHERE name LIKE 'series.%'
ON CONFLICT DO NOTHING;

-- ============================================
-- EXAMPLE DATA FOR TESTING
-- ============================================

-- Example: 200-Hour Yoga Teacher Training
-- (Commented out - uncomment to test)

/*
INSERT INTO class_series (
    name,
    description,
    category,
    start_date,
    end_date,
    total_hours,
    total_sessions,
    total_price,
    deposit_amount,
    allow_payment_plan,
    payment_plan_installments,
    payment_plan_interval,
    max_participants,
    is_coop_series,
    prerequisites,
    materials_included,
    registration_deadline
) VALUES (
    '200-Hour Yoga Teacher Training',
    'Comprehensive yoga teacher training program covering asana, philosophy, anatomy, and teaching methodology. Certified by Yoga Alliance.',
    'teacher_training',
    '2026-02-01',
    '2026-05-31',
    200.00,
    30,
    2995.00,
    500.00,
    TRUE,
    4,
    'monthly',
    20,
    FALSE,
    '1+ year regular yoga practice, instructor approval required',
    'Training manual, anatomy charts, certification upon completion',
    '2026-01-15'
);
*/

-- Example: 8-Week Meditation Series
/*
INSERT INTO class_series (
    name,
    description,
    category,
    start_date,
    end_date,
    total_hours,
    total_sessions,
    total_price,
    max_participants,
    is_coop_series,
    registration_deadline
) VALUES (
    '8-Week Mindfulness Meditation Series',
    'Learn the foundations of mindfulness meditation in this supportive 8-week program.',
    'workshop_series',
    '2026-03-01',
    '2026-04-26',
    16.00,
    8,
    199.00,
    15,
    TRUE,
    '2026-02-25'
);
*/

COMMENT ON TABLE class_series IS 'Multi-week programs, teacher trainings, workshop series, and retreats';
COMMENT ON TABLE series_registrations IS 'User registrations for multi-week programs';
COMMENT ON TABLE series_payments IS 'Payment tracking for series with payment plans';
COMMENT ON TABLE series_attendance IS 'Attendance tracking across series sessions';
COMMENT ON TABLE series_certificates IS 'Completion certificates for graduated participants';
