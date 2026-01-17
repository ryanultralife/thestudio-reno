-- Add payment information fields for teachers (for co-op class payments)
-- Teachers can receive payments via Venmo, Zelle, PayPal, etc.

ALTER TABLE teachers
ADD COLUMN IF NOT EXISTS venmo_handle VARCHAR(100),
ADD COLUMN IF NOT EXISTS zelle_email VARCHAR(200),
ADD COLUMN IF NOT EXISTS zelle_phone VARCHAR(20),
ADD COLUMN IF NOT EXISTS paypal_email VARCHAR(200),
ADD COLUMN IF NOT EXISTS cashapp_handle VARCHAR(100),
ADD COLUMN IF NOT EXISTS payment_notes TEXT;

COMMENT ON COLUMN teachers.venmo_handle IS 'Venmo username for receiving co-op class payments';
COMMENT ON COLUMN teachers.zelle_email IS 'Zelle email for receiving payments';
COMMENT ON COLUMN teachers.zelle_phone IS 'Zelle phone number for receiving payments';
COMMENT ON COLUMN teachers.paypal_email IS 'PayPal email for receiving payments';
COMMENT ON COLUMN teachers.cashapp_handle IS 'Cash App handle for receiving payments';
COMMENT ON COLUMN teachers.payment_notes IS 'Additional payment instructions for students';
