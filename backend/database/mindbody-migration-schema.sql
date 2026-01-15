-- ============================================
-- MINDBODY MIGRATION SCHEMA
-- Tracks import progress and stores Mindbody reference IDs
-- ============================================

-- Add Mindbody reference columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS mindbody_id VARCHAR(50) UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS imported_from_mindbody BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS mindbody_import_date TIMESTAMP;

-- Add Mindbody reference columns to classes table
ALTER TABLE classes ADD COLUMN IF NOT EXISTS mindbody_class_id VARCHAR(50) UNIQUE;

-- Add Mindbody reference columns to class_bookings (visits)
ALTER TABLE class_bookings ADD COLUMN IF NOT EXISTS mindbody_visit_id VARCHAR(50) UNIQUE;

-- Migration progress tracking table
CREATE TABLE IF NOT EXISTS mindbody_migration_progress (
  id SERIAL PRIMARY KEY,
  phase VARCHAR(50) NOT NULL UNIQUE,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  records_total INTEGER DEFAULT 0,
  records_processed INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Initialize migration phases
INSERT INTO mindbody_migration_progress (phase, status) VALUES
  ('clients', 'pending'),
  ('sms_optin', 'pending'),
  ('visits', 'pending'),
  ('memberships', 'pending'),
  ('credits', 'pending'),
  ('metrics', 'pending')
ON CONFLICT (phase) DO NOTHING;

-- Migration error log
CREATE TABLE IF NOT EXISTS mindbody_migration_errors (
  id SERIAL PRIMARY KEY,
  phase VARCHAR(50) NOT NULL,
  record_id VARCHAR(100),
  error_type VARCHAR(100),
  error_message TEXT,
  error_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Mindbody API rate limit tracking
CREATE TABLE IF NOT EXISTS mindbody_api_usage (
  id SERIAL PRIMARY KEY,
  date DATE DEFAULT CURRENT_DATE UNIQUE,
  calls_made INTEGER DEFAULT 0,
  calls_limit INTEGER DEFAULT 1000,
  overage_cost DECIMAL(10,2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Function to increment API usage counter
CREATE OR REPLACE FUNCTION increment_mindbody_api_usage()
RETURNS void AS $$
BEGIN
  INSERT INTO mindbody_api_usage (date, calls_made)
  VALUES (CURRENT_DATE, 1)
  ON CONFLICT (date)
  DO UPDATE SET calls_made = mindbody_api_usage.calls_made + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to check if we're within rate limits
CREATE OR REPLACE FUNCTION check_mindbody_rate_limit()
RETURNS TABLE (
  calls_today INTEGER,
  calls_remaining INTEGER,
  within_limit BOOLEAN,
  estimated_cost DECIMAL(10,2)
) AS $$
DECLARE
  v_calls_today INTEGER;
  v_calls_limit INTEGER;
BEGIN
  SELECT COALESCE(calls_made, 0), calls_limit
  INTO v_calls_today, v_calls_limit
  FROM mindbody_api_usage
  WHERE date = CURRENT_DATE;

  IF v_calls_today IS NULL THEN
    v_calls_today := 0;
    v_calls_limit := 1000;
  END IF;

  RETURN QUERY SELECT
    v_calls_today,
    GREATEST(v_calls_limit - v_calls_today, 0),
    v_calls_today < v_calls_limit,
    CASE
      WHEN v_calls_today > v_calls_limit
      THEN (v_calls_today - v_calls_limit)::DECIMAL * 0.0033
      ELSE 0.00
    END;
END;
$$ LANGUAGE plpgsql;

-- View for migration dashboard
CREATE OR REPLACE VIEW mindbody_migration_dashboard AS
SELECT
  p.phase,
  p.status,
  p.records_total,
  p.records_processed,
  p.records_failed,
  CASE
    WHEN p.records_total > 0
    THEN ROUND((p.records_processed::DECIMAL / p.records_total * 100), 2)
    ELSE 0
  END as progress_percentage,
  p.error_message,
  p.started_at,
  p.completed_at,
  EXTRACT(EPOCH FROM (p.completed_at - p.started_at)) as duration_seconds,
  (SELECT COUNT(*) FROM mindbody_migration_errors e WHERE e.phase = p.phase) as error_count
FROM mindbody_migration_progress p
ORDER BY
  CASE p.phase
    WHEN 'clients' THEN 1
    WHEN 'sms_optin' THEN 2
    WHEN 'visits' THEN 3
    WHEN 'memberships' THEN 4
    WHEN 'credits' THEN 5
    WHEN 'metrics' THEN 6
  END;

-- Grant permissions
GRANT ALL ON mindbody_migration_progress TO thestudio_admin;
GRANT ALL ON mindbody_migration_errors TO thestudio_admin;
GRANT ALL ON mindbody_api_usage TO thestudio_admin;
GRANT SELECT ON mindbody_migration_dashboard TO thestudio_admin;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_mindbody_id ON users(mindbody_id) WHERE mindbody_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_imported FROM mindbody ON users(imported_from_mindbody) WHERE imported_from_mindbody = true;
CREATE INDEX IF NOT EXISTS idx_migration_errors_phase ON mindbody_migration_errors(phase);
CREATE INDEX IF NOT EXISTS idx_api_usage_date ON mindbody_api_usage(date);

-- Sample query to check migration status
COMMENT ON VIEW mindbody_migration_dashboard IS
'Query this view to see real-time migration progress:
SELECT * FROM mindbody_migration_dashboard;';

-- Sample query to check rate limits
COMMENT ON FUNCTION check_mindbody_rate_limit IS
'Check current API usage:
SELECT * FROM check_mindbody_rate_limit();';
