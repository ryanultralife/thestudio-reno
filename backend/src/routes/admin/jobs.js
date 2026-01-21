// ============================================
// ADMIN JOB MANAGEMENT ROUTES
// ============================================

const express = require('express');
const { requireRole } = require('../../middleware/auth');
const scheduler = require('../../jobs/scheduler');

const router = express.Router();

// All routes require owner/admin role
router.use(requireRole('owner', 'admin'));

// ============================================
// GET JOB STATUS
// ============================================

router.get('/status', (req, res) => {
  const status = scheduler.getSchedulerStatus();
  res.json({ jobs: status });
});

// ============================================
// RUN JOB MANUALLY
// ============================================

router.post('/run/:jobName', async (req, res, next) => {
  try {
    const { jobName } = req.params;
    const result = await scheduler.runJobManually(jobName);
    res.json({
      message: `Job ${jobName} executed successfully`,
      result,
    });
  } catch (error) {
    if (error.message.includes('Unknown job')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// GET JOB LOGS
// ============================================

router.get('/logs', async (req, res, next) => {
  try {
    const { job_name, status, limit = 100, offset = 0 } = req.query;

    const db = require('../../database/connection');

    let whereClause = '1=1';
    const params = [];
    let paramIndex = 1;

    if (job_name) {
      whereClause += ` AND job_name = $${paramIndex++}`;
      params.push(job_name);
    }
    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(`
      SELECT * FROM job_logs
      WHERE ${whereClause}
      ORDER BY executed_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `, params);

    res.json({ logs: result.rows });
  } catch (error) {
    // Table might not exist
    if (error.code === '42P01') {
      return res.json({ logs: [], message: 'Job logs table not yet created' });
    }
    next(error);
  }
});

module.exports = router;
