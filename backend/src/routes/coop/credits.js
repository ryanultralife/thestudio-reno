// ============================================
// CO-OP MEMBER CREDITS ROUTES
// ============================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requireRole, requirePermission } = require('../../middleware/auth');
const creditsService = require('../../services/coop/credits');

const router = express.Router();

// ============================================
// GET MY AVAILABLE CREDITS
// ============================================

router.get('/available', async (req, res, next) => {
  try {
    const credits = await creditsService.getAvailableCoopCredits(req.user.id);
    res.json({ credits });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET MY CREDIT SUMMARY
// ============================================

router.get('/summary', async (req, res, next) => {
  try {
    const summary = await creditsService.getUserCreditSummary(req.user.id);
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET MY CREDIT HISTORY
// ============================================

router.get('/history', async (req, res, next) => {
  try {
    const { limit = 12, offset = 0 } = req.query;
    const history = await creditsService.getUserCreditHistory(req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ history });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: GET USER CREDITS
// ============================================

router.get('/user/:userId', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const [credits, summary, history] = await Promise.all([
      creditsService.getAvailableCoopCredits(req.params.userId),
      creditsService.getUserCreditSummary(req.params.userId),
      creditsService.getUserCreditHistory(req.params.userId, { limit: 12 }),
    ]);

    res.json({
      credits,
      summary,
      history,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: ALLOCATE CREDITS TO USER
// ============================================

router.post('/allocate', requireRole('manager', 'owner', 'admin'), [
  body('user_id').isUUID(),
  body('credits').isInt({ min: 1, max: 100 }),
  body('period_start').optional().isDate(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { user_id, credits, period_start } = req.body;
    const allocation = await creditsService.allocateCreditsToUser(
      user_id,
      credits,
      period_start
    );

    res.status(201).json({
      message: `${credits} credits allocated`,
      allocation,
    });
  } catch (error) {
    if (error.message.includes('membership')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// ADMIN: RUN MONTHLY ALLOCATION
// ============================================

router.post('/allocate-monthly', requireRole('owner', 'admin'), [
  body('period_start').optional().isDate(),
], async (req, res, next) => {
  try {
    const result = await creditsService.allocateMonthlyCredits(req.body.period_start);
    res.json({
      message: `Allocated credits to ${result.allocated} members`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: EXPIRE UNUSED CREDITS
// ============================================

router.post('/expire-unused', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const result = await creditsService.expireUnusedCredits();
    res.json({
      message: `Expired credits for ${result.expired} allocations`,
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: CREDIT USAGE BY TEACHER
// ============================================

router.get('/usage/teacher/:teacherId', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const { start_date, end_date, limit = 100 } = req.query;
    const usage = await creditsService.getCreditUsageByTeacher(req.params.teacherId, {
      startDate: start_date,
      endDate: end_date,
      limit: parseInt(limit),
    });
    res.json({ usage });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: CREDIT USAGE BY CLASS
// ============================================

router.get('/usage/class/:classId', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const usage = await creditsService.getCreditUsageByClass(req.params.classId);
    res.json({ usage });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
