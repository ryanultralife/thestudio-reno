// ============================================
// CO-OP SETTINGS ROUTES
// ============================================

const express = require('express');
const { body, validationResult } = require('express-validator');
const { requirePermission, requireRole } = require('../../middleware/auth');
const settingsService = require('../../services/coop/settings');

const router = express.Router();

// ============================================
// GET SETTINGS (Admin only)
// ============================================

router.get('/', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const settings = await settingsService.getCoopSettings();
    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE SETTINGS (Admin only)
// ============================================

router.put('/', requireRole('owner', 'admin'), [
  body('coop_enabled').optional().isBoolean(),
  body('default_member_discount_percent').optional().isFloat({ min: 0, max: 100 }),
  body('credit_reimbursement_rate').optional().isFloat({ min: 0, max: 100 }),
  body('minimum_payout_amount').optional().isFloat({ min: 0 }),
  body('payout_schedule').optional().isIn(['weekly', 'biweekly', 'monthly']),
  body('commission_percentage').optional().isFloat({ min: 0, max: 100 }),
  body('max_advance_booking_days').optional().isInt({ min: 1, max: 365 }),
  body('cancellation_deadline_hours').optional().isInt({ min: 0, max: 168 }),
  body('require_insurance_verification').optional().isBoolean(),
  body('insurance_min_coverage').optional().isFloat({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const settings = await settingsService.updateCoopSettings(req.body, req.user.id);
    res.json({
      message: 'Settings updated',
      settings,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHECK CO-OP STATUS (Any authenticated user)
// ============================================

router.get('/status', async (req, res, next) => {
  try {
    const enabled = await settingsService.isCoopEnabled();
    res.json({ enabled });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CALCULATE MEMBER PRICE (Public-ish)
// ============================================

router.post('/calculate-price', [
  body('basePrice').isFloat({ min: 0 }),
  body('userId').optional().isUUID(),
], async (req, res, next) => {
  try {
    const { basePrice, userId } = req.body;
    const price = await settingsService.calculateMemberPrice(
      basePrice,
      userId || req.user.id
    );
    res.json({ price });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
