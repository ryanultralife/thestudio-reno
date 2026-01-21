-- ============================================
-- THE STUDIO RENO - CO-OP CLASS TYPES & SEED DATA
-- Co-op classes for Moran St location (purple #9333ea)
-- ============================================

-- ============================================
-- CO-OP CLASS TYPES (Purple color)
-- These are specialty classes offered by co-op teachers
-- ============================================

INSERT INTO class_types (name, duration, category, level, is_heated, description, color, default_capacity, drop_in_price, sort_order) VALUES
('Breathwork Journey', 75, 'meditation', 'all', false,
 'Guided breathwork session combining pranayama, holotropic breathing, and sound healing. Release stress and expand consciousness.',
 '#9333ea', 15, 35.00, 20),

('Sound Bath Meditation', 60, 'meditation', 'all', false,
 'Immersive sound healing with crystal singing bowls, gongs, and chimes. Deep relaxation and restoration.',
 '#9333ea', 20, 30.00, 21),

('Kundalini Awakening', 75, 'meditation', 'intermediate', false,
 'Dynamic breathwork, movement, and meditation to activate kundalini energy. Includes mantra and kriya.',
 '#9333ea', 15, 35.00, 22),

('Ecstatic Dance', 90, 'workshop', 'all', false,
 'Free-form movement journey through curated music. No steps to learn, just move authentically.',
 '#9333ea', 25, 25.00, 23),

('Yoga Nidra', 60, 'meditation', 'all', false,
 'Conscious deep sleep meditation for profound rest and healing. Lie back and let go.',
 '#9333ea', 20, 25.00, 24),

('Acro Yoga', 90, 'workshop', 'intermediate', false,
 'Partner-based yoga combining acrobatics, yoga, and Thai massage. Build trust and playfulness.',
 '#9333ea', 16, 30.00, 25),

('Reiki Circle', 60, 'meditation', 'all', false,
 'Group Reiki healing session with guided meditation. Experience energy healing in community.',
 '#9333ea', 12, 28.00, 26),

('Movement Medicine', 75, 'workshop', 'all', false,
 'Somatic movement practice exploring body awareness, release, and expression through guided improvisation.',
 '#9333ea', 18, 30.00, 27),

('Cacao Ceremony', 90, 'workshop', 'all', false,
 'Heart-opening ceremony with ceremonial cacao, intention setting, and guided meditation.',
 '#9333ea', 20, 40.00, 28),

('Pilates Mat', 60, 'power', 'all', false,
 'Classical Pilates mat work focusing on core strength, flexibility, and body awareness.',
 '#9333ea', 15, 28.00, 29)
ON CONFLICT DO NOTHING;

-- ============================================
-- CREATE SAMPLE CO-OP TEACHERS
-- ============================================

-- Luna - Breathwork (already in monthly contract)
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'luna@healingarts.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Luna',
  'Martinez',
  '775-555-0201',
  'teacher',
  true
) ON CONFLICT (email) DO NOTHING;

INSERT INTO teachers (user_id, title, bio, specialties, is_coop_teacher, coop_tier)
SELECT id, 'Certified Breathwork Facilitator',
       'Luna guides transformative breathwork journeys, helping clients release emotional blockages and tap into expanded states of awareness. Trained in holotropic and pranayama traditions.',
       ARRAY['Breathwork', 'Sound Healing', 'Meditation'],
       TRUE, 'monthly_tenant'
FROM users WHERE email = 'luna@healingarts.com'
ON CONFLICT DO NOTHING;

-- Kai - Sound Healer
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'kai@soundalchemy.com',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Kai',
  'Thompson',
  '775-555-0202',
  'teacher',
  true
) ON CONFLICT (email) DO NOTHING;

INSERT INTO teachers (user_id, title, bio, specialties, is_coop_teacher, coop_tier)
SELECT id, 'Sound Healing Practitioner',
       'Kai creates immersive sonic landscapes with crystal bowls, gongs, and voice. Each session is a unique journey into deep relaxation and cellular healing.',
       ARRAY['Sound Bath', 'Crystal Bowls', 'Vocal Toning'],
       TRUE, 'coop_rental'
FROM users WHERE email = 'kai@soundalchemy.com'
ON CONFLICT DO NOTHING;

-- Maya - Movement/Dance
INSERT INTO users (email, password_hash, first_name, last_name, phone, role, email_verified)
VALUES (
  'maya@movementmedicine.co',
  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.FVnWxX5dGE6u/.',
  'Maya',
  'Rivera',
  '775-555-0203',
  'teacher',
  true
) ON CONFLICT (email) DO NOTHING;

INSERT INTO teachers (user_id, title, bio, specialties, is_coop_teacher, coop_tier)
SELECT id, 'Movement Facilitator',
       'Maya weaves together somatic practices, dance, and mindfulness to help people reconnect with their bodies and authentic expression.',
       ARRAY['Ecstatic Dance', 'Movement Medicine', 'Somatics'],
       TRUE, 'coop_rental'
FROM users WHERE email = 'maya@movementmedicine.co'
ON CONFLICT DO NOTHING;

-- ============================================
-- ADD CO-OP FIELDS TO TEACHERS TABLE (if not exists)
-- ============================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teachers' AND column_name = 'is_coop_teacher') THEN
    ALTER TABLE teachers ADD COLUMN is_coop_teacher BOOLEAN DEFAULT FALSE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'teachers' AND column_name = 'coop_tier') THEN
    ALTER TABLE teachers ADD COLUMN coop_tier VARCHAR(30) CHECK (coop_tier IN ('coop_rental', 'monthly_tenant'));
  END IF;
END $$;

-- ============================================
-- CREATE SAMPLE CO-OP CLASSES FOR MORAN
-- These are classes in the upcoming weeks
-- ============================================

DO $$
DECLARE
  loc_moran UUID;
  room_small UUID;
  room_large UUID;
  teacher_luna UUID;
  teacher_kai UUID;
  teacher_maya UUID;
  ct_breathwork UUID;
  ct_soundbath UUID;
  ct_ecstatic UUID;
  ct_nidra UUID;
  ct_movement UUID;
  check_date DATE := CURRENT_DATE;
  end_date DATE := CURRENT_DATE + INTERVAL '14 days';
BEGIN
  -- Get location and rooms
  SELECT id INTO loc_moran FROM locations WHERE short_name = 'Moran St';
  SELECT r.id INTO room_small FROM rooms r JOIN locations l ON r.location_id = l.id
    WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_small';
  SELECT r.id INTO room_large FROM rooms r JOIN locations l ON r.location_id = l.id
    WHERE l.short_name = 'Moran St' AND r.room_type = 'yoga_large';

  -- Get co-op teachers
  SELECT t.id INTO teacher_luna FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.email = 'luna@healingarts.com';
  SELECT t.id INTO teacher_kai FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.email = 'kai@soundalchemy.com';
  SELECT t.id INTO teacher_maya FROM teachers t JOIN users u ON t.user_id = u.id WHERE u.email = 'maya@movementmedicine.co';

  -- Get class types
  SELECT id INTO ct_breathwork FROM class_types WHERE name = 'Breathwork Journey';
  SELECT id INTO ct_soundbath FROM class_types WHERE name = 'Sound Bath Meditation';
  SELECT id INTO ct_ecstatic FROM class_types WHERE name = 'Ecstatic Dance';
  SELECT id INTO ct_nidra FROM class_types WHERE name = 'Yoga Nidra';
  SELECT id INTO ct_movement FROM class_types WHERE name = 'Movement Medicine';

  -- Only proceed if we have the required data
  IF loc_moran IS NULL OR ct_breathwork IS NULL THEN
    RAISE NOTICE 'Missing required data, skipping co-op class creation';
    RETURN;
  END IF;

  WHILE check_date <= end_date LOOP
    -- Luna's Breathwork - Tuesdays and Saturdays at 6pm (monthly tenant - Small Room)
    IF EXTRACT(DOW FROM check_date) = 2 THEN -- Tuesday
      INSERT INTO classes (class_type_id, teacher_id, location_id, room_id, date, start_time, end_time, capacity,
                          class_model, coop_drop_in_price, coop_member_price)
      VALUES (ct_breathwork, teacher_luna, loc_moran, room_small, check_date, '18:00', '19:15', 15,
              'monthly_tenant', 35.00, 26.25)
      ON CONFLICT DO NOTHING;
    END IF;

    IF EXTRACT(DOW FROM check_date) = 6 THEN -- Saturday
      INSERT INTO classes (class_type_id, teacher_id, location_id, room_id, date, start_time, end_time, capacity,
                          class_model, coop_drop_in_price, coop_member_price)
      VALUES (ct_breathwork, teacher_luna, loc_moran, room_small, check_date, '17:00', '18:15', 15,
              'monthly_tenant', 35.00, 26.25)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Kai's Sound Bath - Fridays at 7:30pm (co-op rental - Large Room)
    IF EXTRACT(DOW FROM check_date) = 5 AND teacher_kai IS NOT NULL THEN -- Friday
      INSERT INTO classes (class_type_id, teacher_id, location_id, room_id, date, start_time, end_time, capacity,
                          class_model, coop_drop_in_price, coop_member_price)
      VALUES (ct_soundbath, teacher_kai, loc_moran, room_large, check_date, '19:30', '20:30', 20,
              'coop_rental', 30.00, 22.50)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Maya's Ecstatic Dance - Sundays at 4pm (co-op rental - Large Room)
    IF EXTRACT(DOW FROM check_date) = 0 AND teacher_maya IS NOT NULL THEN -- Sunday
      INSERT INTO classes (class_type_id, teacher_id, location_id, room_id, date, start_time, end_time, capacity,
                          class_model, coop_drop_in_price, coop_member_price)
      VALUES (ct_ecstatic, teacher_maya, loc_moran, room_large, check_date, '16:00', '17:30', 25,
              'coop_rental', 25.00, 18.75)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Yoga Nidra - Wednesdays at 7pm (Luna, monthly tenant - Small Room)
    IF EXTRACT(DOW FROM check_date) = 3 THEN -- Wednesday
      INSERT INTO classes (class_type_id, teacher_id, location_id, room_id, date, start_time, end_time, capacity,
                          class_model, coop_drop_in_price, coop_member_price)
      VALUES (ct_nidra, teacher_luna, loc_moran, room_small, check_date, '19:00', '20:00', 12,
              'monthly_tenant', 25.00, 18.75)
      ON CONFLICT DO NOTHING;
    END IF;

    -- Movement Medicine - Thursdays at 6pm (Maya, co-op rental - Large Room)
    IF EXTRACT(DOW FROM check_date) = 4 AND teacher_maya IS NOT NULL THEN -- Thursday
      INSERT INTO classes (class_type_id, teacher_id, location_id, room_id, date, start_time, end_time, capacity,
                          class_model, coop_drop_in_price, coop_member_price)
      VALUES (ct_movement, teacher_maya, loc_moran, room_large, check_date, '18:00', '19:15', 18,
              'coop_rental', 30.00, 22.50)
      ON CONFLICT DO NOTHING;
    END IF;

    check_date := check_date + INTERVAL '1 day';
  END LOOP;
END $$;

-- ============================================
-- DONE
-- ============================================

SELECT 'Co-op seed data loaded!' as status;
SELECT COUNT(*) as coop_class_types FROM class_types WHERE color = '#9333ea';
SELECT COUNT(*) as coop_classes FROM classes WHERE class_model IN ('coop_rental', 'monthly_tenant');
