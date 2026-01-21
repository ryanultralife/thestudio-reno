// ============================================
// CO-OP BOOKINGS ROUTES
// ============================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requireRole, requirePermission } = require('../../middleware/auth');
const bookingsService = require('../../services/coop/bookings');

const router = express.Router();

// ============================================
// GET MY CO-OP BOOKINGS
// ============================================

router.get('/mine', async (req, res, next) => {
  try {
    const { status, start_date, end_date, limit = 50, offset = 0 } = req.query;
    const bookings = await bookingsService.getUserCoopBookings(req.user.id, {
      status,
      startDate: start_date,
      endDate: end_date,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHECK IF USER CAN BOOK CLASS
// ============================================

router.get('/can-book/:classId', async (req, res, next) => {
  try {
    const result = await bookingsService.canBookCoopClass(
      req.user.id,
      req.params.classId
    );
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// ============================================
// BOOK CO-OP CLASS
// ============================================

router.post('/', [
  body('class_id').isUUID(),
  body('payment_method').isIn(['card', 'credit']),
  body('payment_intent_id').optional().isString(),
  body('credit_allocation_id').optional().isUUID(),
  body('referral_code').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const {
      class_id,
      payment_method,
      payment_intent_id,
      credit_allocation_id,
      referral_code,
    } = req.body;

    const result = await bookingsService.bookCoopClass({
      userId: req.user.id,
      classId: class_id,
      paymentMethod: payment_method,
      paymentIntentId: payment_intent_id,
      creditAllocationId: credit_allocation_id,
      referralCode: referral_code,
    });

    res.status(201).json({
      message: 'Booking confirmed',
      ...result,
    });
  } catch (error) {
    if (error.message.includes('Cannot book') ||
        error.message.includes('Already booked') ||
        error.message.includes('Class is full') ||
        error.message.includes('not found')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// CANCEL BOOKING
// ============================================

router.post('/:id/cancel', async (req, res, next) => {
  try {
    const result = await bookingsService.cancelCoopBooking(
      req.params.id,
      req.user.id
    );
    res.json({
      message: 'Booking cancelled',
      ...result,
    });
  } catch (error) {
    if (error.message.includes('not found') ||
        error.message.includes('cannot be cancelled')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// GET BOOKING BY ID
// ============================================

router.get('/:id', async (req, res, next) => {
  try {
    const booking = await bookingsService.getCoopBookingById(req.params.id);

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Users can only see their own bookings unless admin
    if (booking.user_id !== req.user.id &&
        !['manager', 'owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ booking });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADMIN: GET ALL CO-OP BOOKINGS
// ============================================

router.get('/', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const {
      class_id,
      teacher_id,
      user_id,
      status,
      booking_type,
      start_date,
      end_date,
      limit = 50,
      offset = 0,
    } = req.query;

    const bookings = await bookingsService.getCoopBookings({
      classId: class_id,
      teacherId: teacher_id,
      userId: user_id,
      status,
      bookingType: booking_type,
      startDate: start_date,
      endDate: end_date,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({ bookings });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TRACK REFERRAL
// ============================================

router.post('/referral', [
  body('referral_code').trim().notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const result = await bookingsService.trackCoopReferral(
      req.user.id,
      req.body.referral_code
    );

    res.json({
      message: 'Referral tracked',
      ...result,
    });
  } catch (error) {
    if (error.message.includes('Invalid') ||
        error.message.includes('already')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// GET BOOKING SUMMARY FOR CLASS (Teacher/Admin)
// ============================================

router.get('/class/:classId/summary', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const summary = await bookingsService.getClassBookingSummary(req.params.classId);
    res.json({ summary });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
