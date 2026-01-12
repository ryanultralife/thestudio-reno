// ============================================
// BOOKING ROUTES
// ============================================

const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const { 
  authenticate, 
  requirePermission,
  requireOwnershipOr,
  userHasPermission 
} = require('../middleware/auth');
const notifications = require('../services/notifications');

const router = express.Router();

// ============================================
// GET MY BOOKINGS
// ============================================

router.get('/my-bookings', authenticate, async (req, res, next) => {
  try {
    const { status, upcoming } = req.query;

    let query = `
      SELECT 
        b.id, b.status, b.booked_at, b.checked_in_at, b.credits_used,
        c.id as class_id, c.date, c.start_time, c.is_cancelled,
        ct.name as class_name, ct.duration, ct.is_heated, ct.category,
        l.name as location_name, l.short_name as location_short,
        u.first_name as teacher_first_name, u.last_name as teacher_last_name
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE b.user_id = $1
    `;

    const params = [req.user.id];
    let paramIndex = 2;

    if (status) {
      query += ` AND b.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (upcoming === 'true') {
      query += ` AND c.date >= CURRENT_DATE AND b.status = 'booked'`;
    }

    query += ` ORDER BY c.date DESC, c.start_time DESC`;

    const result = await db.query(query, params);

    res.json({ bookings: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// BOOK A CLASS
// ============================================

router.post('/', authenticate, requirePermission('booking.create_self'), [
  body('class_id').isUUID(),
], async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    const { class_id } = req.body;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Get class details with lock
    const classResult = await client.query(`
      SELECT c.*, ct.name as class_name, l.name as location_name,
             u.first_name as teacher_first_name, u.last_name as teacher_last_name,
             (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status IN ('booked', 'checked_in')) as booked_count
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE c.id = $1
      FOR UPDATE OF c
    `, [class_id]);

    if (classResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Class not found' });
    }

    const classData = classResult.rows[0];

    // Check if cancelled
    if (classData.is_cancelled) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Class is cancelled' });
    }

    // Check if in past
    const classDateTime = new Date(`${classData.date.toISOString().split('T')[0]}T${classData.start_time}`);
    if (classDateTime < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot book past classes' });
    }

    // Check existing booking
    const existingBooking = await client.query(
      'SELECT id, status FROM bookings WHERE user_id = $1 AND class_id = $2',
      [userId, class_id]
    );

    if (existingBooking.rows.length > 0) {
      const status = existingBooking.rows[0].status;
      if (status === 'booked' || status === 'checked_in') {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Already booked for this class' });
      }
    }

    // Check capacity
    const spotsLeft = classData.capacity - classData.booked_count;
    if (spotsLeft <= 0) {
      // Add to waitlist
      const position = await client.query(
        'SELECT COALESCE(MAX(position), 0) + 1 as next FROM waitlist WHERE class_id = $1',
        [class_id]
      );

      await client.query(
        'INSERT INTO waitlist (user_id, class_id, position) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [userId, class_id, position.rows[0].next]
      );

      await client.query('COMMIT');
      return res.status(200).json({ 
        message: 'Added to waitlist',
        waitlist_position: position.rows[0].next,
      });
    }

    // Get active membership
    const membershipResult = await client.query(`
      SELECT um.id, um.credits_remaining, mt.type as membership_type
      FROM user_memberships um
      JOIN membership_types mt ON um.membership_type_id = mt.id
      WHERE um.user_id = $1 AND um.status = 'active'
        AND (um.end_date IS NULL OR um.end_date >= CURRENT_DATE)
      ORDER BY mt.type = 'unlimited' DESC, um.end_date ASC
      LIMIT 1
    `, [userId]);

    let membershipId = null;
    let creditsUsed = 0;

    if (membershipResult.rows.length > 0) {
      const membership = membershipResult.rows[0];
      membershipId = membership.id;

      if (membership.membership_type === 'credits') {
        if (membership.credits_remaining <= 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'No credits remaining' });
        }
        creditsUsed = 1;
        await client.query(
          'UPDATE user_memberships SET credits_remaining = credits_remaining - 1 WHERE id = $1',
          [membership.id]
        );
      }
    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        error: 'No active membership',
        message: 'Please purchase a membership or class pack to book',
      });
    }

    // Create booking
    const bookingResult = await client.query(`
      INSERT INTO bookings (user_id, class_id, membership_id, credits_used, booking_source)
      VALUES ($1, $2, $3, $4, 'web')
      RETURNING *
    `, [userId, class_id, membershipId, creditsUsed]);

    await client.query('COMMIT');

    // Send confirmation (async)
    notifications.notifyBookingConfirmation(userId, classData).catch(console.error);

    res.status(201).json({
      message: 'Class booked successfully',
      booking: {
        id: bookingResult.rows[0].id,
        status: 'booked',
        credits_used: creditsUsed,
        class: {
          name: classData.class_name,
          date: classData.date,
          time: classData.start_time,
          location: classData.location_name,
          teacher: `${classData.teacher_first_name} ${classData.teacher_last_name}`,
        },
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ============================================
// CANCEL BOOKING
// ============================================

router.delete('/:id', authenticate, async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;

    // Get booking with class info
    const bookingResult = await client.query(`
      SELECT b.*, c.date, c.start_time, ct.name as class_name
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      WHERE b.id = $1
    `, [id]);

    if (bookingResult.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingResult.rows[0];

    // Check ownership or permission
    if (booking.user_id !== req.user.id) {
      const canCancel = await userHasPermission(req.user.id, 'booking.cancel_others');
      if (!canCancel) {
        return res.status(403).json({ error: 'Cannot cancel this booking' });
      }
    }

    if (booking.status !== 'booked') {
      return res.status(400).json({ error: 'Cannot cancel this booking' });
    }

    await client.query('BEGIN');

    // Check if late cancel (within 2 hours)
    const classDateTime = new Date(`${booking.date.toISOString().split('T')[0]}T${booking.start_time}`);
    const hoursUntil = (classDateTime - new Date()) / (1000 * 60 * 60);
    const isLateCancel = hoursUntil < 2;

    // Update booking
    await client.query(
      `UPDATE bookings SET status = $1, cancelled_at = NOW() WHERE id = $2`,
      [isLateCancel ? 'late_cancel' : 'cancelled', id]
    );

    // Refund credit if not late cancel
    if (!isLateCancel && booking.credits_used > 0 && booking.membership_id) {
      await client.query(
        'UPDATE user_memberships SET credits_remaining = credits_remaining + $1 WHERE id = $2',
        [booking.credits_used, booking.membership_id]
      );
    }

    // Check waitlist and notify first person
    const waitlistResult = await client.query(`
      SELECT w.id, w.user_id, u.email, u.first_name
      FROM waitlist w
      JOIN users u ON w.user_id = u.id
      WHERE w.class_id = $1
      ORDER BY w.position
      LIMIT 1
    `, [booking.class_id]);

    if (waitlistResult.rows.length > 0) {
      const waitlistEntry = waitlistResult.rows[0];
      
      // Notify and set expiration
      await client.query(
        `UPDATE waitlist SET notified_at = NOW(), expires_at = NOW() + INTERVAL '30 minutes' WHERE id = $1`,
        [waitlistEntry.id]
      );

      notifications.notifyWaitlistSpot(waitlistEntry.user_id, {
        class_name: booking.class_name,
        date: booking.date,
      }).catch(console.error);
    }

    await client.query('COMMIT');

    // Send cancellation notification
    notifications.notifyBookingCancelled(booking.user_id, booking).catch(console.error);

    res.json({
      message: isLateCancel 
        ? 'Booking cancelled (late cancellation - credit not refunded)' 
        : 'Booking cancelled',
      late_cancel: isLateCancel,
      credit_refunded: !isLateCancel && booking.credits_used > 0,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ============================================
// CHECK IN (Staff/Teacher)
// ============================================

router.post('/:id/checkin', authenticate, requirePermission('booking.checkin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE bookings 
      SET status = 'checked_in', checked_in_at = NOW(), checked_in_by = $1
      WHERE id = $2 AND status = 'booked'
      RETURNING *, class_id, user_id
    `, [req.user.id, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or already checked in' });
    }

    res.json({ message: 'Checked in', booking: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UNDO CHECK IN (Staff)
// ============================================

router.post('/:id/undo-checkin', authenticate, requirePermission('booking.checkin'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE bookings 
      SET status = 'booked', checked_in_at = NULL, checked_in_by = NULL
      WHERE id = $1 AND status = 'checked_in'
      RETURNING *
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found or not checked in' });
    }

    res.json({ message: 'Check-in undone', booking: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// BOOK FOR ANOTHER USER (Staff)
// ============================================

router.post('/book-for-user', authenticate, requirePermission('booking.create_others'), [
  body('class_id').isUUID(),
  body('user_id').isUUID(),
], async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    const { class_id, user_id } = req.body;

    await client.query('BEGIN');

    // Similar logic to regular booking but for another user
    const classResult = await client.query(`
      SELECT c.*, ct.name as class_name, l.name as location_name,
             u.first_name as teacher_first_name, u.last_name as teacher_last_name,
             (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status IN ('booked', 'checked_in')) as booked_count
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE c.id = $1
      FOR UPDATE OF c
    `, [class_id]);

    if (classResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Class not found' });
    }

    const classData = classResult.rows[0];

    // Check capacity
    if (classData.booked_count >= classData.capacity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Class is full' });
    }

    // Get user's membership
    const membershipResult = await client.query(`
      SELECT um.id, um.credits_remaining, mt.type as membership_type
      FROM user_memberships um
      JOIN membership_types mt ON um.membership_type_id = mt.id
      WHERE um.user_id = $1 AND um.status = 'active'
      ORDER BY mt.type = 'unlimited' DESC
      LIMIT 1
    `, [user_id]);

    let membershipId = null;
    let creditsUsed = 0;

    if (membershipResult.rows.length > 0) {
      const membership = membershipResult.rows[0];
      membershipId = membership.id;
      if (membership.membership_type === 'credits' && membership.credits_remaining > 0) {
        creditsUsed = 1;
        await client.query(
          'UPDATE user_memberships SET credits_remaining = credits_remaining - 1 WHERE id = $1',
          [membership.id]
        );
      }
    }

    // Create booking
    const bookingResult = await client.query(`
      INSERT INTO bookings (user_id, class_id, membership_id, credits_used, booked_by, booking_source)
      VALUES ($1, $2, $3, $4, $5, 'front_desk')
      ON CONFLICT (user_id, class_id) DO UPDATE SET status = 'booked'
      RETURNING *
    `, [user_id, class_id, membershipId, creditsUsed, req.user.id]);

    await client.query('COMMIT');

    // Notify user
    notifications.notifyBookingConfirmation(user_id, classData).catch(console.error);

    res.status(201).json({
      message: 'Student booked',
      booking: bookingResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ============================================
// GET WAITLIST POSITION
// ============================================

router.get('/waitlist/:classId', authenticate, async (req, res, next) => {
  try {
    const { classId } = req.params;

    const result = await db.query(`
      SELECT position, added_at, notified_at, expires_at
      FROM waitlist
      WHERE user_id = $1 AND class_id = $2
    `, [req.user.id, classId]);

    if (result.rows.length === 0) {
      return res.json({ on_waitlist: false });
    }

    res.json({ 
      on_waitlist: true,
      ...result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// LEAVE WAITLIST
// ============================================

router.delete('/waitlist/:classId', authenticate, async (req, res, next) => {
  try {
    const { classId } = req.params;

    await db.query(
      'DELETE FROM waitlist WHERE user_id = $1 AND class_id = $2',
      [req.user.id, classId]
    );

    res.json({ message: 'Removed from waitlist' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
