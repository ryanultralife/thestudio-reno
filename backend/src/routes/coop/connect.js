// ============================================
// CO-OP STRIPE CONNECT ROUTES
// ============================================

const express = require('express');
const { body, validationResult } = require('express-validator');
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
// GET MY STRIPE CONNECT STATUS
// ============================================

router.get('/status', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const status = await payoutsService.getTeacherAccountStatus(teacherId);
    res.json({ status });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE STRIPE CONNECT ACCOUNT
// ============================================

router.post('/create-account', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const result = await payoutsService.createTeacherConnectAccount(teacherId);
    res.status(201).json({
      message: 'Stripe Connect account created',
      ...result,
    });
  } catch (error) {
    if (error.message.includes('already has')) {
      return res.status(409).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// GET ONBOARDING LINK
// ============================================

router.post('/onboarding-link', requireRole('teacher', 'manager', 'owner', 'admin'), [
  body('refresh_url').isURL(),
  body('return_url').isURL(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const { refresh_url, return_url } = req.body;
    const link = await payoutsService.createOnboardingLink(
      teacherId,
      refresh_url,
      return_url
    );

    res.json({
      message: 'Onboarding link created',
      link,
    });
  } catch (error) {
    if (error.message.includes('does not have')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// GET DASHBOARD LINK
// ============================================

router.post('/dashboard-link', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const link = await payoutsService.createDashboardLink(teacherId);
    res.json({
      message: 'Dashboard link created',
      link,
    });
  } catch (error) {
    if (error.message.includes('does not have')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// ADMIN: UPDATE ACCOUNT STATUS (Manual or from webhook)
// ============================================

router.put('/account/:stripeAccountId/status', requireRole('owner', 'admin'), [
  body('detailsSubmitted').optional().isBoolean(),
  body('chargesEnabled').optional().isBoolean(),
  body('payoutsEnabled').optional().isBoolean(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await payoutsService.updateAccountStatus(
      req.params.stripeAccountId,
      req.body
    );

    if (!result) {
      return res.status(404).json({ error: 'Account not found' });
    }

    res.json({
      message: 'Account status updated',
      teacher: result,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: GET TEACHER CONNECT STATUS
// ============================================

router.get('/teacher/:teacherId/status', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const status = await payoutsService.getTeacherAccountStatus(req.params.teacherId);
    res.json({ status });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// COMPLETE ONBOARDING (Mock for development)
// ============================================

router.post('/complete-onboarding', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    // This is a mock endpoint for development
    // In production, this would be handled by Stripe webhooks
    await db.query(`
      UPDATE teachers
      SET stripe_connect_onboarding_complete = true,
          stripe_connect_charges_enabled = true,
          stripe_connect_payouts_enabled = true,
          updated_at = NOW()
      WHERE id = $1
    `, [teacherId]);

    res.json({
      message: 'Onboarding completed (mock)',
      status: {
        detailsSubmitted: true,
        chargesEnabled: true,
        payoutsEnabled: true,
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
