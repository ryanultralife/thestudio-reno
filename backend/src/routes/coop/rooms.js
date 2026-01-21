// ============================================
// CO-OP ROOMS ROUTES
// ============================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requirePermission, requireRole } = require('../../middleware/auth');
const roomsService = require('../../services/coop/rooms');

const router = express.Router();

// ============================================
// GET ALL CO-OP ROOMS
// ============================================

router.get('/', async (req, res, next) => {
  try {
    const { location_id, include_inactive } = req.query;
    const rooms = await roomsService.getCoopRooms({
      locationId: location_id,
      includeInactive: include_inactive === 'true' &&
        ['manager', 'owner', 'admin'].includes(req.user.role),
    });
    res.json({ rooms });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET ROOM BY ID
// ============================================

router.get('/:id', async (req, res, next) => {
  try {
    const room = await roomsService.getRoomById(req.params.id);
    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    res.json({ room });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE ROOM (Admin only)
// ============================================

router.post('/', requireRole('owner', 'admin'), [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('location_id').isUUID(),
  body('capacity').isInt({ min: 1, max: 500 }),
  body('description').optional().trim(),
  body('amenities').optional().isArray(),
  body('coop_enabled').optional().isBoolean(),
  body('hourly_rate').optional().isFloat({ min: 0 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const room = await roomsService.createRoom(req.body);
    res.status(201).json({
      message: 'Room created',
      room,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE ROOM (Admin only)
// ============================================

router.put('/:id', requireRole('owner', 'admin'), [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('capacity').optional().isInt({ min: 1, max: 500 }),
  body('description').optional().trim(),
  body('amenities').optional().isArray(),
  body('coop_enabled').optional().isBoolean(),
  body('hourly_rate').optional().isFloat({ min: 0 }),
  body('is_active').optional().isBoolean(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const room = await roomsService.updateRoom(req.params.id, req.body);
    res.json({
      message: 'Room updated',
      room,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ENABLE CO-OP FOR ROOM (Admin only)
// ============================================

router.post('/:id/enable-coop', requireRole('owner', 'admin'), [
  body('hourly_rate').optional().isFloat({ min: 0 }),
], async (req, res, next) => {
  try {
    const room = await roomsService.enableCoopForRoom(
      req.params.id,
      req.body.hourly_rate
    );
    res.json({
      message: 'Co-op enabled for room',
      room,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DISABLE CO-OP FOR ROOM (Admin only)
// ============================================

router.post('/:id/disable-coop', requireRole('owner', 'admin'), async (req, res, next) => {
  try {
    const room = await roomsService.updateRoom(req.params.id, {
      coop_enabled: false,
    });
    res.json({
      message: 'Co-op disabled for room',
      room,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
