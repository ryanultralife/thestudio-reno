// ============================================
// CO-OP RENTAL TIERS ROUTES
// ============================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requireRole } = require('../../middleware/auth');
const tiersService = require('../../services/coop/rentalTiers');

const router = express.Router();

// ============================================
// GET ALL TIERS
// ============================================

router.get('/', async (req, res, next) => {
  try {
    const { room_id, include_inactive } = req.query;
    const tiers = await tiersService.getRentalTiers({
      roomId: room_id,
      includeInactive: include_inactive === 'true' &&
        ['manager', 'owner', 'admin'].includes(req.user.role),
    });
    res.json({ tiers });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET TIER BY ID
// ============================================

router.get('/:id', async (req, res, next) => {
  try {
    const tier = await tiersService.getRentalTierById(req.params.id);
    if (!tier) {
      return res.status(404).json({ error: 'Rental tier not found' });
    }
    res.json({ tier });
  } catch (error) {
    next(error);
  }
});

// ============================================
// FIND APPLICABLE TIER
// ============================================

router.get('/find/applicable', [
  query('room_id').isUUID(),
  query('day_of_week').isInt({ min: 0, max: 6 }),
  query('start_time').matches(/^\d{2}:\d{2}$/),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { room_id, day_of_week, start_time } = req.query;
    const tier = await tiersService.findApplicableTier(
      room_id,
      parseInt(day_of_week),
      start_time
    );

    if (!tier) {
      return res.status(404).json({ error: 'No applicable tier found' });
    }

    res.json({ tier });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CALCULATE RENTAL FEE
// ============================================

router.post('/calculate-fee', [
  body('room_id').isUUID(),
  body('day_of_week').isInt({ min: 0, max: 6 }),
  body('start_time').matches(/^\d{2}:\d{2}$/),
  body('duration_minutes').isInt({ min: 15 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { room_id, day_of_week, start_time, duration_minutes } = req.body;
    const result = await tiersService.calculateRentalFee(
      room_id,
      parseInt(day_of_week),
      start_time,
      parseInt(duration_minutes)
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE TIER (Admin only)
// ============================================

router.post('/', requireRole('owner', 'admin'), [
  body('room_id').isUUID(),
  body('tier_name').trim().notEmpty().isLength({ max: 50 }),
  body('day_of_week').isInt({ min: 0, max: 6 }),
  body('start_time').matches(/^\d{2}:\d{2}$/),
  body('end_time').matches(/^\d{2}:\d{2}$/),
  body('hourly_rate').isFloat({ min: 0 }),
  body('priority').optional().isInt({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tier = await tiersService.createRentalTier(req.body);
    res.status(201).json({
      message: 'Rental tier created',
      tier,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE TIER (Admin only)
// ============================================

router.put('/:id', requireRole('owner', 'admin'), [
  body('tier_name').optional().trim().notEmpty().isLength({ max: 50 }),
  body('day_of_week').optional().isInt({ min: 0, max: 6 }),
  body('start_time').optional().matches(/^\d{2}:\d{2}$/),
  body('end_time').optional().matches(/^\d{2}:\d{2}$/),
  body('hourly_rate').optional().isFloat({ min: 0 }),
  body('priority').optional().isInt({ min: 0 }),
  body('is_active').optional().isBoolean(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tier = await tiersService.updateRentalTier(req.params.id, req.body);
    res.json({
      message: 'Rental tier updated',
      tier,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE TIER (Admin only)
// ============================================

router.delete('/:id', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    await tiersService.deleteRentalTier(req.params.id);
    res.json({ message: 'Rental tier deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// APPLY TIER TEMPLATES (Admin only)
// ============================================

router.post('/apply-templates', requireRole('owner', 'admin'), [
  body('room_id').isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const tiers = await tiersService.applyTierTemplates(req.body.room_id);
    res.json({
      message: 'Tier templates applied',
      tiers,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
