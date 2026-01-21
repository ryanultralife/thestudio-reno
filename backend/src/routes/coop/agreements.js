// ============================================
// CO-OP TEACHER AGREEMENTS ROUTES
// ============================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requireRole, requirePermission } = require('../../middleware/auth');
const db = require('../../database/connection');
const agreementsService = require('../../services/coop/agreements');

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
// GET MY AGREEMENT (Teacher)
// ============================================

router.get('/me', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    const agreement = await agreementsService.getTeacherActiveAgreement(teacherId);
    if (!agreement) {
      return res.json({ agreement: null, message: 'No active agreement' });
    }

    res.json({ agreement });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET ALL AGREEMENTS (Admin)
// ============================================

router.get('/', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const { status, teacher_id, limit = 50, offset = 0 } = req.query;
    const agreements = await agreementsService.getAgreements({
      status,
      teacherId: teacher_id,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ agreements });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET AGREEMENT BY ID
// ============================================

router.get('/:id', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const agreement = await agreementsService.getAgreementById(req.params.id);
    if (!agreement) {
      return res.status(404).json({ error: 'Agreement not found' });
    }

    // Teachers can only view their own agreements
    if (req.user.role === 'teacher') {
      const teacherId = await getTeacherId(req.user.id);
      if (agreement.teacher_id !== teacherId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    res.json({ agreement });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE AGREEMENT (Admin creates for teacher)
// ============================================

router.post('/', requireRole('manager', 'owner', 'admin'), [
  body('teacher_id').isUUID(),
  body('agreement_type').isIn(['per_class', 'monthly']),
  body('start_date').isDate(),
  body('end_date').optional().isDate(),
  body('rental_rate_override').optional().isFloat({ min: 0 }),
  body('monthly_fee').optional().isFloat({ min: 0 }),
  body('credit_reimbursement_rate').optional().isFloat({ min: 0 }),
  body('minimum_classes_per_month').optional().isInt({ min: 0 }),
  body('max_weekly_hours').optional().isFloat({ min: 0 }),
  body('terms').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const agreement = await agreementsService.createAgreement({
      ...req.body,
      createdBy: req.user.id,
    });

    res.status(201).json({
      message: 'Agreement created',
      agreement,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// APPROVE AGREEMENT (Admin)
// ============================================

router.post('/:id/approve', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const agreement = await agreementsService.approveAgreement(
      req.params.id,
      req.user.id
    );
    res.json({
      message: 'Agreement approved',
      agreement,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SUSPEND AGREEMENT (Admin)
// ============================================

router.post('/:id/suspend', requireRole('manager', 'owner', 'admin'), [
  body('reason').optional().trim(),
], async (req, res, next) => {
  try {
    const agreement = await agreementsService.suspendAgreement(
      req.params.id,
      req.body.reason
    );
    res.json({
      message: 'Agreement suspended',
      agreement,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TERMINATE AGREEMENT (Admin)
// ============================================

router.post('/:id/terminate', requireRole('owner', 'admin'), [
  body('reason').optional().trim(),
], async (req, res, next) => {
  try {
    const agreement = await agreementsService.terminateAgreement(
      req.params.id,
      req.body.reason
    );
    res.json({
      message: 'Agreement terminated',
      agreement,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE AGREEMENT (Admin)
// ============================================

router.put('/:id', requireRole('manager', 'owner', 'admin'), [
  body('rental_rate_override').optional().isFloat({ min: 0 }),
  body('monthly_fee').optional().isFloat({ min: 0 }),
  body('credit_reimbursement_rate').optional().isFloat({ min: 0 }),
  body('minimum_classes_per_month').optional().isInt({ min: 0 }),
  body('max_weekly_hours').optional().isFloat({ min: 0 }),
  body('end_date').optional().isDate(),
  body('terms').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const agreement = await agreementsService.updateAgreement(req.params.id, req.body);
    res.json({
      message: 'Agreement updated',
      agreement,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// INSURANCE VERIFICATION
// ============================================

router.post('/:id/verify-insurance', requireRole('manager', 'owner', 'admin'), [
  body('verified').isBoolean(),
  body('expiry_date').optional().isDate(),
], async (req, res, next) => {
  try {
    const { verified, expiry_date } = req.body;
    const agreement = await agreementsService.verifyInsurance(
      req.params.id,
      verified,
      req.user.id,
      expiry_date
    );
    res.json({
      message: verified ? 'Insurance verified' : 'Insurance verification removed',
      agreement,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET EXPIRING INSURANCE (Admin)
// ============================================

router.get('/reports/expiring-insurance', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const { days = 30 } = req.query;
    const agreements = await agreementsService.getExpiringInsurance(parseInt(days));
    res.json({ agreements });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
