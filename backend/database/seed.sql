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
