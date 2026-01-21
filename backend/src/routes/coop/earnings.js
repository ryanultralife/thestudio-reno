// ============================================
// CO-OP TEACHER EARNINGS ROUTES
// ============================================

const express = require('express');
const { query, validationResult } = require('express-validator');
const { requireRole } = require('../../middleware/auth');
const db = require('../../database/connection');
const earningsService = require('../../services/coop/earnings');

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
// GET MY EARNINGS SUMMARY
// ============================================

router.get('/summary', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const { start_date, end_date, include_details } = req.query;
    const earnings = await earningsService.getTeacherEarnings(teacherId, {
      startDate: start_date,
      endDate: end_date,
      includeDetails: include_details === 'true',
    });

    res.json(earnings);
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET EARNINGS BY CLASS
// ============================================

router.get('/class/:classId', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId && req.user.role === 'teacher') {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    // Teachers can only view their own class earnings
    const earnings = await earningsService.getEarningsByClass(
      req.user.role === 'teacher' ? teacherId : req.query.teacher_id || teacherId,
      req.params.classId
    );

    res.json(earnings);
  } catch (error) {
    if (error.message.includes('not found') || error.message.includes('not authorized')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// GET MY PAYOUT HISTORY
// ============================================

router.get('/payouts', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const { limit = 50, offset = 0 } = req.query;
    const payouts = await earningsService.getPayoutHistory(teacherId, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({ payouts });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET REVENUE TREND
// ============================================

router.get('/trend', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const { period = 'week', count = 12 } = req.query;
    const trend = await earningsService.getRevenueTrend(teacherId, {
      period,
      count: parseInt(count),
    });

    res.json({ trend });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET EARNINGS BY CLASS TYPE
// ============================================

router.get('/by-class-type', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const { start_date, end_date } = req.query;
    const breakdown = await earningsService.getEarningsByClassType(teacherId, {
      startDate: start_date,
      endDate: end_date,
    });

    res.json({ breakdown });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET DAILY SUMMARY
// ============================================

router.get('/daily/:date', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const summary = await earningsService.getDailySummary(teacherId, req.params.date);
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET STUDENT ANALYTICS
// ============================================

router.get('/students', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const { start_date, end_date } = req.query;
    const analytics = await earningsService.getStudentAnalytics(teacherId, {
      startDate: start_date,
      endDate: end_date,
    });

    res.json({ analytics });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: GET ALL PENDING PAYOUTS
// ============================================

router.get('/pending-payouts', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const pendingPayouts = await earningsService.getPendingPayouts();
    res.json({ pending_payouts: pendingPayouts });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: GET TEACHER EARNINGS
// ============================================

router.get('/teacher/:teacherId', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const { start_date, end_date, include_details } = req.query;
    const earnings = await earningsService.getTeacherEarnings(req.params.teacherId, {
      startDate: start_date,
      endDate: end_date,
      includeDetails: include_details === 'true',
    });

    res.json(earnings);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
