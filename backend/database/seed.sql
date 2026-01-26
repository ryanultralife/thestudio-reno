-- ============================================
-- THE STUDIO RENO - SEED DATA
-- Based on actual thestudioreno.com data
-- Run after schema.sql for testing
-- ============================================

-- ============================================
-- OWNER/ADMIN (password: admin123)
-- ============================================

INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'rachelle@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Rachelle',
  'Lanning',
  '775-284-5545',
  'owner',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'RYT-500, Studio Owner',
  'Rachelle has been practicing Yoga since 2003 and teaching since 2011. She enjoys many different types of Yoga and incorporates several into her hot Vinyasa classes, typically holding poses and moving slowly through minimal sun salutations.',
  ARRAY['Hot Vinyasa', 'Slow Flow'], 50.00
FROM users WHERE email = 'rachelle@thestudioreno.com';

-- ============================================
-- STUDIO MANAGER (password: admin123)
-- ============================================

INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'kelly@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Kelly',
  'Aguilera',
  '775-284-5545',
  'manager',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'E-RYT 500, Studio Manager',
  'Kelly is an E-RYT 500 certified instructor and Studio Manager at The Studio Reno. She co-leads the Sacred Roots Vinyasa Teacher Training, designed for students and seekers interested in deepening their yoga practice.',
  ARRAY['Vinyasa', 'Teacher Training'], 50.00
FROM users WHERE email = 'kelly@thestudioreno.com';

-- ============================================
-- TEACHERS (password: teacher123)
-- ============================================

-- Keri Huddleston
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'keri@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Keri',
  'Huddleston',
  '775-555-0101',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'RYT-500',
  'Keri started practicing yoga in 2002 after injuring her back in a motorcycle accident. She began taking Iyengar yoga with her mentor, Nelda McGee, and soon moved on to Power and Ashtanga yoga. Keri completed her 200 hour training under Doug Swenson, renowned Ashtangi and creator of Sadhana Yoga Chi. She started teaching in 2005 and has an energetic style but aims for even challenging poses to be accessible for everyone.',
  ARRAY['Power Yoga', 'Ashtanga', 'Teacher Training'], 45.00
FROM users WHERE email = 'keri@thestudioreno.com';

-- Anne Spinner
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'anne@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Anne',
  'Spinner',
  '775-555-0102',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'RYT-200',
  'Anne brings a gentle, mindful approach to her yoga classes, focusing on breath awareness and alignment.',
  ARRAY['Yin Yoga', 'Beginners'], 40.00
FROM users WHERE email = 'anne@thestudioreno.com';

-- Erik Underwood
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'erik@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Erik',
  'Underwood',
  '775-555-0103',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'RYT-200',
  'Erik brings strength and mindfulness together in his dynamic classes, making advanced poses accessible to all levels.',
  ARRAY['Power Yoga', 'Vinyasa'], 40.00
FROM users WHERE email = 'erik@thestudioreno.com';

-- Dustin Barbagelata
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'dustin@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Dustin',
  'Barbagelata',
  '775-555-0104',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'RYT-200',
  'Dustin creates a welcoming space for all practitioners, with classes that build heat while maintaining focus on breath and intention.',
  ARRAY['Hot Yoga', 'Vinyasa'], 40.00
FROM users WHERE email = 'dustin@thestudioreno.com';

-- Ivy Case
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'ivy@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Ivy',
  'Case',
  '775-555-0105',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'RYT-200',
  'Ivy specializes in restorative practices that help students find deep relaxation and inner peace.',
  ARRAY['Yin Yoga', 'Restorative', 'Sound Healing'], 40.00
FROM users WHERE email = 'ivy@thestudioreno.com';

-- Melissa Sewell
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'melissa@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Melissa',
  'Sewell',
  '775-555-0106',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'RYT-200',
  'Melissa guides students through thoughtful sequences that honor the body and cultivate awareness.',
  ARRAY['Vinyasa', 'All Levels'], 40.00
FROM users WHERE email = 'melissa@thestudioreno.com';

-- Lexi Palmer (Sound Meditation)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'lexi@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Lexi',
  'Palmer',
  '775-555-0107',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'Sound Healer',
  'Lexi leads sound meditations and healing sessions using crystal bowls, gongs, and other instruments to guide students into deep states of relaxation.',
  ARRAY['Sound Meditation', 'Sound Healing', 'Meditation'], 45.00
FROM users WHERE email = 'lexi@thestudioreno.com';

-- Angie Fraley
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'angie@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Angie',
  'Fraley',
  '775-555-0108',
  'teacher',
  true
);

INSERT INTO teachers (user_id, title, bio, specialties, default_per_class_rate)
SELECT id, 'E-RYT 500',
  'Angie''s classes have been described as "inspiring and life changing." She brings passion and deep knowledge to every session, creating transformative experiences for her students.',
  ARRAY['Vinyasa', 'Power Yoga', 'Transformation'], 50.00
FROM users WHERE email = 'angie@thestudioreno.com';

-- ============================================
-- FRONT DESK STAFF
-- ============================================

INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'frontdesk@thestudioreno.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Front',
  'Desk',
  '775-284-5545',
  'front_desk',
  true
);

-- Admin account for testing
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
-- SAMPLE STUDENTS
-- ============================================

INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES
  ('jane.smith@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.', 'Jane', 'Smith', '775-555-1001', 'student', true),
  ('john.doe@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.', 'John', 'Doe', '775-555-1002', 'student', true),
  ('alice.brown@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.', 'Alice', 'Brown', '775-555-1003', 'student', true),
  ('michael.johnson@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.', 'Michael', 'Johnson', '775-555-1004', 'student', true),
  ('sarah.williams@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.', 'Sarah', 'Williams', '775-555-1005', 'student', true);

-- ============================================
-- SAMPLE MEMBERSHIPS FOR STUDENTS
-- ============================================

-- Jane gets monthly unlimited
INSERT INTO user_memberships (user_id, membership_type_id, end_date, status)
SELECT u.id, mt.id, CURRENT_DATE + INTERVAL '30 days', 'active'
FROM users u, membership_types mt
WHERE u.email = 'jane.smith@example.com' AND mt.name = 'Monthly Unlimited';

-- John gets 10-class pack
INSERT INTO user_memberships (user_id, membership_type_id, credits_remaining, end_date, status)
SELECT u.id, mt.id, 10, CURRENT_DATE + INTERVAL '365 days', 'active'
FROM users u, membership_types mt
WHERE u.email = 'john.doe@example.com' AND mt.name = '10-Class Pack';

-- Alice gets intro offer
INSERT INTO user_memberships (user_id, membership_type_id, end_date, status)
SELECT u.id, mt.id, CURRENT_DATE + INTERVAL '30 days', 'active'
FROM users u, membership_types mt
WHERE u.email = 'alice.brown@example.com' AND mt.name = 'Intro Month';

-- Michael gets annual unlimited
INSERT INTO user_memberships (user_id, membership_type_id, end_date, status)
SELECT u.id, mt.id, CURRENT_DATE + INTERVAL '365 days', 'active'
FROM users u, membership_types mt
WHERE u.email = 'michael.johnson@example.com' AND mt.name = 'Annual Unlimited';

-- Sarah gets 5-class pack
INSERT INTO user_memberships (user_id, membership_type_id, credits_remaining, end_date, status)
SELECT u.id, mt.id, 5, CURRENT_DATE + INTERVAL '60 days', 'active'
FROM users u, membership_types mt
WHERE u.email = 'sarah.williams@example.com' AND mt.name = '5-Class Pack';

-- ============================================
-- SCHEDULE TEMPLATES (Based on typical Studio Reno schedule)
-- Hours: Mon-Thu 8am-7:30pm, Fri 7am-1pm, Sat 9am-2pm, Sun 10am-7pm
-- ============================================

DO $$
DECLARE
  loc_main UUID;
  loc_moran UUID;
  t_rachelle UUID;
  t_kelly UUID;
  t_keri UUID;
  t_anne UUID;
  t_erik UUID;
  t_dustin UUID;
  t_ivy UUID;
  t_melissa UUID;
  t_lexi UUID;
  t_angie UUID;
  ct_vinyasa UUID;
  ct_hot UUID;
  ct_yin UUID;
  ct_beginner UUID;
  ct_meditation UUID;
  ct_power UUID;
  ct_mysore UUID;
  ct_all_levels UUID;
  ct_dynamic UUID;
BEGIN
  -- Get location IDs
  SELECT id INTO loc_main FROM locations WHERE short_name = 'S. Virginia';
  SELECT id INTO loc_moran FROM locations WHERE short_name = 'Moran St';

  -- Get teacher IDs
  SELECT t.id INTO t_rachelle FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Rachelle';
  SELECT t.id INTO t_kelly FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Kelly';
  SELECT t.id INTO t_keri FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Keri';
  SELECT t.id INTO t_anne FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Anne';
  SELECT t.id INTO t_erik FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Erik';
  SELECT t.id INTO t_dustin FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Dustin';
  SELECT t.id INTO t_ivy FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Ivy';
  SELECT t.id INTO t_melissa FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Melissa';
  SELECT t.id INTO t_lexi FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Lexi';
  SELECT t.id INTO t_angie FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Angie';

  -- Get class type IDs
  SELECT id INTO ct_vinyasa FROM class_types WHERE name = 'Vinyasa Flow';
  SELECT id INTO ct_hot FROM class_types WHERE name = 'Hot Vinyasa';
  SELECT id INTO ct_yin FROM class_types WHERE name = 'Yin Yoga';
  SELECT id INTO ct_beginner FROM class_types WHERE name = 'Beginners Yoga';
  SELECT id INTO ct_meditation FROM class_types WHERE name = 'Sound Meditation';
  SELECT id INTO ct_power FROM class_types WHERE name = 'Power & Peace';
  SELECT id INTO ct_mysore FROM class_types WHERE name = 'Mysore Ashtanga';
  SELECT id INTO ct_all_levels FROM class_types WHERE name = 'All Levels Flow';
  SELECT id INTO ct_dynamic FROM class_types WHERE name = 'Dynamic Release Flow';

  -- MONDAY (Mon-Thu: 8am - 7:30pm)
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES
    (ct_vinyasa, t_kelly, loc_main, 1, '06:00', 20),      -- Early bird vinyasa
    (ct_hot, t_rachelle, loc_main, 1, '09:00', 18),       -- Morning hot vinyasa
    (ct_all_levels, t_melissa, loc_main, 1, '12:00', 20), -- Lunch flow
    (ct_beginner, t_anne, loc_main, 1, '16:00', 15),      -- Afternoon beginners
    (ct_power, t_keri, loc_main, 1, '17:30', 20),         -- Evening power
    (ct_yin, t_ivy, loc_main, 1, '19:15', 20);            -- Evening yin

  -- TUESDAY
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES
    (ct_hot, t_dustin, loc_main, 2, '06:00', 18),
    (ct_vinyasa, t_angie, loc_main, 2, '09:00', 20),
    (ct_dynamic, t_erik, loc_main, 2, '12:00', 18),
    (ct_hot, t_rachelle, loc_main, 2, '17:30', 18),
    (ct_meditation, t_lexi, loc_moran, 2, '19:30', 25);

  -- WEDNESDAY
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES
    (ct_vinyasa, t_kelly, loc_main, 3, '06:00', 20),
    (ct_all_levels, t_anne, loc_main, 3, '09:00', 20),
    (ct_hot, t_dustin, loc_main, 3, '12:00', 18),
    (ct_power, t_angie, loc_main, 3, '17:30', 20),
    (ct_yin, t_ivy, loc_main, 3, '19:15', 20);

  -- THURSDAY
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES
    (ct_hot, t_rachelle, loc_main, 4, '06:00', 18),
    (ct_vinyasa, t_melissa, loc_main, 4, '09:00', 20),
    (ct_beginner, t_anne, loc_main, 4, '12:00', 15),
    (ct_dynamic, t_keri, loc_main, 4, '17:30', 18),
    (ct_meditation, t_lexi, loc_moran, 4, '19:30', 25);

  -- FRIDAY (7am - 1pm)
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES
    (ct_vinyasa, t_angie, loc_main, 5, '07:00', 20),
    (ct_hot, t_erik, loc_main, 5, '09:00', 18),
    (ct_yin, t_ivy, loc_main, 5, '11:00', 20);

  -- SATURDAY (9am - 2pm)
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES
    (ct_vinyasa, t_kelly, loc_main, 6, '09:00', 20),
    (ct_hot, t_rachelle, loc_main, 6, '11:00', 18),
    (ct_beginner, t_melissa, loc_main, 6, '13:00', 15);

  -- SUNDAY (10am - 7pm)
  INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
  VALUES
    (ct_yin, t_anne, loc_main, 0, '10:00', 20),
    (ct_all_levels, t_dustin, loc_main, 0, '12:00', 20),
    (ct_mysore, t_keri, loc_main, 0, '14:00', 12),
    (ct_meditation, t_lexi, loc_moran, 0, '17:00', 25);

END $$;

-- ============================================
-- GENERATE CLASSES FOR NEXT 2 WEEKS
-- ============================================

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
-- SAMPLE BOOKINGS (spread across classes)
-- ============================================

-- Book Jane into a few classes
INSERT INTO bookings (user_id, class_id, membership_id, status)
SELECT u.id, c.id, um.id, 'booked'
FROM users u
JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
CROSS JOIN (
  SELECT id FROM classes WHERE date >= CURRENT_DATE ORDER BY date, start_time LIMIT 3
) c
WHERE u.email = 'jane.smith@example.com';

-- Book John into tomorrow's classes
INSERT INTO bookings (user_id, class_id, membership_id, credits_used, status)
SELECT u.id, c.id, um.id, 1, 'booked'
FROM users u
JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
JOIN classes c ON c.date = CURRENT_DATE + INTERVAL '1 day'
WHERE u.email = 'john.doe@example.com'
LIMIT 2;

-- Update John's credits
UPDATE user_memberships um
SET credits_remaining = credits_remaining - 2
FROM users u
WHERE um.user_id = u.id AND u.email = 'john.doe@example.com' AND um.credits_remaining IS NOT NULL;

-- Book Alice into intro classes
INSERT INTO bookings (user_id, class_id, membership_id, status)
SELECT u.id, c.id, um.id, 'booked'
FROM users u
JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
CROSS JOIN (
  SELECT id FROM classes
  JOIN class_types ct ON classes.class_type_id = ct.id
  WHERE ct.name = 'Beginners Yoga' AND date >= CURRENT_DATE
  ORDER BY date LIMIT 2
) c
WHERE u.email = 'alice.brown@example.com';

-- ============================================
-- SAMPLE TRANSACTIONS
-- ============================================

INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, status)
SELECT u.id, 'membership_purchase', mt.price, mt.price, 'stripe', mt.id, 'completed'
FROM users u, membership_types mt
WHERE u.email = 'jane.smith@example.com' AND mt.name = 'Monthly Unlimited';

INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, status)
SELECT u.id, 'membership_purchase', mt.price, mt.price, 'stripe', mt.id, 'completed'
FROM users u, membership_types mt
WHERE u.email = 'john.doe@example.com' AND mt.name = '10-Class Pack';

INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, status)
SELECT u.id, 'membership_purchase', mt.price, mt.price, 'in_person', mt.id, 'completed'
FROM users u, membership_types mt
WHERE u.email = 'alice.brown@example.com' AND mt.name = 'Intro Month';

INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, status)
SELECT u.id, 'membership_purchase', mt.price, mt.price, 'stripe', mt.id, 'completed'
FROM users u, membership_types mt
WHERE u.email = 'michael.johnson@example.com' AND mt.name = 'Annual Unlimited';

INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, status)
SELECT u.id, 'membership_purchase', mt.price, mt.price, 'in_person', mt.id, 'completed'
FROM users u, membership_types mt
WHERE u.email = 'sarah.williams@example.com' AND mt.name = '5-Class Pack';

-- ============================================
-- CO-OP TEACHER AGREEMENTS (for teachers interested in co-op model)
-- ============================================

-- Keri signs up for co-op
INSERT INTO coop_teacher_agreements (teacher_id, status, signed_at)
SELECT t.id, 'active', NOW()
FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Keri';

-- Erik signs up for co-op
INSERT INTO coop_teacher_agreements (teacher_id, status, signed_at)
SELECT t.id, 'active', NOW()
FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Erik';

-- Lexi signs up for co-op
INSERT INTO coop_teacher_agreements (teacher_id, status, signed_at)
SELECT t.id, 'active', NOW()
FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.first_name = 'Lexi';

-- ============================================
-- DONE
-- ============================================

SELECT 'Seed data loaded successfully!' as status;
SELECT COUNT(*) as users FROM users;
SELECT COUNT(*) as teachers FROM teachers;
SELECT COUNT(*) as templates FROM class_schedule_templates;
SELECT COUNT(*) as classes FROM classes;
SELECT COUNT(*) as bookings FROM bookings;
