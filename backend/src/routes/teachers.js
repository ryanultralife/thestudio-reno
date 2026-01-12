// ============================================
// TEACHER ROUTES
// ============================================

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const { authenticate, requireRole, requirePermission } = require('../middleware/auth');
const notifications = require('../services/notifications');

const router = express.Router();

// All routes require teacher role minimum
router.use(authenticate);

// ============================================
// GET MY TEACHER PROFILE
// ============================================

router.get('/me', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.*, u.email, u.first_name, u.last_name, u.phone
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.user_id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher profile not found' });
    }

    res.json({ teacher: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET MY UPCOMING CLASSES
// ============================================

router.get('/my-classes', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

    // Get teacher ID
    const teacherResult = await db.query(
      'SELECT id FROM teachers WHERE user_id = $1',
      [req.user.id]
    );

    if (teacherResult.rows.length === 0) {
      return res.json({ classes: [] });
    }

    const teacherId = teacherResult.rows[0].id;

    const result = await db.query(`
      SELECT 
        c.id, c.date, c.start_time, c.end_time, c.capacity, c.is_cancelled,
        c.substitute_teacher_id,
        ct.name as class_name, ct.duration, ct.is_heated,
        l.name as location_name, l.short_name as location_short,
        COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as booked_count,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as checked_in_count,
        EXISTS(SELECT 1 FROM sub_requests sr WHERE sr.class_id = c.id AND sr.status = 'open') as has_sub_request
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.date BETWEEN $1 AND $2
        AND (c.teacher_id = $3 OR c.substitute_teacher_id = $3)
      GROUP BY c.id, ct.id, l.id
      ORDER BY c.date, c.start_time
    `, [startDate, endDate, teacherId]);

    res.json({ classes: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET CLASS ROSTER (Own classes only)
// ============================================

router.get('/class/:classId/roster', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const { classId } = req.params;

    // Verify this is teacher's class
    const classCheck = await db.query(`
      SELECT c.id FROM classes c
      JOIN teachers t ON (c.teacher_id = t.id OR c.substitute_teacher_id = t.id)
      WHERE c.id = $1 AND t.user_id = $2
    `, [classId, req.user.id]);

    if (classCheck.rows.length === 0 && !['manager', 'owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not your class' });
    }

    const result = await db.query(`
      SELECT 
        b.id as booking_id, b.status, b.checked_in_at,
        u.first_name, u.last_name, u.phone,
        CASE WHEN u.date_of_birth IS NOT NULL 
          THEN EXTRACT(YEAR FROM AGE(u.date_of_birth))::int 
          ELSE NULL 
        END as age
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.class_id = $1 AND b.status IN ('booked', 'checked_in')
      ORDER BY u.first_name
    `, [classId]);

    res.json({ roster: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SUB REQUESTS
// ============================================

// Get open sub requests
router.get('/sub-requests', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        sr.*,
        c.date, c.start_time,
        ct.name as class_name,
        l.name as location_name,
        req_u.first_name as requesting_teacher_first,
        req_u.last_name as requesting_teacher_last
      FROM sub_requests sr
      JOIN classes c ON sr.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      JOIN teachers req_t ON sr.requesting_teacher_id = req_t.id
      JOIN users req_u ON req_t.user_id = req_u.id
      WHERE sr.status = 'open' AND c.date >= CURRENT_DATE
      ORDER BY c.date, c.start_time
    `);

    res.json({ sub_requests: result.rows });
  } catch (error) {
    next(error);
  }
});

// Get my sub requests (ones I created)
router.get('/sub-requests/mine', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const teacherResult = await db.query(
      'SELECT id FROM teachers WHERE user_id = $1',
      [req.user.id]
    );

    if (teacherResult.rows.length === 0) {
      return res.json({ sub_requests: [] });
    }

    const result = await db.query(`
      SELECT 
        sr.*,
        c.date, c.start_time,
        ct.name as class_name,
        l.name as location_name,
        claim_u.first_name as claimed_by_first,
        claim_u.last_name as claimed_by_last
      FROM sub_requests sr
      JOIN classes c ON sr.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      LEFT JOIN teachers claim_t ON sr.claimed_by_teacher_id = claim_t.id
      LEFT JOIN users claim_u ON claim_t.user_id = claim_u.id
      WHERE sr.requesting_teacher_id = $1
      ORDER BY c.date DESC
    `, [teacherResult.rows[0].id]);

    res.json({ sub_requests: result.rows });
  } catch (error) {
    next(error);
  }
});

// Create sub request
router.post('/sub-requests', requirePermission('sub_request.create'), [
  body('class_id').isUUID(),
  body('reason').optional().trim(),
], async (req, res, next) => {
  try {
    const { class_id, reason } = req.body;

    // Get teacher ID
    const teacherResult = await db.query(
      'SELECT id FROM teachers WHERE user_id = $1',
      [req.user.id]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(400).json({ error: 'Not a registered teacher' });
    }

    const teacherId = teacherResult.rows[0].id;

    // Verify teacher owns this class
    const classCheck = await db.query(
      'SELECT id FROM classes WHERE id = $1 AND teacher_id = $2 AND date >= CURRENT_DATE',
      [class_id, teacherId]
    );

    if (classCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid class or not your class' });
    }

    // Check for existing request
    const existing = await db.query(
      'SELECT id FROM sub_requests WHERE class_id = $1 AND status IN (\'open\', \'claimed\')',
      [class_id]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Sub request already exists for this class' });
    }

    // Create request
    const result = await db.query(`
      INSERT INTO sub_requests (class_id, requesting_teacher_id, reason)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [class_id, teacherId, reason]);

    // TODO: Notify other teachers about sub opportunity

    res.status(201).json({ 
      message: 'Sub request created',
      sub_request: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Claim sub request
router.post('/sub-requests/:id/claim', requirePermission('sub_request.claim'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const teacherResult = await db.query(
      'SELECT id FROM teachers WHERE user_id = $1',
      [req.user.id]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(400).json({ error: 'Not a registered teacher' });
    }

    const teacherId = teacherResult.rows[0].id;

    // Can't claim your own request
    const requestCheck = await db.query(
      'SELECT requesting_teacher_id FROM sub_requests WHERE id = $1 AND status = \'open\'',
      [id]
    );

    if (requestCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Sub request not found or not open' });
    }

    if (requestCheck.rows[0].requesting_teacher_id === teacherId) {
      return res.status(400).json({ error: 'Cannot claim your own sub request' });
    }

    // Claim it
    const result = await db.query(`
      UPDATE sub_requests 
      SET status = 'claimed', claimed_by_teacher_id = $1, claimed_at = NOW()
      WHERE id = $2 AND status = 'open'
      RETURNING *
    `, [teacherId, id]);

    if (result.rows.length === 0) {
      return res.status(409).json({ error: 'Already claimed' });
    }

    res.json({ 
      message: 'Sub request claimed - pending approval',
      sub_request: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// Approve sub request (Manager+)
router.post('/sub-requests/:id/approve', requirePermission('sub_request.approve'), async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Get the request
    const requestResult = await client.query(`
      SELECT sr.*, c.id as class_id
      FROM sub_requests sr
      JOIN classes c ON sr.class_id = c.id
      WHERE sr.id = $1 AND sr.status = 'claimed'
    `, [id]);

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Sub request not found or not claimed' });
    }

    const subRequest = requestResult.rows[0];

    // Update class with substitute
    await client.query(
      'UPDATE classes SET substitute_teacher_id = $1 WHERE id = $2',
      [subRequest.claimed_by_teacher_id, subRequest.class_id]
    );

    // Approve the request
    await client.query(`
      UPDATE sub_requests 
      SET status = 'approved', approved_by = $1, approved_at = NOW()
      WHERE id = $2
    `, [req.user.id, id]);

    await client.query('COMMIT');

    res.json({ message: 'Sub request approved' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// Cancel sub request
router.delete('/sub-requests/:id', requirePermission('sub_request.create'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const teacherResult = await db.query(
      'SELECT id FROM teachers WHERE user_id = $1',
      [req.user.id]
    );

    const result = await db.query(`
      UPDATE sub_requests SET status = 'cancelled'
      WHERE id = $1 AND requesting_teacher_id = $2 AND status IN ('open', 'claimed')
      RETURNING *
    `, [id, teacherResult.rows[0]?.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Sub request not found or cannot cancel' });
    }

    res.json({ message: 'Sub request cancelled' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHECK IN STUDENT (Teacher can check in for own class)
// ============================================

router.post('/class/:classId/checkin/:bookingId', requireRole('teacher', 'manager', 'owner', 'admin'), async (req, res, next) => {
  try {
    const { classId, bookingId } = req.params;

    // Verify teacher owns this class (or is manager+)
    if (req.user.role === 'teacher') {
      const classCheck = await db.query(`
        SELECT c.id FROM classes c
        JOIN teachers t ON (c.teacher_id = t.id OR c.substitute_teacher_id = t.id)
        WHERE c.id = $1 AND t.user_id = $2
      `, [classId, req.user.id]);

      if (classCheck.rows.length === 0) {
        return res.status(403).json({ error: 'Not your class' });
      }
    }

    const result = await db.query(`
      UPDATE bookings 
      SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = $1
      WHERE id = $2 AND class_id = $3 AND status = 'booked'
      RETURNING *
    `, [req.user.id, bookingId, classId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already checked in' });
    }

    res.json({ message: 'Checked in', booking: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
