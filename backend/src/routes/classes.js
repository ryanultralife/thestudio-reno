// ============================================
// CLASS ROUTES
// ============================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../database/connection');
const { 
  authenticate, 
  requirePermission, 
  requireClassAccess
} = require('../middleware/auth');

const router = express.Router();

// ============================================
// GET SCHEDULE (Public)
// ============================================

router.get('/schedule', async (req, res, next) => {
  try {
    const { start_date, end_date, location_id, class_type_id, teacher_id } = req.query;

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 7);
      return d.toISOString().split('T')[0];
    })();

    const { class_model, include_coop } = req.query;

    let query = `
      SELECT
        c.id, c.date, c.start_time, c.end_time, c.capacity, c.is_cancelled,
        c.notes, c.class_model,
        c.coop_drop_in_price, c.coop_member_price,
        ct.id as class_type_id, ct.name as class_name, ct.duration,
        ct.category, ct.is_heated, ct.level, ct.description as class_description,
        ct.color as class_color,
        l.id as location_id, l.name as location_name, l.short_name as location_short,
        t.id as teacher_id,
        u.first_name as teacher_first_name, u.last_name as teacher_last_name,
        t.photo_url as teacher_photo, t.title as teacher_title,
        COALESCE(sub_u.first_name, '') as sub_first_name,
        COALESCE(sub_u.last_name, '') as sub_last_name,
        r.id as room_id, r.name as room_name,
        COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as booked_count,
        c.capacity - COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as spots_left
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN teachers sub_t ON c.substitute_teacher_id = sub_t.id
      LEFT JOIN users sub_u ON sub_t.user_id = sub_u.id
      LEFT JOIN rooms r ON c.room_id = r.id
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.date BETWEEN $1 AND $2
        AND c.is_cancelled = FALSE
    `;

    const params = [startDate, endDate];
    let paramIndex = 3;

    if (location_id) {
      query += ` AND c.location_id = $${paramIndex}`;
      params.push(location_id);
      paramIndex++;
    }

    if (class_type_id) {
      query += ` AND c.class_type_id = $${paramIndex}`;
      params.push(class_type_id);
      paramIndex++;
    }

    if (teacher_id) {
      query += ` AND (c.teacher_id = $${paramIndex} OR c.substitute_teacher_id = $${paramIndex})`;
      params.push(teacher_id);
      paramIndex++;
    }

    // Filter by class model (traditional, coop_rental, monthly_tenant)
    if (class_model) {
      query += ` AND c.class_model = $${paramIndex}`;
      params.push(class_model);
      paramIndex++;
    } else if (include_coop === 'false') {
      // Exclude co-op classes unless explicitly included
      query += ` AND (c.class_model IS NULL OR c.class_model = 'traditional')`;
    }

    query += `
      GROUP BY c.id, ct.id, l.id, t.id, u.id, sub_u.first_name, sub_u.last_name, r.id
      ORDER BY c.date, c.start_time
    `;

    const result = await db.query(query, params);

    // Format each class with teacher name and co-op info
    const formattedClasses = result.rows.map(cls => {
      const isCoop = cls.class_model && cls.class_model !== 'traditional';
      const teacherName = cls.sub_first_name
        ? `${cls.sub_first_name} ${cls.sub_last_name} (sub for ${cls.teacher_first_name})`
        : `${cls.teacher_first_name} ${cls.teacher_last_name}`;

      return {
        id: cls.id,
        date: cls.date,
        start_time: cls.start_time,
        end_time: cls.end_time,
        capacity: cls.capacity,
        booked: parseInt(cls.booked_count) || 0,
        spots_left: parseInt(cls.spots_left) || cls.capacity,
        is_cancelled: cls.is_cancelled,
        class_type_id: cls.class_type_id,
        class_name: cls.class_name,
        class_description: cls.class_description,
        duration: cls.duration,
        category: cls.category,
        is_heated: cls.is_heated,
        level: cls.level,
        class_color: cls.class_color || (isCoop ? '#9333ea' : '#d97706'), // Purple for co-op, amber default
        location_id: cls.location_id,
        location_name: cls.location_name,
        location_short: cls.location_short,
        room_id: cls.room_id,
        room_name: cls.room_name,
        teacher_id: cls.teacher_id,
        teacher_name: teacherName,
        teacher_title: cls.teacher_title,
        teacher_photo: cls.teacher_photo,
        // Co-op specific fields
        is_coop: isCoop,
        class_model: cls.class_model || 'traditional',
        coop_drop_in_price: isCoop ? cls.coop_drop_in_price : null,
        coop_member_price: isCoop ? cls.coop_member_price : null,
      };
    });

    // Group by date for easier frontend rendering
    const byDate = {};
    for (const cls of formattedClasses) {
      const dateKey = cls.date instanceof Date ? cls.date.toISOString().split('T')[0] : cls.date;
      if (!byDate[dateKey]) byDate[dateKey] = [];
      byDate[dateKey].push(cls);
    }

    // Convert to sorted array format that frontend expects
    const schedule = Object.keys(byDate)
      .sort()
      .map(date => ({
        date,
        classes: byDate[date].sort((a, b) => a.start_time.localeCompare(b.start_time)),
      }));

    res.json({
      start_date: startDate,
      end_date: endDate,
      schedule,
      classes: formattedClasses,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET CLASS DETAILS
// ============================================

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        c.*, 
        ct.name as class_name, ct.description, ct.duration, ct.category, ct.is_heated, ct.level,
        l.name as location_name, l.address as location_address,
        u.first_name as teacher_first_name, u.last_name as teacher_last_name,
        t.bio as teacher_bio, t.photo_url as teacher_photo
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      WHERE c.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Get availability
    const availability = await db.query('SELECT * FROM get_class_availability($1)', [id]);

    res.json({
      ...result.rows[0],
      availability: availability.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET CLASS ROSTER (Staff/Teacher)
// ============================================

router.get('/:id/roster', authenticate, requireClassAccess(), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        b.id as booking_id, b.status, b.booked_at, b.checked_in_at,
        u.id as user_id, u.email, u.first_name, u.last_name, u.phone,
        mt.name as membership_name,
        um.credits_remaining
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      LEFT JOIN user_memberships um ON b.membership_id = um.id
      LEFT JOIN membership_types mt ON um.membership_type_id = mt.id
      WHERE b.class_id = $1
      ORDER BY b.booked_at
    `, [id]);

    // Get waitlist
    const waitlist = await db.query(`
      SELECT w.position, u.first_name, u.last_name, u.email, w.added_at
      FROM waitlist w
      JOIN users u ON w.user_id = u.id
      WHERE w.class_id = $1
      ORDER BY w.position
    `, [id]);

    // Get class info
    const classInfo = await db.query(`
      SELECT c.capacity, c.date, c.start_time, ct.name as class_name
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      WHERE c.id = $1
    `, [id]);

    res.json({
      class: classInfo.rows[0],
      roster: result.rows,
      waitlist: waitlist.rows,
      counts: {
        booked: result.rows.filter(b => b.status === 'booked').length,
        checked_in: result.rows.filter(b => b.status === 'checked_in').length,
        total: result.rows.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE CLASS (Manager+)
// ============================================

router.post('/', authenticate, requirePermission('class.create'), [
  body('class_type_id').isUUID(),
  body('teacher_id').isUUID(),
  body('location_id').isUUID(),
  body('date').isISO8601(),
  body('start_time').matches(/^\d{2}:\d{2}$/),
  body('capacity').optional().isInt({ min: 1 }),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { class_type_id, teacher_id, location_id, date, start_time, capacity, notes } = req.body;

    // Get class type for duration and default capacity
    const classType = await db.query(
      'SELECT duration, default_capacity FROM class_types WHERE id = $1',
      [class_type_id]
    );

    if (classType.rows.length === 0) {
      return res.status(400).json({ error: 'Invalid class type' });
    }

    const duration = classType.rows[0].duration;
    const defaultCapacity = classType.rows[0].default_capacity;

    // Calculate end time
    const [hours, minutes] = start_time.split(':').map(Number);
    const endMinutes = hours * 60 + minutes + duration;
    const endTime = `${Math.floor(endMinutes / 60).toString().padStart(2, '0')}:${(endMinutes % 60).toString().padStart(2, '0')}`;

    const result = await db.query(`
      INSERT INTO classes (class_type_id, teacher_id, location_id, date, start_time, end_time, capacity, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [class_type_id, teacher_id, location_id, date, start_time, endTime, capacity || defaultCapacity, notes]);

    res.status(201).json({ message: 'Class created', class: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE CLASS (Manager+)
// ============================================

router.put('/:id', authenticate, requirePermission('class.edit'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = ['teacher_id', 'capacity', 'start_time', 'notes'];
    
    const updates = [];
    const values = [];
    let paramIndex = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramIndex}`);
        values.push(req.body[field]);
        paramIndex++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE classes SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Class not found' });
    }

    res.json({ message: 'Class updated', class: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CANCEL CLASS (Manager+)
// ============================================

router.post('/:id/cancel', authenticate, requirePermission('class.cancel'), [
  body('reason').optional().trim(),
], async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await client.query('BEGIN');

    // Cancel the class
    const classResult = await client.query(`
      UPDATE classes 
      SET is_cancelled = true, cancellation_reason = $1, cancelled_at = NOW(), cancelled_by = $2
      WHERE id = $3 AND is_cancelled = false
      RETURNING *
    `, [reason, req.user.id, id]);

    if (classResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Class not found or already cancelled' });
    }

    // Get all booked users to notify
    const bookings = await client.query(`
      SELECT b.id, b.user_id, u.email, u.first_name
      FROM bookings b
      JOIN users u ON b.user_id = u.id
      WHERE b.class_id = $1 AND b.status = 'booked'
    `, [id]);

    // Cancel all bookings and refund credits
    await client.query(`
      UPDATE bookings SET status = 'cancelled' WHERE class_id = $1 AND status = 'booked'
    `, [id]);

    // Refund credits
    await client.query(`
      UPDATE user_memberships um
      SET credits_remaining = credits_remaining + b.credits_used
      FROM bookings b
      WHERE b.membership_id = um.id AND b.class_id = $1 AND b.credits_used > 0
    `, [id]);

    // Clear waitlist
    await client.query('DELETE FROM waitlist WHERE class_id = $1', [id]);

    await client.query('COMMIT');

    // Notify users (async)
    const notifications = require('../services/notifications');
    const classData = classResult.rows[0];
    for (const booking of bookings.rows) {
      notifications.notify(booking.user_id, 'class_cancelled', {
        class_name: 'Class', // Would need join for name
        date: classData.date,
        reason: reason || 'Not specified',
      }).catch(console.error);
    }

    res.json({ 
      message: 'Class cancelled',
      affected_bookings: bookings.rows.length,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ============================================
// GET CLASS TYPES
// ============================================

router.get('/types/list', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, name, description, short_description, duration, category, level,
             is_heated, default_capacity, drop_in_price, color, icon
      FROM class_types
      WHERE is_active = true
      ORDER BY sort_order, name
    `);

    res.json({ class_types: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET LOCATIONS
// ============================================

router.get('/locations/list', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, name, short_name, address, city, state, zip, phone, capacity
      FROM locations
      WHERE is_active = true
      ORDER BY name
    `);

    res.json({ locations: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET TEACHERS
// ============================================

router.get('/teachers/list', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.id, u.first_name, u.last_name, t.title, t.bio, t.photo_url, t.specialties
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      WHERE t.is_active = true
      ORDER BY u.first_name
    `);

    res.json({ teachers: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GENERATE SCHEDULE FROM TEMPLATES (Manager+)
// ============================================

router.post('/generate', authenticate, requirePermission('class.create'), async (req, res, next) => {
  try {
    const { start_date, end_date, weeks } = req.body;
    const scheduleService = require('../services/schedule');

    let result;
    if (start_date && end_date) {
      result = await scheduleService.generateSchedule(new Date(start_date), new Date(end_date));
    } else {
      result = await scheduleService.generateWeeksAhead(weeks || 2);
    }

    res.json({
      message: 'Schedule generated',
      classes_created: result.created,
      classes_skipped: result.skipped,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MANAGE SCHEDULE TEMPLATES (Manager+)
// ============================================

router.get('/templates', authenticate, requirePermission('class.create'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        t.*,
        ct.name as class_name,
        l.name as location_name,
        u.first_name as teacher_first_name, u.last_name as teacher_last_name
      FROM class_schedule_templates t
      JOIN class_types ct ON t.class_type_id = ct.id
      JOIN locations l ON t.location_id = l.id
      JOIN teachers te ON t.teacher_id = te.id
      JOIN users u ON te.user_id = u.id
      ORDER BY t.day_of_week, t.start_time
    `);

    res.json({ templates: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/templates', authenticate, requirePermission('class.create'), async (req, res, next) => {
  try {
    const { class_type_id, teacher_id, location_id, day_of_week, start_time, capacity } = req.body;

    const result = await db.query(`
      INSERT INTO class_schedule_templates (class_type_id, teacher_id, location_id, day_of_week, start_time, capacity)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [class_type_id, teacher_id, location_id, day_of_week, start_time, capacity]);

    res.status(201).json({ message: 'Template created', template: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/templates/:id', authenticate, requirePermission('class.create'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = ['class_type_id', 'teacher_id', 'location_id', 'day_of_week', 'start_time', 'capacity', 'is_active'];

    const updates = [];
    const values = [];
    let idx = 1;

    for (const field of fields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(req.body[field]);
        idx++;
      }
    }

    values.push(id);
    const result = await db.query(
      `UPDATE class_schedule_templates SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ message: 'Template updated', template: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/templates/:id', authenticate, requirePermission('class.create'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM class_schedule_templates WHERE id = $1', [req.params.id]);
    res.json({ message: 'Template deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
