-- ============================================
-- DEMO DATA POPULATION SCRIPT
-- Creates realistic demo accounts, classes, bookings, and transactions
-- for testing reports, teacher insights, and workflows
-- ============================================

-- Clear existing demo data (optional - comment out if you want to keep existing data)
-- DELETE FROM bookings WHERE class_id IN (SELECT id FROM classes WHERE date >= CURRENT_DATE - INTERVAL '90 days');
-- DELETE FROM classes WHERE date >= CURRENT_DATE - INTERVAL '90 days';
-- DELETE FROM transactions WHERE created_at >= CURRENT_DATE - INTERVAL '90 days';

-- ============================================
-- DEMO USERS (Students)
-- ============================================
-- Password for all demo users: "demo123"
-- Bcrypt hash of "demo123": $2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2

INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active)
VALUES
    ('emma.wilson@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Emma', 'Wilson', '775-555-0101', 'student', true),
    ('michael.chen@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Michael', 'Chen', '775-555-0102', 'student', true),
    ('sofia.rodriguez@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Sofia', 'Rodriguez', '775-555-0103', 'student', true),
    ('james.patel@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'James', 'Patel', '775-555-0104', 'student', true),
    ('olivia.taylor@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Olivia', 'Taylor', '775-555-0105', 'student', true),
    ('noah.anderson@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Noah', 'Anderson', '775-555-0106', 'student', true),
    ('ava.martinez@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Ava', 'Martinez', '775-555-0107', 'student', true),
    ('lucas.brown@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Lucas', 'Brown', '775-555-0108', 'student', true),
    ('isabella.davis@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Isabella', 'Davis', '775-555-0109', 'student', true),
    ('ethan.garcia@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Ethan', 'Garcia', '775-555-0110', 'student', true),

    -- More students for variety
    ('mia.johnson@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Mia', 'Johnson', '775-555-0111', 'student', true),
    ('aiden.lee@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Aiden', 'Lee', '775-555-0112', 'student', true),
    ('charlotte.white@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Charlotte', 'White', '775-555-0113', 'student', true),
    ('mason.thomas@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Mason', 'Thomas', '775-555-0114', 'student', true),
    ('amelia.jackson@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Amelia', 'Jackson', '775-555-0115', 'student', true)
ON CONFLICT (email) DO NOTHING;

-- ============================================
-- DEMO TEACHERS
-- ============================================

INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active)
VALUES
    ('sarah.yoga@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Sarah', 'Thompson', '775-555-0201', 'teacher', true),
    ('raj.mindful@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Raj', 'Sharma', '775-555-0202', 'teacher', true),
    ('lisa.power@demo.com', '$2a$10$rH.zN8GHkBZ0yqzQ3j3JZeM8F.8Cy9vKjLyqJ1fP9YJGxH3cZ4mK2', 'Lisa', 'Chen', '775-555-0203', 'teacher', true)
ON CONFLICT (email) DO NOTHING;

-- Create teacher records
INSERT INTO teachers (user_id, bio, certifications, specialties, hourly_rate, is_active)
SELECT
    u.id,
    'Experienced yoga instructor passionate about helping students find balance and strength.',
    ARRAY['RYT-200', 'Yin Yoga Certified'],
    ARRAY['Vinyasa', 'Yin', 'Meditation'],
    75.00,
    true
FROM users u WHERE u.email = 'sarah.yoga@demo.com'
ON CONFLICT DO NOTHING;

INSERT INTO teachers (user_id, bio, certifications, specialties, hourly_rate, is_active)
SELECT
    u.id,
    'Mindfulness and meditation expert with 10+ years of teaching experience.',
    ARRAY['RYT-500', 'Meditation Teacher Training'],
    ARRAY['Meditation', 'Power', 'Philosophy'],
    85.00,
    true
FROM users u WHERE u.email = 'raj.mindful@demo.com'
ON CONFLICT DO NOTHING;

INSERT INTO teachers (user_id, bio, certifications, specialties, hourly_rate, is_active)
SELECT
    u.id,
    'Dynamic power yoga specialist focused on building strength and confidence.',
    ARRAY['RYT-200', 'Power Yoga Specialist'],
    ARRAY['Power', 'Flow', 'Heated'],
    80.00,
    true
FROM users u WHERE u.email = 'lisa.power@demo.com'
ON CONFLICT DO NOTHING;

-- ============================================
-- DEMO MEMBERSHIPS
-- ============================================

-- Give students various membership types
INSERT INTO user_memberships (user_id, membership_type_id, status, start_date, end_date, credits_remaining)
SELECT
    u.id,
    mt.id,
    'active',
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE + INTERVAL '30 days',
    NULL
FROM users u
JOIN membership_types mt ON mt.type = 'unlimited'
WHERE u.email IN ('emma.wilson@demo.com', 'michael.chen@demo.com', 'sofia.rodriguez@demo.com')
ON CONFLICT DO NOTHING;

INSERT INTO user_memberships (user_id, membership_type_id, status, start_date, end_date, credits_remaining)
SELECT
    u.id,
    mt.id,
    'active',
    CURRENT_DATE - INTERVAL '20 days',
    CURRENT_DATE + INTERVAL '10 days',
    FLOOR(RANDOM() * 5 + 3)::INT -- 3-7 credits remaining
FROM users u
JOIN membership_types mt ON mt.type = 'credits' AND mt.credits = 10
WHERE u.email IN ('james.patel@demo.com', 'olivia.taylor@demo.com', 'noah.anderson@demo.com', 'ava.martinez@demo.com')
ON CONFLICT DO NOTHING;

INSERT INTO user_memberships (user_id, membership_type_id, status, start_date, end_date, credits_remaining)
SELECT
    u.id,
    mt.id,
    'active',
    CURRENT_DATE - INTERVAL '60 days',
    NULL,
    FLOOR(RANDOM() * 15 + 10)::INT -- 10-24 credits remaining
FROM users u
JOIN membership_types mt ON mt.type = 'credits' AND mt.credits = 20
WHERE u.email IN ('lucas.brown@demo.com', 'isabella.davis@demo.com', 'mia.johnson@demo.com')
ON CONFLICT DO NOTHING;

-- ============================================
-- DEMO TRANSACTIONS
-- ============================================

-- Create purchase transactions for memberships
INSERT INTO transactions (user_id, membership_type_id, type, status, payment_method, total, created_at)
SELECT
    um.user_id,
    um.membership_type_id,
    'membership_purchase',
    'completed',
    CASE WHEN RANDOM() < 0.8 THEN 'card' ELSE 'cash' END,
    mt.price,
    um.start_date
FROM user_memberships um
JOIN membership_types mt ON um.membership_type_id = mt.id
WHERE um.status = 'active'
ON CONFLICT DO NOTHING;

-- ============================================
-- DEMO CLASSES (Last 90 days + Next 30 days)
-- ============================================

-- Generate classes for the past 90 days and next 30 days
DO $$
DECLARE
    demo_date DATE;
    demo_teacher_id UUID;
    demo_class_type_id UUID;
    demo_location_id UUID;
    morning_class_id UUID;
    midday_class_id UUID;
    evening_class_id UUID;
BEGIN
    -- Get demo data IDs
    SELECT id INTO demo_location_id FROM locations WHERE name = 'Main Studio' LIMIT 1;

    -- Loop through dates from 90 days ago to 30 days from now
    FOR demo_date IN
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '90 days',
            CURRENT_DATE + INTERVAL '30 days',
            '1 day'::interval
        )::DATE
    LOOP
        -- Skip Sundays
        IF EXTRACT(DOW FROM demo_date) != 0 THEN

            -- Morning class (9:00 AM) - Vinyasa Flow with Sarah
            SELECT t.id INTO demo_teacher_id FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.email = 'sarah.yoga@demo.com';
            SELECT id INTO demo_class_type_id FROM class_types WHERE name = 'Vinyasa Flow' LIMIT 1;

            INSERT INTO classes (class_type_id, teacher_id, location_id, date, start_time, end_time, capacity, is_cancelled)
            VALUES (demo_class_type_id, demo_teacher_id, demo_location_id, demo_date, '09:00', '10:00', 20, false)
            RETURNING id INTO morning_class_id;

            -- Midday class (12:00 PM) - Power Yoga with Lisa
            SELECT t.id INTO demo_teacher_id FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.email = 'lisa.power@demo.com';
            SELECT id INTO demo_class_type_id FROM class_types WHERE name = 'Power Yoga' LIMIT 1;

            INSERT INTO classes (class_type_id, teacher_id, location_id, date, start_time, end_time, capacity, is_cancelled)
            VALUES (demo_class_type_id, demo_teacher_id, demo_location_id, demo_date, '12:00', '13:00', 18, false)
            RETURNING id INTO midday_class_id;

            -- Evening class (18:00 / 6:00 PM) - Yin Yoga with Raj
            SELECT t.id INTO demo_teacher_id FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.email = 'raj.mindful@demo.com';
            SELECT id INTO demo_class_type_id FROM class_types WHERE name = 'Yin Yoga' LIMIT 1;

            INSERT INTO classes (class_type_id, teacher_id, location_id, date, start_time, end_time, capacity, is_cancelled)
            VALUES (demo_class_type_id, demo_teacher_id, demo_location_id, demo_date, '18:00', '19:15', 16, false)
            RETURNING id INTO evening_class_id;

        END IF;
    END LOOP;
END $$;

-- ============================================
-- DEMO BOOKINGS (For past classes only)
-- ============================================

-- Book students into past classes with varying attendance
DO $$
DECLARE
    past_class RECORD;
    student RECORD;
    booking_chance DECIMAL;
    checkin_chance DECIMAL;
BEGIN
    -- For each past class (not future)
    FOR past_class IN
        SELECT id, capacity, date
        FROM classes
        WHERE date < CURRENT_DATE
        ORDER BY date DESC
    LOOP
        -- Each student has a chance to book each class
        FOR student IN
            SELECT u.id as user_id, um.id as membership_id
            FROM users u
            LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
            WHERE u.role = 'student'
            ORDER BY RANDOM()
            LIMIT FLOOR(past_class.capacity * (0.6 + RANDOM() * 0.4))::INT -- 60-100% booked
        LOOP
            booking_chance := RANDOM();
            checkin_chance := RANDOM();

            -- Higher chance of booking recent classes
            IF past_class.date >= CURRENT_DATE - INTERVAL '30 days' OR booking_chance < 0.7 THEN
                -- Create booking
                INSERT INTO bookings (user_id, class_id, membership_id, status, booking_source, credits_used, booked_at)
                VALUES (
                    student.user_id,
                    past_class.id,
                    student.membership_id,
                    CASE
                        WHEN checkin_chance < 0.85 THEN 'checked_in' -- 85% show rate
                        WHEN checkin_chance < 0.95 THEN 'booked'      -- 10% no-show
                        ELSE 'cancelled'                               -- 5% cancellation
                    END,
                    'web',
                    CASE WHEN student.membership_id IS NOT NULL THEN 1 ELSE 0 END,
                    past_class.date - INTERVAL '2 days' + (RANDOM() * INTERVAL '47 hours')
                )
                ON CONFLICT DO NOTHING;
            END IF;
        END LOOP;
    END LOOP;
END $$;

-- ============================================
-- DEMO CO-OP CLASSES
-- ============================================

-- Sarah creates a co-op meditation series
DO $$
DECLARE
    sarah_user_id UUID;
    sarah_teacher_id UUID;
    meditation_type_id UUID;
    main_location_id UUID;
    series_date DATE;
BEGIN
    SELECT u.id, t.id INTO sarah_user_id, sarah_teacher_id
    FROM users u
    JOIN teachers t ON t.user_id = u.id
    WHERE u.email = 'sarah.yoga@demo.com';

    SELECT id INTO meditation_type_id FROM class_types WHERE name LIKE '%Meditation%' LIMIT 1;
    SELECT id INTO main_location_id FROM locations WHERE name = 'Main Studio' LIMIT 1;

    -- Create 4 past co-op classes and 4 future ones
    FOR i IN 1..8 LOOP
        series_date := CURRENT_DATE - INTERVAL '28 days' + (i * INTERVAL '7 days');

        INSERT INTO classes (
            class_type_id, teacher_id, location_id, date, start_time, end_time, capacity,
            is_coop_class, coop_price, coop_credits, created_by
        )
        VALUES (
            meditation_type_id, sarah_teacher_id, main_location_id,
            series_date, '19:30', '20:30', 12,
            true, 18.00, 1, sarah_user_id
        );
    END LOOP;
END $$;

-- ============================================
-- SUMMARY
-- ============================================

DO $$
DECLARE
    student_count INT;
    teacher_count INT;
    class_count INT;
    booking_count INT;
    membership_count INT;
BEGIN
    SELECT COUNT(*) INTO student_count FROM users WHERE role = 'student' AND email LIKE '%@demo.com';
    SELECT COUNT(*) INTO teacher_count FROM users WHERE role = 'teacher' AND email LIKE '%@demo.com';
    SELECT COUNT(*) INTO class_count FROM classes WHERE date >= CURRENT_DATE - INTERVAL '90 days';
    SELECT COUNT(*) INTO booking_count FROM bookings;
    SELECT COUNT(*) INTO membership_count FROM user_memberships WHERE status = 'active';

    RAISE NOTICE '';
    RAISE NOTICE '╔════════════════════════════════════════╗';
    RAISE NOTICE '║     DEMO DATA POPULATION COMPLETE      ║';
    RAISE NOTICE '╠════════════════════════════════════════╣';
    RAISE NOTICE '║  Students:    %                         ║', LPAD(student_count::TEXT, 26);
    RAISE NOTICE '║  Teachers:    %                         ║', LPAD(teacher_count::TEXT, 26);
    RAISE NOTICE '║  Classes:     %                         ║', LPAD(class_count::TEXT, 26);
    RAISE NOTICE '║  Bookings:    %                         ║', LPAD(booking_count::TEXT, 26);
    RAISE NOTICE '║  Memberships: %                         ║', LPAD(membership_count::TEXT, 26);
    RAISE NOTICE '╚════════════════════════════════════════╝';
    RAISE NOTICE '';
    RAISE NOTICE 'Demo Login Credentials:';
    RAISE NOTICE '  Students: emma.wilson@demo.com (and 14 others)';
    RAISE NOTICE '  Teachers: sarah.yoga@demo.com, raj.mindful@demo.com, lisa.power@demo.com';
    RAISE NOTICE '  Password: demo123';
    RAISE NOTICE '';
END $$;
