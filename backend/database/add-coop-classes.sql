-- ============================================
-- CO-OP CLASS SUPPORT
-- Enables teachers to create their own classes with custom pricing
-- ============================================

-- Add co-op fields to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS is_coop_class BOOLEAN DEFAULT FALSE;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_price DECIMAL(10,2);
ALTER TABLE classes ADD COLUMN IF NOT EXISTS coop_credits INTEGER DEFAULT 1;
ALTER TABLE classes ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Add co-op category to class_types
ALTER TABLE class_types DROP CONSTRAINT IF EXISTS class_types_category_check;
ALTER TABLE class_types ADD CONSTRAINT class_types_category_check
    CHECK (category IN ('flow', 'power', 'yin', 'heated', 'beginner', 'meditation', 'workshop', 'private', 'coop'));

-- Create indexes for co-op queries
CREATE INDEX IF NOT EXISTS idx_classes_coop ON classes(is_coop_class) WHERE is_coop_class = TRUE;
CREATE INDEX IF NOT EXISTS idx_classes_created_by ON classes(created_by);

-- Insert co-op class types
INSERT INTO class_types (name, duration, category, level, description, sort_order, is_active)
VALUES
    ('Co-op Class', 60, 'coop', 'all', 'Teacher-led community class with flexible scheduling and pricing', 100, true),
    ('Co-op Workshop', 120, 'coop', 'all', 'Extended workshop format taught by community teachers', 101, true),
    ('Co-op Private Session', 60, 'coop', 'all', 'Private or semi-private sessions by community teachers', 102, true)
ON CONFLICT DO NOTHING;

-- Grant permissions for co-op class management
INSERT INTO permissions (name, description) VALUES
    ('coop.create_class', 'Create co-op classes'),
    ('coop.edit_own_class', 'Edit own co-op classes'),
    ('coop.delete_own_class', 'Delete own co-op classes'),
    ('coop.view_all', 'View all co-op classes'),
    ('coop.manage_all', 'Manage all co-op classes (admin)')
ON CONFLICT (name) DO NOTHING;

-- Grant co-op permissions to teachers
INSERT INTO role_permissions (role, permission_id)
SELECT 'teacher', id FROM permissions
WHERE name IN ('coop.create_class', 'coop.edit_own_class', 'coop.delete_own_class', 'coop.view_all')
ON CONFLICT DO NOTHING;

-- Grant all co-op permissions to managers and admins
INSERT INTO role_permissions (role, permission_id)
SELECT 'manager', id FROM permissions WHERE name LIKE 'coop.%'
ON CONFLICT DO NOTHING;

INSERT INTO role_permissions (role, permission_id)
SELECT 'admin', id FROM permissions WHERE name LIKE 'coop.%'
ON CONFLICT DO NOTHING;

COMMENT ON COLUMN classes.is_coop_class IS 'Marks class as co-op (teacher-created with custom pricing)';
COMMENT ON COLUMN classes.coop_price IS 'Custom price for co-op class (overrides class_type drop_in_price)';
COMMENT ON COLUMN classes.coop_credits IS 'Number of credits required to book co-op class (default 1)';
COMMENT ON COLUMN classes.created_by IS 'User who created the class (for co-op classes, the teacher)';
