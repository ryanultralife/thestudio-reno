-- ============================================
-- CLASS TYPES UPDATE
-- Add colors to existing class types and add missing types
-- Run this after schema.sql to ensure consistency
-- ============================================

-- ============================================
-- 1. ADD COLORS TO EXISTING TRADITIONAL CLASS TYPES
-- Color scheme:
--   Flow: #f59e0b (amber)
--   Power: #ef4444 (red)
--   Yin/Restorative: #14b8a6 (teal)
--   Heated: #ea580c (orange)
--   Beginner: #22c55e (green)
--   Meditation: #6366f1 (indigo)
-- ============================================

UPDATE class_types SET color = '#f59e0b' WHERE name = 'Vinyasa Flow' AND color IS NULL;
UPDATE class_types SET color = '#ea580c' WHERE name = 'Hot Vinyasa' AND color IS NULL;
UPDATE class_types SET color = '#ef4444' WHERE name = 'Power & Peace' AND color IS NULL;
UPDATE class_types SET color = '#f59e0b' WHERE name = 'All Levels Flow' AND color IS NULL;
UPDATE class_types SET color = '#14b8a6' WHERE name = 'Yin Yoga' AND color IS NULL;
UPDATE class_types SET color = '#f59e0b' WHERE name = 'Dynamic Release Flow' AND color IS NULL;
UPDATE class_types SET color = '#22c55e' WHERE name = 'Beginners Yoga' AND color IS NULL;
UPDATE class_types SET color = '#ea580c' WHERE name = 'Warm Vinyasa & Stretch' AND color IS NULL;
UPDATE class_types SET color = '#6366f1' WHERE name = 'Sound Meditation' AND color IS NULL;
UPDATE class_types SET color = '#ef4444' WHERE name = 'Mysore Ashtanga' AND color IS NULL;

-- ============================================
-- 2. ADD MISSING CLASS TYPES NEEDED FOR CO-OP
-- ============================================

INSERT INTO class_types (name, duration, category, level, is_heated, description, color, default_capacity, drop_in_price, sort_order)
VALUES
('Gentle Flow', 60, 'flow', 'all', false,
 'Slow, mindful movement linking breath with gentle poses. Perfect for stress relief and flexibility.',
 '#f59e0b', 18, 20.00, 11),
('Restorative', 75, 'yin', 'all', false,
 'Deeply relaxing practice using props to support the body in passive poses. Nurture your nervous system.',
 '#14b8a6', 15, 22.00, 12)
ON CONFLICT DO NOTHING;

-- ============================================
-- 3. VERIFY ALL CLASS TYPES HAVE COLORS
-- ============================================

-- Update any remaining class types without colors based on category
UPDATE class_types SET color = '#f59e0b' WHERE color IS NULL AND category = 'flow';
UPDATE class_types SET color = '#ef4444' WHERE color IS NULL AND category = 'power';
UPDATE class_types SET color = '#14b8a6' WHERE color IS NULL AND category = 'yin';
UPDATE class_types SET color = '#ea580c' WHERE color IS NULL AND category = 'heated';
UPDATE class_types SET color = '#22c55e' WHERE color IS NULL AND category = 'beginner';
UPDATE class_types SET color = '#6366f1' WHERE color IS NULL AND category = 'meditation';
UPDATE class_types SET color = '#9333ea' WHERE color IS NULL AND category = 'workshop';
UPDATE class_types SET color = '#a855f7' WHERE color IS NULL AND category = 'private';
UPDATE class_types SET color = '#6b7280' WHERE color IS NULL; -- gray fallback

-- ============================================
-- 4. SHOW RESULTS
-- ============================================

SELECT name, category, color, is_active FROM class_types ORDER BY sort_order;
