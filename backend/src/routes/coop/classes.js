// ============================================
// CO-OP CLASSES ROUTES
// ============================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { requireRole, requirePermission } = require('../../middleware/auth');
const db = require('../../database/connection');
const classesService = require('../../services/coop/classes');

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
// GET UPCOMING CO-OP CLASSES (Public)
// ============================================

router.get('/', async (req, res, next) => {
  try {
    const {
      room_id,
      teacher_id,
      start_date,
      end_date,
      class_type_id,
      limit = 50,
      offset = 0,
    } = req.query;

    const classes = await classesService.getCoopClasses({
      roomId: room_id,
      teacherId: teacher_id,
      startDate: start_date || new Date().toISOString().split('T')[0],
      endDate: end_date,
      classTypeId: class_type_id,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({ classes });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET MY CO-OP CLASSES (Teacher)
// ============================================

router.get('/mine', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.json({ classes: [] });
    }

    const { start_date, end_date, status } = req.query;
    const classes = await classesService.getTeacherCoopClasses(teacherId, {
      startDate: start_date,
      endDate: end_date,
      status,
    });

    res.json({ classes });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET CLASS BY ID
// ============================================

router.get('/:id', async (req, res, next) => {
  try {
    const classData = await classesService.getCoopClassById(req.params.id);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json({ class: classData });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET CLASS ROSTER (Teacher or Admin)
// ============================================

router.get('/:id/roster', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    // Verify access
    if (req.user.role === 'teacher') {
      const teacherId = await getTeacherId(req.user.id);
      const classData = await classesService.getCoopClassById(req.params.id);
      if (!classData || classData.teacher_id !== teacherId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const roster = await classesService.getClassRoster(req.params.id);
    res.json({ roster });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHECK ROOM AVAILABILITY
// ============================================

router.get('/availability/check', [
  query('room_id').isUUID(),
  query('date').isDate(),
  query('start_time').matches(/^\d{2}:\d{2}$/),
  query('end_time').matches(/^\d{2}:\d{2}$/),
  query('exclude_class_id').optional().isUUID(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { room_id, date, start_time, end_time, exclude_class_id } = req.query;
    const available = await classesService.checkRoomAvailability(
      room_id,
      date,
      start_time,
      end_time,
      exclude_class_id
    );

    res.json({ available });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET AVAILABLE SLOTS
// ============================================

router.get('/availability/slots', [
  query('room_id').isUUID(),
  query('date').isDate(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { room_id, date } = req.query;
    const slots = await classesService.getAvailableSlots(room_id, date);
    res.json({ slots });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET TEACHER WEEKLY HOURS
// ============================================

router.get('/hours/weekly', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherId = req.query.teacher_id || await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher ID required' });
    }

    // Only admin can check other teachers
    if (req.query.teacher_id && req.user.role === 'teacher') {
      const myTeacherId = await getTeacherId(req.user.id);
      if (req.query.teacher_id !== myTeacherId) {
        return res.status(403).json({ error: 'Access denied' });
      }
    }

    const { week_start } = req.query;
    const hours = await classesService.getTeacherWeeklyHours(teacherId, week_start);
    res.json({ hours });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE CO-OP CLASS (Teacher)
// ============================================

router.post('/', requireRole('teacher', 'manager', 'owner', 'admin'), [
  body('room_id').isUUID(),
  body('class_type_id').isUUID(),
  body('date').isDate(),
  body('start_time').matches(/^\d{2}:\d{2}$/),
  body('end_time').matches(/^\d{2}:\d{2}$/),
  body('capacity').optional().isInt({ min: 1 }),
  body('coop_price').isFloat({ min: 0 }),
  body('coop_member_price').optional().isFloat({ min: 0 }),
  body('description').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const teacherId = await getTeacherId(req.user.id);
    if (!teacherId) {
      return res.status(400).json({ error: 'Teacher profile not found' });
    }

    const classData = await classesService.createCoopClass({
      ...req.body,
      teacher_id: teacherId,
    });

    res.status(201).json({
      message: 'Co-op class created',
      class: classData,
    });
  } catch (error) {
    if (error.message.includes('No active agreement') ||
        error.message.includes('not available') ||
        error.message.includes('exceed')) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});

// ============================================
// UPDATE CO-OP CLASS (Teacher)
// ============================================

router.put('/:id', requireRole('teacher', 'manager', 'owner', 'admin'), [
  body('capacity').optional().isInt({ min: 1 }),
  body('coop_price').optional().isFloat({ min: 0 }),
  body('coop_member_price').optional().isFloat({ min: 0 }),
  body('description').optional().trim(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Verify ownership
    const teacherId = await getTeacherId(req.user.id);
    const existingClass = await classesService.getCoopClassById(req.params.id);

    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (req.user.role === 'teacher' && existingClass.teacher_id !== teacherId) {
      return res.status(403).json({ error: 'Not your class' });
    }

    const classData = await classesService.updateCoopClass(req.params.id, req.body);
    res.json({
      message: 'Class updated',
      class: classData,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CANCEL CO-OP CLASS (Teacher)
// ============================================

router.post('/:id/cancel', requireRole('teacher', 'manager', 'owner', 'admin'), [
  body('reason').optional().trim(),
  body('notify_students').optional().isBoolean(),
], async (req, res, next) => {
  try {
    // Verify ownership
    const teacherId = await getTeacherId(req.user.id);
    const existingClass = await classesService.getCoopClassById(req.params.id);

    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }

    if (req.user.role === 'teacher' && existingClass.teacher_id !== teacherId) {
      return res.status(403).json({ error: 'Not your class' });
    }

    const result = await classesService.cancelCoopClass(
      req.params.id,
      req.body.reason,
      req.body.notify_students !== false
    );

    res.json({
      message: 'Class cancelled',
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// FINALIZE CLASS (Admin - after class completes)
// ============================================

router.post('/:id/finalize', requireRole('manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const result = await classesService.finalizeCoopClass(req.params.id);
    res.json({
      message: 'Class finalized',
      ...result,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHECK IN STUDENT (Teacher)
// ============================================

router.post('/:classId/checkin/:bookingId', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    // Verify ownership for teachers
    if (req.user.role === 'teacher') {
      const teacherId = await getTeacherId(req.user.id);
      const existingClass = await classesService.getCoopClassById(req.params.classId);

      if (!existingClass || existingClass.teacher_id !== teacherId) {
        return res.status(403).json({ error: 'Not your class' });
      }
    }

    const booking = await classesService.checkInStudent(
      req.params.classId,
      req.params.bookingId,
      req.user.id
    );

    res.json({
      message: 'Student checked in',
      booking,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
