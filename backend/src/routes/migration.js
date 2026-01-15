// ============================================
// MIGRATION ROUTES
// Monitor Mindbody import progress
// ============================================

const express = require('express');
const router = express.Router();
const { pool } = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');

// Get migration dashboard data
router.get('/status', authenticate, requirePermission('manage_settings'), async (req, res, next) => {
  try {
    // Get overall progress
    const progressResult = await pool.query(
      'SELECT * FROM mindbody_migration_dashboard ORDER BY phase'
    );

    // Get API usage stats
    const apiUsageResult = await pool.query(
      `SELECT * FROM mindbody_api_usage
       WHERE date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY date DESC`
    );

    // Get rate limit check
    const rateLimitResult = await pool.query('SELECT * FROM check_mindbody_rate_limit()');

    // Get recent errors
    const errorsResult = await pool.query(
      `SELECT phase, record_id, error_type, error_message, created_at
       FROM mindbody_migration_errors
       ORDER BY created_at DESC
       LIMIT 50`
    );

    // Get imported user count
    const userCountResult = await pool.query(
      `SELECT COUNT(*) as total,
              COUNT(CASE WHEN email_opt_in THEN 1 END) as email_opt_in,
              COUNT(CASE WHEN sms_opt_in THEN 1 END) as sms_opt_in
       FROM users
       WHERE imported_from_mindbody = true`
    );

    res.json({
      phases: progressResult.rows,
      apiUsage: apiUsageResult.rows,
      rateLimit: rateLimitResult.rows[0],
      recentErrors: errorsResult.rows,
      importedUsers: userCountResult.rows[0]
    });
  } catch (err) {
    next(err);
  }
});

// Get detailed phase stats
router.get('/phase/:phase', authenticate, requirePermission('manage_settings'), async (req, res, next) => {
  try {
    const { phase } = req.params;

    const result = await pool.query(
      `SELECT * FROM mindbody_migration_progress WHERE phase = $1`,
      [phase]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Phase not found' });
    }

    const errors = await pool.query(
      `SELECT * FROM mindbody_migration_errors
       WHERE phase = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [phase]
    );

    res.json({
      phase: result.rows[0],
      errors: errors.rows
    });
  } catch (err) {
    next(err);
  }
});

// Reset migration phase (for re-running)
router.post('/reset/:phase', authenticate, requirePermission('manage_settings'), async (req, res, next) => {
  try {
    const { phase } = req.params;

    await pool.query(
      `UPDATE mindbody_migration_progress
       SET status = 'pending',
           records_processed = 0,
           records_failed = 0,
           error_message = NULL,
           started_at = NULL,
           completed_at = NULL,
           updated_at = NOW()
       WHERE phase = $1`,
      [phase]
    );

    // Clear errors for this phase
    await pool.query(
      'DELETE FROM mindbody_migration_errors WHERE phase = $1',
      [phase]
    );

    res.json({ message: `Phase '${phase}' has been reset` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
