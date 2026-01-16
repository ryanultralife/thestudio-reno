-- ============================================
-- THE STUDIO RENO - CO-OP RENTAL LAYER
-- Space Rental & Hybrid Model Support
-- ============================================

-- ============================================
-- 1. ROOMS / SPACES
-- ============================================

CREATE TABLE rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    location_id UUID REFERENCES locations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    short_name VARCHAR(50),
    room_type VARCHAR(30) CHECK (room_type IN (
        'yoga_large', 'yoga_small', 'massage', 'tea_lounge', 'other'
    )),
    capacity INT DEFAULT 20,
    description TEXT,
    amenities TEXT[], -- ['mirrors', 'sound_system', 'props', 'heat']

    -- Rental availability
    available_for_rental BOOLEAN DEFAULT TRUE,
    available_for_monthly BOOLEAN DEFAULT TRUE,
    equipment_storage_available BOOLEAN DEFAULT FALSE,

    -- Default pricing (can be overridden by time slots)
    default_hourly_rate DECIMAL(10,2),
    default_block_rate DECIMAL(10,2), -- 1.5 hour block
    monthly_rate DECIMAL(10,2),

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rooms_location ON rooms(location_id);
CREATE INDEX idx_rooms_type ON rooms(room_type);

-- Seed rooms based on intent document
INSERT INTO rooms (location_id, name, short_name, room_type, capacity, amenities, available_for_rental, monthly_rate, description)
SELECT
    l.id,
    'Main Studio',
    'Main',
    'yoga_large',
    25,
    ARRAY['mirrors', 'sound_system', 'props', 'heat'],
    FALSE, -- OG location traditional only
    NULL,
    'Primary yoga room at OG location - traditional classes only'
FROM locations l WHERE l.short_name = 'S. Virginia';

INSERT INTO rooms (location_id, name, short_name, room_type, capacity, amenities, available_for_rental, monthly_rate, description)
SELECT
    l.id,
    'Tea Lounge',
    'Tea',
    'tea_lounge',
    15,
    ARRAY['seating', 'elixir_bar'],
    FALSE,
    NULL,
    'Community space + Elixir Bar'
FROM locations l WHERE l.short_name = 'S. Virginia';

INSERT INTO rooms (location_id, name, short_name, room_type, capacity, amenities, available_for_rental, available_for_monthly, monthly_rate, description)
SELECT
    l.id,
    'Massage Room 1',
    'Massage 1',
    'massage',
    1,
    ARRAY['table', 'sink'],
    TRUE,
    TRUE,
    600.00,
    'Private massage/treatment room - currently rented by esthetician'
FROM locations l WHERE l.short_name = 'S. Virginia';

INSERT INTO rooms (location_id, name, short_name, room_type, capacity, amenities, available_for_rental, available_for_monthly, monthly_rate, description)
SELECT
    l.id,
    'Massage Room 2',
    'Massage 2',
    'massage',
    1,
    ARRAY['table', 'sink'],
    TRUE,
    TRUE,
    600.00,
    'Private massage/treatment room - available for monthly tenant'
FROM locations l WHERE l.short_name = 'S. Virginia';

-- Moran St rooms (hybrid model)
INSERT INTO rooms (location_id, name, short_name, room_type, capacity, amenities, available_for_rental, equipment_storage_available, description)
SELECT
    l.id,
    'Large Yoga Room',
    'Large',
    'yoga_large',
    25,
    ARRAY['mirrors', 'sound_system', 'props'],
    TRUE,
    FALSE,
    'Main yoga space - traditional classes OR co-op rentals'
FROM locations l WHERE l.short_name = 'Moran St';

INSERT INTO rooms (location_id, name, short_name, room_type, capacity, amenities, available_for_rental, available_for_monthly, equipment_storage_available, monthly_rate, description)
SELECT
    l.id,
    'Small Room',
    'Small',
    'yoga_small',
    12,
    ARRAY['sound_system', 'props'],
    TRUE,
    TRUE,
    TRUE,
    850.00,
    'Intimate space for breathwork, sound baths, workshops - Luna (pilot co-op)'
FROM locations l WHERE l.short_name = 'Moran St';

-- ============================================
-- 2. RENTAL PRICING TIERS
-- ============================================

CREATE TABLE rental_pricing_tiers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- 'off_peak', 'standard', 'prime', 'weekend'

    -- Time slot definition
    day_types TEXT[] DEFAULT ARRAY['weekday'], -- ['weekday', 'weekend']
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Pricing
    block_duration_minutes INT DEFAULT 90, -- 1.5 hours
    price DECIMAL(10,2) NOT NULL,

    -- Break-even helper (for display)
    suggested_class_price DECIMAL(10,2),
    break_even_students INT,

    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_rental_pricing_room ON rental_pricing_tiers(room_id);

-- Seed pricing for Moran Large Yoga Room
INSERT INTO rental_pricing_tiers (room_id, name, day_types, start_time, end_time, price, suggested_class_price, break_even_students)
SELECT r.id, 'off_peak', ARRAY['weekday'], '13:00', '16:00', 100.00, 20.00, 5
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_large';

INSERT INTO rental_pricing_tiers (room_id, name, day_types, start_time, end_time, price, suggested_class_price, break_even_students)
SELECT r.id, 'standard', ARRAY['weekday'], '09:00', '13:00', 125.00, 22.00, 6
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_large';

INSERT INTO rental_pricing_tiers (room_id, name, day_types, start_time, end_time, price, suggested_class_price, break_even_students)
SELECT r.id, 'standard_afternoon', ARRAY['weekday'], '16:00', '17:30', 125.00, 22.00, 6
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_large';

INSERT INTO rental_pricing_tiers (room_id, name, day_types, start_time, end_time, price, suggested_class_price, break_even_students)
SELECT r.id, 'prime', ARRAY['weekday'], '17:30', '20:00', 150.00, 25.00, 6
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_large';

INSERT INTO rental_pricing_tiers (room_id, name, day_types, start_time, end_time, price, suggested_class_price, break_even_students)
SELECT r.id, 'weekend', ARRAY['weekend'], '06:00', '22:00', 150.00, 25.00, 6
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_large';

-- Seed pricing for Moran Small Room
INSERT INTO rental_pricing_tiers (room_id, name, day_types, start_time, end_time, price, suggested_class_price, break_even_students)
SELECT r.id, 'off_peak', ARRAY['weekday'], '13:00', '16:00', 75.00, 25.00, 3
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_small';

INSERT INTO rental_pricing_tiers (room_id, name, day_types, start_time, end_time, price, suggested_class_price, break_even_students)
SELECT r.id, 'standard', ARRAY['weekday'], '09:00', '13:00', 100.00, 28.00, 4
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_small';

INSERT INTO rental_pricing_tiers (room_id, name, day_types, start_time, end_time, price, suggested_class_price, break_even_students)
SELECT r.id, 'standard_afternoon', ARRAY['weekday'], '16:00', '17:30', 100.00, 28.00, 4
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_small';

INSERT INTO rental_pricing_tiers (room_id, name, day_types, start_time, end_time, price, suggested_class_price, break_even_students)
SELECT r.id, 'prime_weekend', ARRAY['weekday', 'weekend'], '17:30', '22:00', 125.00, 32.00, 4
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_small';

-- ============================================
-- 3. ROOM BOOKINGS (Single rentals)
-- ============================================

CREATE TABLE room_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id), -- Co-op teacher renting
    user_id UUID REFERENCES users(id), -- Non-teacher rental (future)

    -- Booking details
    date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    -- Pricing
    pricing_tier_id UUID REFERENCES rental_pricing_tiers(id),
    rental_price DECIMAL(10,2) NOT NULL,

    -- Payment status
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'paid', 'waived', 'refunded'
    )),
    stripe_payment_id VARCHAR(100),
    paid_at TIMESTAMPTZ,

    -- Linked class (if teacher creates a co-op class)
    class_id UUID REFERENCES classes(id),

    -- Status
    status VARCHAR(20) DEFAULT 'confirmed' CHECK (status IN (
        'pending', 'confirmed', 'cancelled', 'completed', 'no_show'
    )),

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_room_bookings_room ON room_bookings(room_id);
CREATE INDEX idx_room_bookings_teacher ON room_bookings(teacher_id);
CREATE INDEX idx_room_bookings_date ON room_bookings(date);
CREATE INDEX idx_room_bookings_status ON room_bookings(status);

-- ============================================
-- 4. MONTHLY RENTAL CONTRACTS
-- ============================================

CREATE TABLE monthly_rental_contracts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id),
    user_id UUID REFERENCES users(id), -- For non-teachers (massage therapist)

    -- Contract terms
    monthly_rate DECIMAL(10,2) NOT NULL,
    sessions_included INT, -- e.g., 8-10 sessions/month
    equipment_storage BOOLEAN DEFAULT FALSE,

    -- Duration
    start_date DATE NOT NULL,
    end_date DATE, -- NULL = ongoing
    initial_term_months INT DEFAULT 3, -- 3-month initial commitment

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
        'pending', 'active', 'paused', 'cancelled', 'expired'
    )),

    -- Stripe subscription
    stripe_subscription_id VARCHAR(100),

    -- Notes
    tenant_name VARCHAR(100), -- Display name (e.g., "Luna - Breathwork")
    tenant_type VARCHAR(50), -- 'breathwork', 'esthetician', 'massage', etc.
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_monthly_contracts_room ON monthly_rental_contracts(room_id);
CREATE INDEX idx_monthly_contracts_status ON monthly_rental_contracts(status);

-- Seed current tenants
-- Luna at Moran Small Room
INSERT INTO monthly_rental_contracts (room_id, monthly_rate, sessions_included, equipment_storage, start_date, initial_term_months, status, tenant_name, tenant_type, notes)
SELECT r.id, 850.00, 10, TRUE, CURRENT_DATE, 3, 'active', 'Luna - Breathwork', 'breathwork', 'Pilot co-op tenant. Member credits do NOT apply to her classes.'
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_small';

-- Esthetician at OG Massage Room 1
INSERT INTO monthly_rental_contracts (room_id, monthly_rate, sessions_included, equipment_storage, start_date, status, tenant_name, tenant_type)
SELECT r.id, 600.00, NULL, TRUE, CURRENT_DATE, 'active', 'Esthetician', 'esthetician'
FROM rooms r JOIN locations l ON r.location_id = l.id
WHERE l.short_name = 'S. Virginia' AND r.name = 'Massage Room 1';

-- ============================================
-- 5. CLASS MODEL EXTENSION
-- Add to classes table to distinguish traditional vs co-op
-- ============================================

ALTER TABLE classes ADD COLUMN IF NOT EXISTS class_model VARCHAR(20) DEFAULT 'traditional'
    CHECK (class_model IN ('traditional', 'coop_rental', 'monthly_tenant'));

ALTER TABLE classes ADD COLUMN IF NOT EXISTS room_id UUID REFERENCES rooms(id);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS room_booking_id UUID REFERENCES room_bookings(id);

-- Co-op class pricing (teacher sets their own)
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_drop_in_price DECIMAL(10,2);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_member_price DECIMAL(10,2); -- 25% off drop-in

CREATE INDEX idx_classes_model ON classes(class_model);
CREATE INDEX idx_classes_room ON classes(room_id);

-- ============================================
-- 6. MEMBER CO-OP BENEFITS
-- ============================================

-- Track monthly co-op credits per member
CREATE TABLE member_coop_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Monthly allocation
    credits_per_month INT DEFAULT 2,
    credits_remaining INT DEFAULT 2,

    -- Reset tracking
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(user_id, period_start)
);

CREATE INDEX idx_coop_credits_user ON member_coop_credits(user_id);
CREATE INDEX idx_coop_credits_period ON member_coop_credits(period_end);

-- Co-op class bookings (extends regular bookings)
CREATE TABLE coop_bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE UNIQUE,
    class_id UUID REFERENCES classes(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Pricing
    original_price DECIMAL(10,2) NOT NULL, -- Teacher's drop-in price
    member_discount_percent INT DEFAULT 25,
    final_price DECIMAL(10,2) NOT NULL,

    -- Credit usage
    used_coop_credit BOOLEAN DEFAULT FALSE,
    coop_credit_id UUID REFERENCES member_coop_credits(id),

    -- Payment
    payment_status VARCHAR(20) DEFAULT 'pending' CHECK (payment_status IN (
        'pending', 'paid', 'credit_used', 'refunded'
    )),
    stripe_payment_id VARCHAR(100),

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_coop_bookings_class ON coop_bookings(class_id);
CREATE INDEX idx_coop_bookings_user ON coop_bookings(user_id);

-- Settings: Max credits per co-op class
INSERT INTO settings (key, value, description) VALUES
('coop', '{
    "member_discount_percent": 25,
    "credits_per_month": 2,
    "max_credits_per_class": 3,
    "credits_rollover": false
}', 'Co-op rental settings')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

-- ============================================
-- 7. TEACHER REFERRALS
-- ============================================

CREATE TABLE teacher_referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referring_teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,
    referred_user_id UUID REFERENCES users(id) ON DELETE CASCADE,

    -- Referral tracking
    referral_source VARCHAR(50), -- 'signup_form', 'manual', etc.
    referral_date DATE DEFAULT CURRENT_DATE,

    -- Membership conversion
    converted_to_member BOOLEAN DEFAULT FALSE,
    membership_id UUID REFERENCES user_memberships(id),
    conversion_date DATE,

    -- Bonus tracking
    bonus_type VARCHAR(30) DEFAULT 'room_credit', -- 'room_credit', 'cash', 'percentage'
    bonus_amount DECIMAL(10,2) DEFAULT 25.00,
    bonus_status VARCHAR(20) DEFAULT 'pending' CHECK (bonus_status IN (
        'pending', 'approved', 'paid', 'expired', 'denied'
    )),
    bonus_paid_at TIMESTAMPTZ,

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),

    UNIQUE(referring_teacher_id, referred_user_id)
);

CREATE INDEX idx_referrals_teacher ON teacher_referrals(referring_teacher_id);
CREATE INDEX idx_referrals_status ON teacher_referrals(bonus_status);

-- Teacher room credits (from referrals)
CREATE TABLE teacher_room_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teacher_id UUID REFERENCES teachers(id) ON DELETE CASCADE,

    amount DECIMAL(10,2) NOT NULL,
    remaining DECIMAL(10,2) NOT NULL,

    -- Source
    source_type VARCHAR(30) CHECK (source_type IN (
        'referral_bonus', 'promotional', 'adjustment', 'refund'
    )),
    referral_id UUID REFERENCES teacher_referrals(id),

    -- Expiration
    expires_at DATE,

    -- Status
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN (
        'active', 'depleted', 'expired', 'cancelled'
    )),

    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teacher_credits_teacher ON teacher_room_credits(teacher_id);
CREATE INDEX idx_teacher_credits_status ON teacher_room_credits(status);

-- ============================================
-- 8. TRANSACTION TYPES FOR CO-OP
-- ============================================

-- Add new transaction types
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_type_check CHECK (type IN (
    'membership_purchase', 'drop_in', 'retail', 'gift_card_purchase',
    'gift_card_redemption', 'refund', 'adjustment', 'comp',
    -- New co-op types
    'room_rental', 'monthly_rental', 'coop_class', 'referral_bonus'
));

-- Link transactions to room bookings
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS room_booking_id UUID REFERENCES room_bookings(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS monthly_contract_id UUID REFERENCES monthly_rental_contracts(id);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS coop_booking_id UUID REFERENCES coop_bookings(id);

-- ============================================
-- 9. PERMISSIONS FOR CO-OP
-- ============================================

INSERT INTO permissions (name, description, category) VALUES
('room.view', 'View room availability', 'coop'),
('room.book', 'Book rooms for rental', 'coop'),
('room.manage', 'Manage rooms and pricing', 'coop'),
('coop.view_own', 'View own co-op classes', 'coop'),
('coop.create', 'Create co-op classes', 'coop'),
('coop.manage', 'Manage all co-op classes', 'coop'),
('referral.view_own', 'View own referrals', 'coop'),
('referral.manage', 'Manage referral program', 'coop'),
('contract.view', 'View rental contracts', 'coop'),
('contract.manage', 'Manage rental contracts', 'coop')
ON CONFLICT (name) DO NOTHING;

-- Grant co-op permissions to roles
INSERT INTO role_permissions (role, permission_id)
SELECT 'teacher', id FROM permissions WHERE name IN (
    'room.view', 'room.book', 'coop.view_own', 'coop.create', 'referral.view_own'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name IN (
    'room.view', 'room.book', 'room.manage', 'coop.view_own', 'coop.create', 'coop.manage',
    'referral.view_own', 'referral.manage', 'contract.view', 'contract.manage'
) ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'owner', id FROM permissions WHERE name LIKE 'room.%' OR name LIKE 'coop.%'
    OR name LIKE 'referral.%' OR name LIKE 'contract.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name LIKE 'room.%' OR name LIKE 'coop.%'
    OR name LIKE 'referral.%' OR name LIKE 'contract.%'
ON CONFLICT DO NOTHING;

-- ============================================
-- 10. HELPER FUNCTIONS
-- ============================================

-- Get rental price for a room at a specific time
CREATE OR REPLACE FUNCTION get_rental_price(
    p_room_id UUID,
    p_date DATE,
    p_start_time TIME
) RETURNS TABLE (
    tier_id UUID,
    tier_name VARCHAR,
    price DECIMAL,
    break_even INT
) AS $$
DECLARE
    day_type TEXT;
BEGIN
    -- Determine if weekend or weekday
    IF EXTRACT(DOW FROM p_date) IN (0, 6) THEN
        day_type := 'weekend';
    ELSE
        day_type := 'weekday';
    END IF;

    RETURN QUERY
    SELECT
        rpt.id,
        rpt.name,
        rpt.price,
        rpt.break_even_students
    FROM rental_pricing_tiers rpt
    WHERE rpt.room_id = p_room_id
        AND rpt.is_active = TRUE
        AND day_type = ANY(rpt.day_types)
        AND p_start_time >= rpt.start_time
        AND p_start_time < rpt.end_time
    LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Calculate member price for co-op class (25% off)
CREATE OR REPLACE FUNCTION calculate_coop_member_price(drop_in_price DECIMAL)
RETURNS DECIMAL AS $$
BEGIN
    RETURN ROUND(drop_in_price * 0.75, 2);
END;
$$ LANGUAGE plpgsql;

-- Check if member can use co-op credit for a class
CREATE OR REPLACE FUNCTION can_use_coop_credit(
    p_user_id UUID,
    p_class_id UUID
) RETURNS TABLE (
    can_use BOOLEAN,
    reason TEXT,
    credit_id UUID
) AS $$
DECLARE
    credits_used_in_class INT;
    max_credits_per_class INT := 3;
    member_credit RECORD;
BEGIN
    -- Get co-op settings
    SELECT (value->>'max_credits_per_class')::INT INTO max_credits_per_class
    FROM settings WHERE key = 'coop';

    -- Check credits already used in this class
    SELECT COUNT(*) INTO credits_used_in_class
    FROM coop_bookings
    WHERE class_id = p_class_id AND used_coop_credit = TRUE;

    IF credits_used_in_class >= max_credits_per_class THEN
        RETURN QUERY SELECT FALSE, 'Class has reached max credit spots (' || max_credits_per_class || ')', NULL::UUID;
        RETURN;
    END IF;

    -- Check if user has available credits
    SELECT * INTO member_credit
    FROM member_coop_credits
    WHERE user_id = p_user_id
        AND period_end >= CURRENT_DATE
        AND credits_remaining > 0
    ORDER BY period_end ASC
    LIMIT 1;

    IF member_credit IS NULL THEN
        RETURN QUERY SELECT FALSE, 'No co-op credits available', NULL::UUID;
        RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, 'Credit available', member_credit.id;
END;
$$ LANGUAGE plpgsql;

-- Reset monthly co-op credits (run monthly via cron)
CREATE OR REPLACE FUNCTION reset_monthly_coop_credits()
RETURNS void AS $$
DECLARE
    credits_per_month INT := 2;
BEGIN
    -- Get setting
    SELECT (value->>'credits_per_month')::INT INTO credits_per_month
    FROM settings WHERE key = 'coop';

    -- Create new credit allocation for all active members
    INSERT INTO member_coop_credits (user_id, credits_per_month, credits_remaining, period_start, period_end)
    SELECT
        um.user_id,
        credits_per_month,
        credits_per_month,
        DATE_TRUNC('month', CURRENT_DATE)::DATE,
        (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE
    FROM user_memberships um
    WHERE um.status = 'active'
        AND NOT EXISTS (
            SELECT 1 FROM member_coop_credits mcc
            WHERE mcc.user_id = um.user_id
            AND mcc.period_start = DATE_TRUNC('month', CURRENT_DATE)::DATE
        );
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- 11. VIEWS FOR CO-OP
-- ============================================

CREATE OR REPLACE VIEW room_availability AS
SELECT
    r.id as room_id,
    r.name as room_name,
    r.room_type,
    r.capacity,
    l.name as location_name,
    l.short_name as location_short,
    r.available_for_rental,
    r.available_for_monthly,
    r.monthly_rate,
    mrc.tenant_name as current_tenant,
    mrc.status as tenant_status
FROM rooms r
JOIN locations l ON r.location_id = l.id
LEFT JOIN monthly_rental_contracts mrc ON mrc.room_id = r.id AND mrc.status = 'active'
WHERE r.is_active = TRUE;

CREATE OR REPLACE VIEW coop_class_details AS
SELECT
    c.id,
    c.date,
    c.start_time,
    c.end_time,
    c.class_model,
    c.coop_drop_in_price,
    c.coop_member_price,
    c.capacity,
    ct.name as class_name,
    r.name as room_name,
    l.name as location_name,
    u.first_name as teacher_first_name,
    u.last_name as teacher_last_name,
    COUNT(cb.id) FILTER (WHERE cb.used_coop_credit = TRUE) as credits_used,
    (SELECT (value->>'max_credits_per_class')::INT FROM settings WHERE key = 'coop') as max_credits
FROM classes c
JOIN class_types ct ON c.class_type_id = ct.id
LEFT JOIN rooms r ON c.room_id = r.id
JOIN locations l ON c.location_id = l.id
JOIN teachers t ON c.teacher_id = t.id
JOIN users u ON t.user_id = u.id
LEFT JOIN coop_bookings cb ON cb.class_id = c.id
WHERE c.class_model IN ('coop_rental', 'monthly_tenant')
GROUP BY c.id, ct.id, r.id, l.id, t.id, u.id;

CREATE OR REPLACE VIEW teacher_referral_summary AS
SELECT
    t.id as teacher_id,
    u.first_name,
    u.last_name,
    COUNT(tr.id) as total_referrals,
    COUNT(tr.id) FILTER (WHERE tr.converted_to_member = TRUE) as conversions,
    SUM(tr.bonus_amount) FILTER (WHERE tr.bonus_status = 'paid') as total_bonus_paid,
    SUM(tr.bonus_amount) FILTER (WHERE tr.bonus_status = 'pending') as pending_bonus,
    COALESCE(SUM(trc.remaining), 0) as available_room_credits
FROM teachers t
JOIN users u ON t.user_id = u.id
LEFT JOIN teacher_referrals tr ON tr.referring_teacher_id = t.id
LEFT JOIN teacher_room_credits trc ON trc.teacher_id = t.id AND trc.status = 'active'
GROUP BY t.id, u.id;

-- ============================================
-- 12. TRIGGERS
-- ============================================

-- Auto-calculate member price when drop-in price is set
CREATE OR REPLACE FUNCTION auto_calc_member_price()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.coop_drop_in_price IS NOT NULL AND NEW.coop_member_price IS NULL THEN
        NEW.coop_member_price := calculate_coop_member_price(NEW.coop_drop_in_price);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calc_member_price
    BEFORE INSERT OR UPDATE ON classes
    FOR EACH ROW
    WHEN (NEW.class_model IN ('coop_rental', 'monthly_tenant'))
    EXECUTE FUNCTION auto_calc_member_price();

-- Update timestamps
CREATE TRIGGER update_rooms_timestamp BEFORE UPDATE ON rooms FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_room_bookings_timestamp BEFORE UPDATE ON room_bookings FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_monthly_contracts_timestamp BEFORE UPDATE ON monthly_rental_contracts FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_coop_credits_timestamp BEFORE UPDATE ON member_coop_credits FOR EACH ROW EXECUTE FUNCTION update_timestamp();
CREATE TRIGGER update_referrals_timestamp BEFORE UPDATE ON teacher_referrals FOR EACH ROW EXECUTE FUNCTION update_timestamp();
