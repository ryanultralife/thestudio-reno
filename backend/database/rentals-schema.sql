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
