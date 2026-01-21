-- ============================================
-- CO-OP TEACHING MODEL - DATABASE SCHEMA
-- The Studio Reno
-- ============================================

-- ============================================
-- 1. ROOMS (Required for Co-op)
-- ============================================

CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    capacity INT DEFAULT 20,
    amenities TEXT[],
    photo_url TEXT,

    -- Co-op configuration
    allows_coop BOOLEAN DEFAULT false,
    coop_settings JSONB DEFAULT '{
        "advance_booking_days": 30,
        "min_booking_hours": 24,
        "max_weekly_hours_per_teacher": 10,
        "cancellation_hours": 48,
        "cancellation_fee_percent": 50,
        "buffer_minutes_between_rentals": 15
    }',

    is_active BOOLEAN DEFAULT TRUE,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rooms_location ON rooms(location_id);
CREATE INDEX IF NOT EXISTS idx_rooms_coop ON rooms(allows_coop) WHERE allows_coop = true;

-- Insert default rooms for existing locations
INSERT INTO rooms (location_id, name, capacity, allows_coop)
SELECT id, 'Main Studio', 20, true FROM locations WHERE short_name = 'S. Virginia'
ON CONFLICT DO NOTHING;

INSERT INTO rooms (location_id, name, capacity, allows_coop)
SELECT id, 'Practice Room', 12, true FROM locations WHERE short_name = 'S. Virginia'
ON CONFLICT DO NOTHING;

-- Add room_id to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);

-- ============================================
-- 2. RENTAL TIERS
-- Define pricing for different time slots
-- ============================================

CREATE TABLE IF NOT EXISTS rental_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,

    -- Tier identification
    name VARCHAR(50) NOT NULL,              -- "Off-Peak", "Standard", "Prime"
    slug VARCHAR(50) NOT NULL,              -- "off-peak", "standard", "prime"

    -- Pricing
    duration_minutes INTEGER NOT NULL DEFAULT 90,  -- Rental block duration
    price DECIMAL(10,2) NOT NULL,                  -- Price for this duration

    -- Time windows (when this tier applies)
    start_time TIME NOT NULL,               -- "06:00:00"
    end_time TIME NOT NULL,                 -- "09:00:00"
    days_of_week INTEGER[] NOT NULL DEFAULT ARRAY[0,1,2,3,4,5,6],  -- 0=Sun, 6=Sat

    -- Guidance for teachers
    suggested_class_price DECIMAL(10,2),    -- Recommended non-member price
    min_class_price DECIMAL(10,2),          -- Minimum allowed price (optional)
    max_class_price DECIMAL(10,2),          -- Maximum allowed price (optional)

    -- Status
    is_active BOOLEAN DEFAULT true,
    sort_order INTEGER DEFAULT 0,

    -- Metadata
    description TEXT,                       -- Notes about this tier

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(room_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_rental_tiers_lookup
    ON rental_tiers(room_id, is_active);


-- ============================================
-- 3. TEACHER RENTAL AGREEMENTS
-- Contract between studio and co-op teacher
-- ============================================

CREATE TABLE IF NOT EXISTS teacher_rental_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,

    -- Agreement type
    agreement_type VARCHAR(30) NOT NULL DEFAULT 'per_class',    -- 'per_class', 'monthly', 'weekly'

    -- For monthly/weekly agreements (dedicated time slots)
    room_id UUID REFERENCES rooms(id),
    recurring_schedule JSONB,               -- [{day: 1, start: "18:00", end: "19:30"}]
    fixed_rate DECIMAL(10,2),               -- Monthly/weekly flat fee

    -- For per-class agreements (pay as you go)
    -- Uses rental_tiers pricing

    -- Member credit handling
    credit_reimbursement_rate DECIMAL(10,2) DEFAULT 5.00,  -- Studio pays teacher per credit used

    -- Commission (optional - studio takes % of teacher revenue)
    commission_percent DECIMAL(5,2) DEFAULT 0,  -- Usually 0, but could be 5-10%

    -- Dates
    start_date DATE NOT NULL,
    end_date DATE,                          -- NULL = ongoing

    -- Status
    status VARCHAR(30) DEFAULT 'pending',   -- pending, active, suspended, terminated

    -- Approval workflow
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    approved_by UUID REFERENCES users(id),

    -- Termination
    terminated_at TIMESTAMPTZ,
    terminated_by UUID REFERENCES users(id),
    termination_reason TEXT,

    -- Requirements
    insurance_required BOOLEAN DEFAULT true,
    insurance_verified BOOLEAN DEFAULT false,
    insurance_expiry DATE,
    insurance_document_url TEXT,

    -- Contract
    contract_url TEXT,                      -- Signed agreement PDF
    contract_signed_at TIMESTAMPTZ,

    -- Notes
    notes TEXT,                             -- Internal notes

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agreements_teacher ON teacher_rental_agreements(teacher_id);
CREATE INDEX IF NOT EXISTS idx_agreements_status ON teacher_rental_agreements(status);


-- ============================================
-- 4. CO-OP FIELDS ON CLASSES TABLE
-- Extension fields for classes that are co-op
-- ============================================

ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_coop BOOLEAN DEFAULT false;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_price DECIMAL(10,2);           -- Non-member price
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_member_price DECIMAL(10,2);    -- Auto-calculated with discount
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_agreement_id UUID REFERENCES teacher_rental_agreements(id);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_rental_tier_id UUID REFERENCES rental_tiers(id);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_rental_fee DECIMAL(10,2);      -- Locked-in rental fee
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_status VARCHAR(30) DEFAULT 'scheduled';  -- scheduled, confirmed, cancelled, completed
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_visibility VARCHAR(30) DEFAULT 'public'; -- public, private, unlisted

CREATE INDEX IF NOT EXISTS idx_classes_coop ON classes(is_coop) WHERE is_coop = true;


-- ============================================
-- 5. RENTAL TRANSACTIONS
-- All financial transactions for co-op
-- ============================================

CREATE TABLE IF NOT EXISTS rental_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Links
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    agreement_id UUID REFERENCES teacher_rental_agreements(id),
    class_id UUID REFERENCES classes(id),
    booking_id UUID REFERENCES bookings(id),

    -- Transaction type
    transaction_type VARCHAR(50) NOT NULL,
    -- Types:
    -- 'rental_fee'           - Teacher owes studio for room
    -- 'class_revenue'        - Student payment to teacher
    -- 'credit_reimbursement' - Studio pays teacher for credit user
    -- 'commission'           - Studio takes % (if applicable)
    -- 'payout'               - Transfer to teacher's bank
    -- 'adjustment'           - Manual correction
    -- 'refund'               - Refund to student

    -- Amount (positive = credit to teacher, negative = debit)
    amount DECIMAL(10,2) NOT NULL,

    -- For class revenue, track the source
    payment_source VARCHAR(30),             -- 'card', 'cash', 'credit', 'comp'

    -- Status
    status VARCHAR(30) DEFAULT 'pending',   -- pending, processing, completed, failed, cancelled

    -- Stripe references
    stripe_payment_intent_id VARCHAR(255),  -- For class revenue
    stripe_transfer_id VARCHAR(255),        -- For payouts
    stripe_payout_id VARCHAR(255),          -- For bank transfers

    -- Timing
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period_start DATE,                      -- For aggregated transactions
    period_end DATE,

    -- Settlement
    settled_at TIMESTAMPTZ,
    settlement_batch_id UUID,               -- Group transactions in payout batch

    -- Details
    description TEXT,
    metadata JSONB DEFAULT '{}',

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_trans_teacher ON rental_transactions(teacher_id, transaction_date);
CREATE INDEX IF NOT EXISTS idx_rental_trans_class ON rental_transactions(class_id);
CREATE INDEX IF NOT EXISTS idx_rental_trans_status ON rental_transactions(status, transaction_type);
CREATE INDEX IF NOT EXISTS idx_rental_trans_settlement ON rental_transactions(settlement_batch_id);


-- ============================================
-- 6. MEMBER CO-OP CREDITS
-- Monthly credit allocations for members
-- ============================================

CREATE TABLE IF NOT EXISTS member_coop_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Links
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    membership_id UUID NOT NULL REFERENCES user_memberships(id) ON DELETE CASCADE,

    -- Period
    period_start DATE NOT NULL,             -- First day of month
    period_end DATE NOT NULL,               -- Last day of month

    -- Credits
    credits_allocated INTEGER NOT NULL,     -- Based on membership plan
    credits_used INTEGER DEFAULT 0,
    credits_expired INTEGER DEFAULT 0,      -- Set when period ends

    -- Timestamps
    allocated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,                 -- End of period

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    -- One allocation per user per period
    UNIQUE(user_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_coop_credits_user ON member_coop_credits(user_id, period_start DESC);
CREATE INDEX IF NOT EXISTS idx_coop_credits_active ON member_coop_credits(period_end)
    WHERE credits_used < credits_allocated;


-- ============================================
-- 7. CO-OP CREDIT USAGE LOG
-- Track individual credit uses
-- ============================================

CREATE TABLE IF NOT EXISTS coop_credit_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Links
    credit_allocation_id UUID NOT NULL REFERENCES member_coop_credits(id),
    booking_id UUID NOT NULL REFERENCES bookings(id),
    class_id UUID NOT NULL REFERENCES classes(id),
    user_id UUID NOT NULL REFERENCES users(id),
    teacher_id UUID NOT NULL REFERENCES teachers(id),

    -- Value
    credits_used INTEGER NOT NULL DEFAULT 1,
    reimbursement_amount DECIMAL(10,2),     -- Amount studio pays teacher
    reimbursement_transaction_id UUID REFERENCES rental_transactions(id),

    used_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_booking ON coop_credit_usage(booking_id);
CREATE INDEX IF NOT EXISTS idx_credit_usage_class ON coop_credit_usage(class_id);


-- ============================================
-- 8. TEACHER REFERRALS
-- Track when teachers bring in new members
-- ============================================

CREATE TABLE IF NOT EXISTS teacher_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Links
    teacher_id UUID NOT NULL REFERENCES teachers(id),
    user_id UUID NOT NULL REFERENCES users(id),
    first_booking_id UUID REFERENCES bookings(id),    -- Their first co-op booking
    membership_id UUID REFERENCES user_memberships(id),  -- If they bought membership

    -- Attribution
    referral_source VARCHAR(50) DEFAULT 'coop_class', -- coop_class, direct_link, code
    referral_code VARCHAR(50),

    -- Conversion tracking
    first_coop_booking_at TIMESTAMPTZ,
    converted_to_member_at TIMESTAMPTZ,

    -- Bonus
    bonus_type VARCHAR(30) DEFAULT 'room_credit',     -- room_credit, cash, none
    bonus_amount DECIMAL(10,2),
    bonus_applied BOOLEAN DEFAULT false,
    bonus_applied_at TIMESTAMPTZ,
    bonus_transaction_id UUID REFERENCES rental_transactions(id),

    -- Status
    status VARCHAR(30) DEFAULT 'pending',  -- pending, converted, expired, paid

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(teacher_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_teacher ON teacher_referrals(teacher_id, status);
CREATE INDEX IF NOT EXISTS idx_referrals_user ON teacher_referrals(user_id);


-- ============================================
-- 9. SETTLEMENT BATCHES
-- Group payouts for processing
-- ============================================

CREATE TABLE IF NOT EXISTS settlement_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Period
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    -- Totals
    total_rental_fees DECIMAL(10,2) DEFAULT 0,
    total_class_revenue DECIMAL(10,2) DEFAULT 0,
    total_credit_reimbursements DECIMAL(10,2) DEFAULT 0,
    total_commissions DECIMAL(10,2) DEFAULT 0,
    total_adjustments DECIMAL(10,2) DEFAULT 0,
    net_teacher_earnings DECIMAL(10,2) DEFAULT 0,

    -- Processing
    status VARCHAR(30) DEFAULT 'pending',   -- pending, processing, completed, failed
    processed_at TIMESTAMPTZ,

    -- Stripe
    stripe_batch_id VARCHAR(255),

    -- Errors
    error_message TEXT,
    error_details JSONB,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_settlement_batches ON settlement_batches(period_end DESC);


-- ============================================
-- 10. ADDITIONAL FIELDS ON EXISTING TABLES
-- ============================================

-- Membership types - Co-op benefit fields
ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS coop_credits_per_month INTEGER DEFAULT 0;
ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS coop_discount_percent INTEGER DEFAULT 25;
ALTER TABLE membership_types ADD COLUMN IF NOT EXISTS coop_access_enabled BOOLEAN DEFAULT true;

-- Teachers - Stripe Connect fields
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS stripe_connect_account_id VARCHAR(255);
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS stripe_connect_onboarding_complete BOOLEAN DEFAULT false;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN DEFAULT false;
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS stripe_connect_payouts_enabled BOOLEAN DEFAULT false;

-- Bookings - Co-op fields
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS booking_type VARCHAR(30) DEFAULT 'traditional';
-- booking_type values: 'traditional', 'coop_paid', 'coop_credit', 'coop_comp'
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coop_amount_paid DECIMAL(10,2);
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coop_credit_used BOOLEAN DEFAULT false;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS coop_credit_allocation_id UUID REFERENCES member_coop_credits(id);

-- Users - Referral tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by_teacher_id UUID REFERENCES teachers(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS coop_referral_code VARCHAR(50);


-- ============================================
-- 11. GLOBAL CO-OP SETTINGS
-- ============================================

INSERT INTO settings (key, value, description) VALUES
('coop', '{
    "enabled": true,
    "default_member_discount_percent": 25,
    "default_credit_reimbursement_rate": 5.00,
    "referral_bonus_type": "room_credit",
    "referral_bonus_amount": 25.00,
    "referral_conversion_window_days": 90,
    "payout_schedule": "weekly",
    "payout_day": 1,
    "minimum_payout_amount": 25.00,
    "auto_approve_agreements": false,
    "require_insurance": true,
    "allow_teacher_set_prices": true,
    "price_approval_required": false,
    "show_coop_classes_on_public_schedule": true,
    "show_teacher_earnings_to_teachers": true,
    "allow_private_coop_classes": true
}', 'Co-op teaching model settings')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ============================================
-- 12. CO-OP DISPLAY SETTINGS
-- ============================================

INSERT INTO settings (key, value, description) VALUES
('coop_display', '{
    "badge_text": "CO-OP",
    "badge_color": "#8B5CF6",
    "class_color": "#8B5CF6",
    "class_bg_color": "#EDE9FE",
    "border_style": "dashed",
    "show_teacher_photo": true,
    "show_price_on_schedule": true,
    "show_member_savings": true
}', 'Co-op class display settings')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ============================================
-- 13. CO-OP PERMISSIONS
-- ============================================

INSERT INTO permissions (name, description, category) VALUES
('coop.view_settings', 'View co-op settings', 'coop'),
('coop.manage_settings', 'Manage co-op settings', 'coop'),
('coop.view_agreements', 'View teacher agreements', 'coop'),
('coop.manage_agreements', 'Approve/suspend agreements', 'coop'),
('coop.view_own_agreement', 'View own co-op agreement', 'coop'),
('coop.create_class', 'Create co-op classes', 'coop'),
('coop.manage_own_classes', 'Manage own co-op classes', 'coop'),
('coop.view_own_roster', 'View roster for own co-op classes', 'coop'),
('coop.checkin_own_students', 'Check in students to own co-op classes', 'coop'),
('coop.view_own_earnings', 'View own co-op earnings', 'coop'),
('coop.view_all_earnings', 'View all teacher earnings', 'coop'),
('coop.view_own_reports', 'View own co-op reports', 'coop'),
('coop.view_all_reports', 'View all co-op reports', 'coop'),
('coop.manage_own_stripe', 'Manage own Stripe Connect account', 'coop'),
('coop.process_payouts', 'Process teacher payouts', 'coop'),
('coop.view_tiers', 'View rental tiers', 'coop'),
('coop.manage_tiers', 'Manage rental tiers', 'coop'),
('coop.book_class', 'Book co-op classes as customer', 'coop'),
('coop.use_credits', 'Use co-op credits for booking', 'coop'),
('coop.allocate_credits', 'Manually allocate co-op credits', 'coop')
ON CONFLICT (name) DO NOTHING;

-- Assign co-op permissions to roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'student', id FROM permissions WHERE name IN (
    'coop.book_class', 'coop.use_credits'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'teacher', id FROM permissions WHERE name IN (
    'coop.view_own_agreement', 'coop.create_class', 'coop.manage_own_classes',
    'coop.view_own_roster', 'coop.checkin_own_students', 'coop.view_own_earnings',
    'coop.view_own_reports', 'coop.manage_own_stripe', 'coop.view_tiers',
    'coop.book_class', 'coop.use_credits'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN (
    'coop.view_settings', 'coop.view_agreements', 'coop.manage_agreements',
    'coop.view_all_earnings', 'coop.view_all_reports', 'coop.view_tiers',
    'coop.manage_tiers', 'coop.allocate_credits', 'coop.book_class'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions WHERE name LIKE 'coop.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name LIKE 'coop.%'
ON CONFLICT DO NOTHING;


-- ============================================
-- 14. HELPER FUNCTIONS
-- ============================================

-- Update timestamp trigger for new tables
CREATE TRIGGER update_rooms_timestamp BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_rental_tiers_timestamp BEFORE UPDATE ON rental_tiers FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_agreements_timestamp BEFORE UPDATE ON teacher_rental_agreements FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_rental_trans_timestamp BEFORE UPDATE ON rental_transactions FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_coop_credits_timestamp BEFORE UPDATE ON member_coop_credits FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_referrals_timestamp BEFORE UPDATE ON teacher_referrals FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_settlement_timestamp BEFORE UPDATE ON settlement_batches FOR EACH ROW EXECUTE FUNCTION update_timestamp();


-- ============================================
-- 15. DEFAULT RENTAL TIERS
-- ============================================

-- Function to create default tiers for a room
CREATE OR REPLACE FUNCTION create_default_rental_tiers(room_uuid UUID)
RETURNS void AS $$
BEGIN
    -- Off-Peak: Early morning weekdays
    INSERT INTO rental_tiers (room_id, name, slug, duration_minutes, price, start_time, end_time, days_of_week, suggested_class_price, description)
    VALUES (room_uuid, 'Off-Peak', 'off-peak-early-weekday', 90, 75.00, '06:00', '09:00', ARRAY[1,2,3,4,5], 25.00, 'Early morning weekday slots')
    ON CONFLICT DO NOTHING;

    -- Off-Peak: Evenings
    INSERT INTO rental_tiers (room_id, name, slug, duration_minutes, price, start_time, end_time, days_of_week, suggested_class_price, description)
    VALUES (room_uuid, 'Off-Peak', 'off-peak-evening', 90, 75.00, '19:00', '21:00', ARRAY[0,1,2,3,4,5,6], 25.00, 'Evening slots')
    ON CONFLICT DO NOTHING;

    -- Off-Peak: Weekend early
    INSERT INTO rental_tiers (room_id, name, slug, duration_minutes, price, start_time, end_time, days_of_week, suggested_class_price, description)
    VALUES (room_uuid, 'Off-Peak', 'off-peak-weekend-early', 90, 75.00, '06:00', '09:00', ARRAY[0,6], 25.00, 'Early weekend slots')
    ON CONFLICT DO NOTHING;

    -- Standard: Weekday midday
    INSERT INTO rental_tiers (room_id, name, slug, duration_minutes, price, start_time, end_time, days_of_week, suggested_class_price, description)
    VALUES (room_uuid, 'Standard', 'standard-weekday', 90, 110.00, '09:00', '16:00', ARRAY[1,2,3,4,5], 30.00, 'Weekday midday slots')
    ON CONFLICT DO NOTHING;

    -- Standard: Weekend midday
    INSERT INTO rental_tiers (room_id, name, slug, duration_minutes, price, start_time, end_time, days_of_week, suggested_class_price, description)
    VALUES (room_uuid, 'Standard', 'standard-weekend', 90, 110.00, '09:00', '16:00', ARRAY[0,6], 30.00, 'Weekend midday slots')
    ON CONFLICT DO NOTHING;

    -- Prime: Weekday after-work
    INSERT INTO rental_tiers (room_id, name, slug, duration_minutes, price, start_time, end_time, days_of_week, suggested_class_price, description)
    VALUES (room_uuid, 'Prime', 'prime-weekday', 90, 140.00, '16:00', '19:00', ARRAY[1,2,3,4,5], 35.00, 'Weekday after-work prime time')
    ON CONFLICT DO NOTHING;

    -- Prime: Weekend afternoon
    INSERT INTO rental_tiers (room_id, name, slug, duration_minutes, price, start_time, end_time, days_of_week, suggested_class_price, description)
    VALUES (room_uuid, 'Prime', 'prime-weekend', 90, 140.00, '16:00', '19:00', ARRAY[0,6], 35.00, 'Weekend afternoon prime time')
    ON CONFLICT DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- Create default tiers for existing rooms
DO $$
DECLARE
    room_record RECORD;
BEGIN
    FOR room_record IN SELECT id FROM rooms WHERE allows_coop = true LOOP
        PERFORM create_default_rental_tiers(room_record.id);
    END LOOP;
END $$;


-- ============================================
-- 16. UPDATE MEMBERSHIP TYPES WITH CO-OP CREDITS
-- ============================================

-- Give unlimited members 4 co-op credits per month
UPDATE membership_types
SET coop_credits_per_month = 4
WHERE type = 'unlimited' AND coop_credits_per_month = 0;

-- Give class pack members proportional credits
UPDATE membership_types
SET coop_credits_per_month = 2
WHERE name LIKE '%10-Class%' AND coop_credits_per_month = 0;

UPDATE membership_types
SET coop_credits_per_month = 4
WHERE name LIKE '%20-Class%' AND coop_credits_per_month = 0;

UPDATE membership_types
SET coop_credits_per_month = 1
WHERE name LIKE '%5-Class%' AND coop_credits_per_month = 0;

-- Single class and intro offers don't get credits by default
UPDATE membership_types
SET coop_credits_per_month = 0
WHERE type IN ('single', 'intro');


-- ============================================
-- 17. VIEW FOR CO-OP CLASS DETAILS
-- ============================================

CREATE OR REPLACE VIEW coop_class_details AS
SELECT
    c.id,
    c.date,
    c.start_time,
    c.end_time,
    c.capacity,
    c.is_cancelled,
    c.is_coop,
    c.coop_price,
    c.coop_member_price,
    c.coop_status,
    c.coop_visibility,
    c.coop_rental_fee,
    ct.name as class_name,
    ct.duration,
    ct.category,
    ct.is_heated,
    ct.level,
    l.name as location_name,
    l.short_name as location_short,
    r.name as room_name,
    r.id as room_id,
    u.first_name as teacher_first_name,
    u.last_name as teacher_last_name,
    t.photo_url as teacher_photo,
    t.id as teacher_id,
    rt.name as rental_tier_name,
    rt.price as rental_tier_price,
    COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as booked_count,
    COUNT(b.id) FILTER (WHERE b.booking_type = 'coop_paid') as paid_bookings,
    COUNT(b.id) FILTER (WHERE b.booking_type = 'coop_credit') as credit_bookings,
    c.capacity - COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as spots_left
FROM classes c
JOIN class_types ct ON c.class_type_id = ct.id
JOIN locations l ON c.location_id = l.id
LEFT JOIN rooms r ON c.room_id = r.id
JOIN teachers t ON c.teacher_id = t.id
JOIN users u ON t.user_id = u.id
LEFT JOIN rental_tiers rt ON c.coop_rental_tier_id = rt.id
LEFT JOIN bookings b ON b.class_id = c.id
WHERE c.is_coop = true
GROUP BY c.id, ct.id, l.id, r.id, t.id, u.id, rt.id;


-- ============================================
-- 18. VIEW FOR TEACHER EARNINGS SUMMARY
-- ============================================

CREATE OR REPLACE VIEW teacher_earnings_summary AS
SELECT
    t.id as teacher_id,
    u.first_name,
    u.last_name,
    u.email,
    t.stripe_connect_account_id,
    t.stripe_connect_payouts_enabled,

    -- Revenue
    COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type = 'class_revenue' AND rt.status = 'completed'), 0) as total_revenue,
    COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type = 'credit_reimbursement' AND rt.status = 'completed'), 0) as total_reimbursements,

    -- Expenses (stored as negative)
    COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type = 'rental_fee' AND rt.status = 'completed'), 0) as total_rental_fees,
    COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type = 'commission' AND rt.status = 'completed'), 0) as total_commissions,

    -- Payouts
    COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type = 'payout' AND rt.status = 'completed'), 0) as total_paid_out,

    -- Pending
    COALESCE(SUM(rt.amount) FILTER (WHERE rt.status = 'pending'), 0) as pending_balance,

    -- Net (will be calculated in application)
    COALESCE(SUM(rt.amount) FILTER (WHERE rt.status = 'completed'), 0) as net_earnings

FROM teachers t
JOIN users u ON t.user_id = u.id
LEFT JOIN rental_transactions rt ON t.id = rt.teacher_id
WHERE EXISTS (
    SELECT 1 FROM teacher_rental_agreements tra
    WHERE tra.teacher_id = t.id
)
GROUP BY t.id, u.first_name, u.last_name, u.email;


-- ============================================
-- 19. JOB LOGS (Background Job Tracking)
-- ============================================

CREATE TABLE IF NOT EXISTS job_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL,    -- success, failed
    duration_ms INT,
    result JSONB,
    error_message TEXT,
    is_manual BOOLEAN DEFAULT FALSE,
    executed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_job_logs_name ON job_logs(job_name);
CREATE INDEX IF NOT EXISTS idx_job_logs_executed ON job_logs(executed_at DESC);


-- ============================================
-- DONE
-- ============================================
