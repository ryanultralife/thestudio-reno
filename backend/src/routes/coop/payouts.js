// ============================================
// CO-OP PAYOUTS ROUTES
// ============================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requireRole } = require('../../middleware/auth');
const db = require('../../database/connection');
const payoutsService = require('../../services/coop/payouts');

const router = express.Router();

// Helper to get teacher ID from user
async function getTeacherId(userId) {
  const result = await db.query(
    'SELECT id FROM teachers WHERE user_id = $1',
    [userId]
  );
  return result.rows[0]?.id;
}

// ============================================
// ADMIN: PROCESS ALL PENDING PAYOUTS
// ============================================

router.post('/process-all', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const results = await payoutsService.processPayouts();

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    res.json({
      message: `Processed ${successCount} payouts, ${failedCount} failed`,
      results,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: PROCESS PAYOUT FOR SPECIFIC TEACHER
// ============================================

router.post('/process/:teacherId', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const result = await payoutsService.processPayoutForTeacher(req.params.teacherId);
    res.json({
      message: 'Payout processed',
      ...result,
    });
  } catch (error) {
    if (error.message.includes('No pending') ||
        error.message.includes('does not have')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// GET SETTLEMENT BATCHES
// ============================================

router.get('/batches', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const batches = await payoutsService.getSettlementBatches({
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ batches });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET SETTLEMENT BATCH BY ID
// ============================================

router.get('/batches/:id', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const batch = await payoutsService.getSettlementBatchById(req.params.id);
    res.json(batch);
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// TEACHER: REQUEST EARLY PAYOUT
// ============================================

router.post('/request-early', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    // Check if teacher has minimum balance
    const balance = await db.query(`
      SELECT SUM(amount) as balance
      FROM rental_transactions
      WHERE teacher_id = $1 AND status = 'pending'
    `, [teacherId]);

    const pendingBalance = parseFloat(balance.rows[0]?.balance || 0);

    if (pendingBalance <= 0) {
      return res.status(400).json({ error: 'No pending balance for payout' });
    }

    // Create early payout request (admin would approve)
    const request = await db.query(`
      INSERT INTO payout_requests (
        teacher_id, requested_amount, status, created_at
      ) VALUES ($1, $2, 'pending', NOW())
      ON CONFLICT (teacher_id, status) WHERE status = 'pending'
      DO UPDATE SET requested_amount = EXCLUDED.requested_amount
      RETURNING *
    `, [teacherId, pendingBalance]);

    res.json({
      message: 'Early payout requested',
      request: request.rows[0],
      pending_balance: pendingBalance,
    });
  } catch (error) {
    // Table may not exist yet
    if (error.code === '42P01') {
      return res.status(501).json({ error: 'Early payout requests not yet implemented' });
    }
    next(error);
  }
});

module.exports = router;
