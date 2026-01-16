-- ============================================
-- STEP 3: CREATE ADMIN USER
-- Copy and paste this AFTER running complete-migration.sql
-- ============================================

INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
VALUES (
  'admin@thestudio.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eo6hJ7EQvU2u',
  'Admin',
  'User',
  'admin',
  true
)
ON CONFLICT (email) DO NOTHING;

-- Verify admin user was created
SELECT id, email, first_name, last_name, role, is_active
FROM users
WHERE email = 'admin@thestudio.com';
