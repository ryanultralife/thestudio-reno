// ============================================
// CO-OP RENTAL ROUTES
// Space Rental, Room Booking, Referrals
// ============================================

const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../database/connection');
const {
  authenticate,
  requirePermission,
  optionalAuth
} = require('../middleware/auth');

const router = express.Router();

// ============================================
// ROOMS
// ============================================

// GET all rooms (public)
router.get('/rooms', optionalAuth, async (req, res, next) => {
  try {
    const { location_id, room_type, available_for_rental } = req.query;

    let query = `
      SELECT
        r.id, r.name, r.short_name, r.room_type, r.capacity,
        r.description, r.amenities, r.available_for_rental,
        r.available_for_monthly, r.equipment_storage_available,
        r.default_hourly_rate, r.default_block_rate, r.monthly_rate,
        l.id as location_id, l.name as location_name, l.short_name as location_short,
        mrc.tenant_name as current_tenant,
        mrc.status as tenant_status
      FROM rooms r
      JOIN locations l ON r.location_id = l.id
      LEFT JOIN monthly_rental_contracts mrc ON mrc.room_id = r.id AND mrc.status = 'active'
      WHERE r.is_active = TRUE
    `;

    const params = [];
    let paramIndex = 1;

    if (location_id) {
      query += ` AND r.location_id = $${paramIndex}`;
      params.push(location_id);
      paramIndex++;
    }

    if (room_type) {
      query += ` AND r.room_type = $${paramIndex}`;
      params.push(room_type);
      paramIndex++;
    }

    if (available_for_rental === 'true') {
      query += ` AND r.available_for_rental = TRUE`;
    }

    query += ` ORDER BY l.name, r.name`;

    const result = await db.query(query, params);
    res.json({ rooms: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET room by ID with pricing tiers
router.get('/rooms/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const roomResult = await db.query(`
      SELECT
        r.*,
        l.name as location_name, l.short_name as location_short
      FROM rooms r
      JOIN locations l ON r.location_id = l.id
      WHERE r.id = $1
    `, [id]);

    if (roomResult.rows.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const pricingResult = await db.query(`
      SELECT * FROM rental_pricing_tiers
      WHERE room_id = $1 AND is_active = TRUE
      ORDER BY start_time
    `, [id]);

    const contractResult = await db.query(`
      SELECT * FROM monthly_rental_contracts
      WHERE room_id = $1 AND status = 'active'
    `, [id]);

    res.json({
      room: roomResult.rows[0],
      pricing_tiers: pricingResult.rows,
      active_contract: contractResult.rows[0] || null
    });
  } catch (err) {
    next(err);
  }
});

// CREATE room (manager+)
router.post('/rooms',
  authenticate,
  requirePermission('room.manage'),
  [
    body('location_id').isUUID(),
    body('name').notEmpty().trim(),
    body('room_type').isIn(['yoga_large', 'yoga_small', 'massage', 'tea_lounge', 'other']),
    body('capacity').isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        location_id, name, short_name, room_type, capacity,
        description, amenities, available_for_rental, available_for_monthly,
        equipment_storage_available, default_hourly_rate, default_block_rate, monthly_rate
      } = req.body;

      const result = await db.query(`
        INSERT INTO rooms (
          location_id, name, short_name, room_type, capacity,
          description, amenities, available_for_rental, available_for_monthly,
          equipment_storage_available, default_hourly_rate, default_block_rate, monthly_rate
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `, [
        location_id, name, short_name, room_type, capacity,
        description, amenities || [], available_for_rental ?? true, available_for_monthly ?? true,
        equipment_storage_available ?? false, default_hourly_rate, default_block_rate, monthly_rate
      ]);

      res.status(201).json({ room: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// UPDATE room (manager+)
router.put('/rooms/:id',
  authenticate,
  requirePermission('room.manage'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const updates = req.body;

      const allowedFields = [
        'name', 'short_name', 'room_type', 'capacity', 'description',
        'amenities', 'available_for_rental', 'available_for_monthly',
        'equipment_storage_available', 'default_hourly_rate',
        'default_block_rate', 'monthly_rate', 'is_active'
      ];

      const setClauses = [];
      const values = [];
      let paramIndex = 1;

      for (const [key, value] of Object.entries(updates)) {
        if (allowedFields.includes(key)) {
          setClauses.push(`${key} = $${paramIndex}`);
          values.push(value);
          paramIndex++;
        }
      }

      if (setClauses.length === 0) {
        return res.status(400).json({ error: 'No valid fields to update' });
      }

      values.push(id);
      const result = await db.query(`
        UPDATE rooms SET ${setClauses.join(', ')}, updated_at = NOW()
        WHERE id = $${paramIndex}
        RETURNING *
      `, values);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Room not found' });
      }

      res.json({ room: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================
// RENTAL PRICING TIERS
// ============================================

// GET pricing tiers for a room
router.get('/rooms/:id/pricing', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT * FROM rental_pricing_tiers
      WHERE room_id = $1 AND is_active = TRUE
      ORDER BY
        CASE WHEN 'weekend' = ANY(day_types) THEN 1 ELSE 0 END,
        start_time
    `, [id]);

    res.json({ pricing_tiers: result.rows });
  } catch (err) {
    next(err);
  }
});

// CREATE pricing tier (manager+)
router.post('/rooms/:id/pricing',
  authenticate,
  requirePermission('room.manage'),
  [
    body('name').notEmpty().trim(),
    body('day_types').isArray(),
    body('start_time').matches(/^\d{2}:\d{2}$/),
    body('end_time').matches(/^\d{2}:\d{2}$/),
    body('price').isFloat({ min: 0 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { id } = req.params;
      const {
        name, day_types, start_time, end_time, block_duration_minutes,
        price, suggested_class_price, break_even_students
      } = req.body;

      const result = await db.query(`
        INSERT INTO rental_pricing_tiers (
          room_id, name, day_types, start_time, end_time,
          block_duration_minutes, price, suggested_class_price, break_even_students
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        id, name, day_types, start_time, end_time,
        block_duration_minutes || 90, price, suggested_class_price, break_even_students
      ]);

      res.status(201).json({ pricing_tier: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// UPDATE pricing tier
router.put('/pricing/:tier_id',
  authenticate,
  requirePermission('room.manage'),
  async (req, res, next) => {
    try {
      const { tier_id } = req.params;
      const { price, suggested_class_price, break_even_students, is_active } = req.body;

      const result = await db.query(`
        UPDATE rental_pricing_tiers
        SET price = COALESCE($1, price),
            suggested_class_price = COALESCE($2, suggested_class_price),
            break_even_students = COALESCE($3, break_even_students),
            is_active = COALESCE($4, is_active)
        WHERE id = $5
        RETURNING *
      `, [price, suggested_class_price, break_even_students, is_active, tier_id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Pricing tier not found' });
      }

      res.json({ pricing_tier: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// GET rental price for specific date/time
router.get('/rooms/:id/price', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { date, start_time } = req.query;

    if (!date || !start_time) {
      return res.status(400).json({ error: 'date and start_time required' });
    }

    const result = await db.query(`
      SELECT * FROM get_rental_price($1, $2::date, $3::time)
    `, [id, date, start_time]);

    if (result.rows.length === 0 || !result.rows[0].tier_id) {
      // Fall back to room's default rate
      const roomResult = await db.query(`
        SELECT default_block_rate FROM rooms WHERE id = $1
      `, [id]);

      return res.json({
        tier: null,
        price: roomResult.rows[0]?.default_block_rate || null,
        message: 'No specific tier found, using default rate'
      });
    }

    res.json({
      tier_id: result.rows[0].tier_id,
      tier_name: result.rows[0].tier_name,
      price: result.rows[0].price,
      break_even_students: result.rows[0].break_even
    });
  } catch (err) {
    next(err);
  }
});

// ============================================
// ROOM BOOKINGS (Single rentals)
// ============================================

// GET room availability for a date range
router.get('/rooms/:id/availability', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    })();

    // Get existing bookings
    const bookingsResult = await db.query(`
      SELECT date, start_time, end_time, status
      FROM room_bookings
      WHERE room_id = $1
        AND date BETWEEN $2 AND $3
        AND status NOT IN ('cancelled')
      ORDER BY date, start_time
    `, [id, startDate, endDate]);

    // Get traditional classes in this room
    const classesResult = await db.query(`
      SELECT date, start_time, end_time
      FROM classes
      WHERE room_id = $1
        AND date BETWEEN $2 AND $3
        AND is_cancelled = FALSE
      ORDER BY date, start_time
    `, [id, startDate, endDate]);

    res.json({
      room_id: id,
      start_date: startDate,
      end_date: endDate,
      bookings: bookingsResult.rows,
      classes: classesResult.rows
    });
  } catch (err) {
    next(err);
  }
});

// CREATE room booking (teacher+)
router.post('/bookings',
  authenticate,
  requirePermission('room.book'),
  [
    body('room_id').isUUID(),
    body('date').isISO8601(),
    body('start_time').matches(/^\d{2}:\d{2}$/),
    body('end_time').matches(/^\d{2}:\d{2}$/),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { room_id, date, start_time, end_time, notes } = req.body;

      // Get teacher ID for current user
      const teacherResult = await db.query(
        'SELECT id FROM teachers WHERE user_id = $1',
        [req.user.id]
      );

      if (teacherResult.rows.length === 0) {
        return res.status(403).json({ error: 'Must be a teacher to book rooms' });
      }

      const teacherId = teacherResult.rows[0].id;

      // Check for conflicts
      const conflictResult = await db.query(`
        SELECT id FROM room_bookings
        WHERE room_id = $1 AND date = $2
          AND status NOT IN ('cancelled')
          AND (
            (start_time <= $3 AND end_time > $3) OR
            (start_time < $4 AND end_time >= $4) OR
            (start_time >= $3 AND end_time <= $4)
          )
      `, [room_id, date, start_time, end_time]);

      if (conflictResult.rows.length > 0) {
        return res.status(409).json({ error: 'Time slot already booked' });
      }

      // Check for class conflicts
      const classConflictResult = await db.query(`
        SELECT id FROM classes
        WHERE room_id = $1 AND date = $2 AND is_cancelled = FALSE
          AND (
            (start_time <= $3 AND end_time > $3) OR
            (start_time < $4 AND end_time >= $4) OR
            (start_time >= $3 AND end_time <= $4)
          )
      `, [room_id, date, start_time, end_time]);

      if (classConflictResult.rows.length > 0) {
        return res.status(409).json({ error: 'Time slot has a scheduled class' });
      }

      // Get rental price
      const priceResult = await db.query(`
        SELECT * FROM get_rental_price($1, $2::date, $3::time)
      `, [room_id, date, start_time]);

      let rentalPrice = priceResult.rows[0]?.price;
      let pricingTierId = priceResult.rows[0]?.tier_id;

      // Fall back to default if no tier
      if (!rentalPrice) {
        const roomResult = await db.query(
          'SELECT default_block_rate FROM rooms WHERE id = $1',
          [room_id]
        );
        rentalPrice = roomResult.rows[0]?.default_block_rate || 100;
      }

      // Check for teacher room credits
      const creditsResult = await db.query(`
        SELECT id, remaining FROM teacher_room_credits
        WHERE teacher_id = $1 AND status = 'active'
          AND (expires_at IS NULL OR expires_at > CURRENT_DATE)
          AND remaining > 0
        ORDER BY expires_at NULLS LAST
        LIMIT 1
      `, [teacherId]);

      let paymentStatus = 'pending';
      let creditUsed = 0;

      if (creditsResult.rows.length > 0 && creditsResult.rows[0].remaining >= rentalPrice) {
        // Apply room credit
        creditUsed = rentalPrice;
        await db.query(`
          UPDATE teacher_room_credits
          SET remaining = remaining - $1,
              status = CASE WHEN remaining - $1 <= 0 THEN 'depleted' ELSE 'active' END
          WHERE id = $2
        `, [rentalPrice, creditsResult.rows[0].id]);
        paymentStatus = 'paid';
      }

      const result = await db.query(`
        INSERT INTO room_bookings (
          room_id, teacher_id, date, start_time, end_time,
          pricing_tier_id, rental_price, payment_status, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        room_id, teacherId, date, start_time, end_time,
        pricingTierId, rentalPrice, paymentStatus, notes
      ]);

      res.status(201).json({
        booking: result.rows[0],
        credit_applied: creditUsed > 0 ? creditUsed : null
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET teacher's room bookings
router.get('/bookings/mine',
  authenticate,
  async (req, res, next) => {
    try {
      const teacherResult = await db.query(
        'SELECT id FROM teachers WHERE user_id = $1',
        [req.user.id]
      );

      if (teacherResult.rows.length === 0) {
        return res.json({ bookings: [] });
      }

      const result = await db.query(`
        SELECT
          rb.*,
          r.name as room_name, r.room_type,
          l.name as location_name
        FROM room_bookings rb
        JOIN rooms r ON rb.room_id = r.id
        JOIN locations l ON r.location_id = l.id
        WHERE rb.teacher_id = $1
        ORDER BY rb.date DESC, rb.start_time DESC
      `, [teacherResult.rows[0].id]);

      res.json({ bookings: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// CANCEL room booking
router.post('/bookings/:id/cancel',
  authenticate,
  async (req, res, next) => {
    try {
      const { id } = req.params;

      // Check ownership
      const bookingResult = await db.query(`
        SELECT rb.*, t.user_id
        FROM room_bookings rb
        JOIN teachers t ON rb.teacher_id = t.id
        WHERE rb.id = $1
      `, [id]);

      if (bookingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      const booking = bookingResult.rows[0];

      // Check if user owns booking or has manage permission
      if (booking.user_id !== req.user.id && !req.user.permissions?.includes('room.manage')) {
        return res.status(403).json({ error: 'Not authorized to cancel this booking' });
      }

      const result = await db.query(`
        UPDATE room_bookings
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
        RETURNING *
      `, [id]);

      // TODO: Handle refund logic

      res.json({ booking: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================
// MONTHLY RENTAL CONTRACTS
// ============================================

// GET all active contracts (manager+)
router.get('/contracts',
  authenticate,
  requirePermission('contract.view'),
  async (req, res, next) => {
    try {
      const { status } = req.query;

      let query = `
        SELECT
          mrc.*,
          r.name as room_name, r.room_type,
          l.name as location_name,
          u.first_name, u.last_name, u.email
        FROM monthly_rental_contracts mrc
        JOIN rooms r ON mrc.room_id = r.id
        JOIN locations l ON r.location_id = l.id
        LEFT JOIN teachers t ON mrc.teacher_id = t.id
        LEFT JOIN users u ON t.user_id = u.id OR mrc.user_id = u.id
        WHERE 1=1
      `;

      const params = [];
      if (status) {
        query += ` AND mrc.status = $1`;
        params.push(status);
      }

      query += ` ORDER BY mrc.start_date DESC`;

      const result = await db.query(query, params);
      res.json({ contracts: result.rows });
    } catch (err) {
      next(err);
    }
  }
);

// CREATE monthly contract (manager+)
router.post('/contracts',
  authenticate,
  requirePermission('contract.manage'),
  [
    body('room_id').isUUID(),
    body('monthly_rate').isFloat({ min: 0 }),
    body('start_date').isISO8601(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        room_id, teacher_id, user_id, monthly_rate, sessions_included,
        equipment_storage, start_date, end_date, initial_term_months,
        tenant_name, tenant_type, notes
      } = req.body;

      // Check room is available for monthly
      const roomResult = await db.query(
        'SELECT available_for_monthly FROM rooms WHERE id = $1',
        [room_id]
      );

      if (!roomResult.rows[0]?.available_for_monthly) {
        return res.status(400).json({ error: 'Room not available for monthly rental' });
      }

      // Check for existing active contract
      const existingResult = await db.query(`
        SELECT id FROM monthly_rental_contracts
        WHERE room_id = $1 AND status = 'active'
      `, [room_id]);

      if (existingResult.rows.length > 0) {
        return res.status(409).json({ error: 'Room already has an active contract' });
      }

      const result = await db.query(`
        INSERT INTO monthly_rental_contracts (
          room_id, teacher_id, user_id, monthly_rate, sessions_included,
          equipment_storage, start_date, end_date, initial_term_months,
          tenant_name, tenant_type, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [
        room_id, teacher_id, user_id, monthly_rate, sessions_included,
        equipment_storage ?? false, start_date, end_date, initial_term_months || 3,
        tenant_name, tenant_type, notes
      ]);

      res.status(201).json({ contract: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// UPDATE contract status
router.put('/contracts/:id',
  authenticate,
  requirePermission('contract.manage'),
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { status, monthly_rate, end_date, notes } = req.body;

      const result = await db.query(`
        UPDATE monthly_rental_contracts
        SET status = COALESCE($1, status),
            monthly_rate = COALESCE($2, monthly_rate),
            end_date = COALESCE($3, end_date),
            notes = COALESCE($4, notes),
            updated_at = NOW()
        WHERE id = $5
        RETURNING *
      `, [status, monthly_rate, end_date, notes, id]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Contract not found' });
      }

      res.json({ contract: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================
// MEMBER CO-OP CREDITS
// ============================================

// GET member's co-op credits
router.get('/credits/mine',
  authenticate,
  async (req, res, next) => {
    try {
      const result = await db.query(`
        SELECT * FROM member_coop_credits
        WHERE user_id = $1 AND period_end >= CURRENT_DATE
        ORDER BY period_end ASC
      `, [req.user.id]);

      // Get co-op settings
      const settingsResult = await db.query(
        "SELECT value FROM settings WHERE key = 'coop'"
      );

      res.json({
        credits: result.rows,
        settings: settingsResult.rows[0]?.value || {
          member_discount_percent: 25,
          credits_per_month: 2,
          max_credits_per_class: 3
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// Check if credit can be used for a class
router.get('/credits/check/:class_id',
  authenticate,
  async (req, res, next) => {
    try {
      const { class_id } = req.params;

      const result = await db.query(`
        SELECT * FROM can_use_coop_credit($1, $2)
      `, [req.user.id, class_id]);

      res.json(result.rows[0]);
    } catch (err) {
      next(err);
    }
  }
);

// ============================================
// CO-OP CLASSES
// ============================================

// GET co-op classes (public schedule)
router.get('/classes', optionalAuth, async (req, res, next) => {
  try {
    const { start_date, end_date, location_id, teacher_id } = req.query;

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 14);
      return d.toISOString().split('T')[0];
    })();

    let query = `
      SELECT
        c.id, c.date, c.start_time, c.end_time, c.capacity, c.is_cancelled,
        c.class_model, c.coop_drop_in_price, c.coop_member_price,
        ct.id as class_type_id, ct.name as class_name, ct.category, ct.level,
        ct.description as class_description,
        r.id as room_id, r.name as room_name,
        l.id as location_id, l.name as location_name, l.short_name as location_short,
        u.first_name as teacher_first_name, u.last_name as teacher_last_name,
        t.photo_url as teacher_photo,
        COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as booked_count,
        c.capacity - COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as spots_left,
        COUNT(cb.id) FILTER (WHERE cb.used_coop_credit = TRUE) as credits_used,
        (SELECT (value->>'max_credits_per_class')::INT FROM settings WHERE key = 'coop') as max_credits
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users u ON t.user_id = u.id
      LEFT JOIN rooms r ON c.room_id = r.id
      LEFT JOIN bookings b ON b.class_id = c.id
      LEFT JOIN coop_bookings cb ON cb.class_id = c.id
      WHERE c.class_model IN ('coop_rental', 'monthly_tenant')
        AND c.date BETWEEN $1 AND $2
        AND c.is_cancelled = FALSE
    `;

    const params = [startDate, endDate];
    let paramIndex = 3;

    if (location_id) {
      query += ` AND c.location_id = $${paramIndex}`;
      params.push(location_id);
      paramIndex++;
    }

    if (teacher_id) {
      query += ` AND c.teacher_id = $${paramIndex}`;
      params.push(teacher_id);
      paramIndex++;
    }

    query += `
      GROUP BY c.id, ct.id, r.id, l.id, t.id, u.id
      ORDER BY c.date, c.start_time
    `;

    const result = await db.query(query, params);

    res.json({
      start_date: startDate,
      end_date: endDate,
      classes: result.rows
    });
  } catch (err) {
    next(err);
  }
});

// CREATE co-op class (teacher with room booking)
router.post('/classes',
  authenticate,
  requirePermission('coop.create'),
  [
    body('room_booking_id').isUUID(),
    body('class_type_id').isUUID(),
    body('coop_drop_in_price').isFloat({ min: 0 }),
    body('capacity').optional().isInt({ min: 1 }),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const {
        room_booking_id, class_type_id, coop_drop_in_price, capacity, notes
      } = req.body;

      // Get room booking details
      const bookingResult = await db.query(`
        SELECT rb.*, r.location_id, r.capacity as room_capacity, t.user_id
        FROM room_bookings rb
        JOIN rooms r ON rb.room_id = r.id
        JOIN teachers t ON rb.teacher_id = t.id
        WHERE rb.id = $1
      `, [room_booking_id]);

      if (bookingResult.rows.length === 0) {
        return res.status(404).json({ error: 'Room booking not found' });
      }

      const booking = bookingResult.rows[0];

      // Verify ownership
      if (booking.user_id !== req.user.id && !req.user.permissions?.includes('coop.manage')) {
        return res.status(403).json({ error: 'Not authorized' });
      }

      // Calculate member price (25% off)
      const coopMemberPrice = Math.round(coop_drop_in_price * 0.75 * 100) / 100;

      const result = await db.query(`
        INSERT INTO classes (
          class_type_id, teacher_id, location_id, room_id, room_booking_id,
          date, start_time, end_time, capacity, class_model,
          coop_drop_in_price, coop_member_price, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'coop_rental', $10, $11, $12)
        RETURNING *
      `, [
        class_type_id, booking.teacher_id, booking.location_id, booking.room_id,
        room_booking_id, booking.date, booking.start_time, booking.end_time,
        capacity || booking.room_capacity, coop_drop_in_price, coopMemberPrice, notes
      ]);

      // Link booking to class
      await db.query(
        'UPDATE room_bookings SET class_id = $1 WHERE id = $2',
        [result.rows[0].id, room_booking_id]
      );

      res.status(201).json({ class: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================
// BOOK CO-OP CLASS (with member benefits)
// ============================================

// Book a co-op class (members get 25% off + can use credits)
router.post('/classes/:class_id/book',
  authenticate,
  [
    body('use_credit').optional().isBoolean(),
  ],
  async (req, res, next) => {
    const client = await db.getClient();

    try {
      const { class_id } = req.params;
      const { use_credit } = req.body;
      const userId = req.user.id;

      await client.query('BEGIN');

      // Get class details with lock
      const classResult = await client.query(`
        SELECT
          c.*,
          ct.name as class_name,
          l.name as location_name,
          r.name as room_name,
          u.first_name as teacher_first_name, u.last_name as teacher_last_name,
          (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status IN ('booked', 'checked_in')) as booked_count,
          (SELECT COUNT(*) FROM coop_bookings WHERE class_id = c.id AND used_coop_credit = TRUE) as credits_used_count
        FROM classes c
        JOIN class_types ct ON c.class_type_id = ct.id
        JOIN locations l ON c.location_id = l.id
        JOIN teachers t ON c.teacher_id = t.id
        JOIN users u ON t.user_id = u.id
        LEFT JOIN rooms r ON c.room_id = r.id
        WHERE c.id = $1 AND c.class_model IN ('coop_rental', 'monthly_tenant')
        FOR UPDATE OF c
      `, [class_id]);

      if (classResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Co-op class not found' });
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
        'SELECT id FROM bookings WHERE user_id = $1 AND class_id = $2 AND status IN (\'booked\', \'checked_in\')',
        [userId, class_id]
      );

      if (existingBooking.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(409).json({ error: 'Already booked for this class' });
      }

      // Check capacity
      const spotsLeft = classData.capacity - parseInt(classData.booked_count);
      if (spotsLeft <= 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Class is full' });
      }

      // Get co-op settings
      const settingsResult = await client.query(
        "SELECT value FROM settings WHERE key = 'coop'"
      );
      const coopSettings = settingsResult.rows[0]?.value || {
        member_discount_percent: 25,
        max_credits_per_class: 3
      };

      // Check if user is a member (has active membership)
      const membershipResult = await client.query(`
        SELECT um.id, mt.type
        FROM user_memberships um
        JOIN membership_types mt ON um.membership_type_id = mt.id
        WHERE um.user_id = $1 AND um.status = 'active'
          AND (um.end_date IS NULL OR um.end_date >= CURRENT_DATE)
        LIMIT 1
      `, [userId]);

      const isMember = membershipResult.rows.length > 0;
      const dropInPrice = parseFloat(classData.coop_drop_in_price);
      const memberPrice = parseFloat(classData.coop_member_price);

      let finalPrice = isMember ? memberPrice : dropInPrice;
      let usedCoopCredit = false;
      let coopCreditId = null;

      // Handle credit usage if requested and user is a member
      if (use_credit && isMember) {
        // Check credit cap for class
        const creditsUsedInClass = parseInt(classData.credits_used_count);
        const maxCredits = coopSettings.max_credits_per_class || 3;

        if (creditsUsedInClass >= maxCredits) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            error: 'Credit limit reached',
            message: `This class has reached the maximum of ${maxCredits} credit spots`
          });
        }

        // Check if user has available credits
        const creditResult = await client.query(`
          SELECT id, credits_remaining
          FROM member_coop_credits
          WHERE user_id = $1
            AND period_end >= CURRENT_DATE
            AND credits_remaining > 0
          ORDER BY period_end ASC
          LIMIT 1
        `, [userId]);

        if (creditResult.rows.length > 0) {
          coopCreditId = creditResult.rows[0].id;
          usedCoopCredit = true;
          finalPrice = 0;

          // Deduct credit
          await client.query(`
            UPDATE member_coop_credits
            SET credits_remaining = credits_remaining - 1, updated_at = NOW()
            WHERE id = $1
          `, [coopCreditId]);
        } else {
          // No credits available, but still allow booking at member price
          finalPrice = memberPrice;
        }
      }

      // Create regular booking record
      const bookingResult = await client.query(`
        INSERT INTO bookings (user_id, class_id, status, booking_source)
        VALUES ($1, $2, 'booked', 'web')
        RETURNING *
      `, [userId, class_id]);

      // Create co-op booking record with pricing details
      const coopBookingResult = await client.query(`
        INSERT INTO coop_bookings (
          booking_id, class_id, user_id,
          original_price, member_discount_percent, final_price,
          used_coop_credit, coop_credit_id,
          payment_status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [
        bookingResult.rows[0].id,
        class_id,
        userId,
        dropInPrice,
        isMember ? coopSettings.member_discount_percent : 0,
        finalPrice,
        usedCoopCredit,
        coopCreditId,
        usedCoopCredit ? 'credit_used' : (finalPrice === 0 ? 'paid' : 'pending')
      ]);

      await client.query('COMMIT');

      res.status(201).json({
        message: 'Co-op class booked successfully',
        booking: {
          id: bookingResult.rows[0].id,
          coop_booking_id: coopBookingResult.rows[0].id,
          status: 'booked',
          class: {
            name: classData.class_name,
            date: classData.date,
            time: classData.start_time,
            location: classData.location_name,
            room: classData.room_name,
            teacher: `${classData.teacher_first_name} ${classData.teacher_last_name}`
          },
          pricing: {
            original_price: dropInPrice,
            is_member: isMember,
            member_discount: isMember ? `${coopSettings.member_discount_percent}%` : null,
            used_credit: usedCoopCredit,
            final_price: finalPrice
          }
        }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      next(error);
    } finally {
      client.release();
    }
  }
);

// GET co-op class pricing for user (shows what they'd pay)
router.get('/classes/:class_id/pricing',
  authenticate,
  async (req, res, next) => {
    try {
      const { class_id } = req.params;
      const userId = req.user.id;

      // Get class pricing
      const classResult = await db.query(`
        SELECT coop_drop_in_price, coop_member_price
        FROM classes
        WHERE id = $1 AND class_model IN ('coop_rental', 'monthly_tenant')
      `, [class_id]);

      if (classResult.rows.length === 0) {
        return res.status(404).json({ error: 'Co-op class not found' });
      }

      const classData = classResult.rows[0];

      // Check membership
      const membershipResult = await db.query(`
        SELECT id FROM user_memberships
        WHERE user_id = $1 AND status = 'active'
          AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        LIMIT 1
      `, [userId]);

      const isMember = membershipResult.rows.length > 0;

      // Check available credits
      const creditResult = await db.query(`
        SELECT SUM(credits_remaining) as available_credits
        FROM member_coop_credits
        WHERE user_id = $1
          AND period_end >= CURRENT_DATE
          AND credits_remaining > 0
      `, [userId]);

      // Check credit availability for this class
      const classCreditsResult = await db.query(`
        SELECT
          (SELECT COUNT(*) FROM coop_bookings WHERE class_id = $1 AND used_coop_credit = TRUE) as credits_used,
          (SELECT (value->>'max_credits_per_class')::INT FROM settings WHERE key = 'coop') as max_credits
      `, [class_id]);

      const creditsUsedInClass = parseInt(classCreditsResult.rows[0]?.credits_used || 0);
      const maxCredits = parseInt(classCreditsResult.rows[0]?.max_credits || 3);
      const creditSpotsAvailable = maxCredits - creditsUsedInClass;

      res.json({
        pricing: {
          drop_in_price: parseFloat(classData.coop_drop_in_price),
          member_price: parseFloat(classData.coop_member_price),
          is_member: isMember,
          your_price: isMember
            ? parseFloat(classData.coop_member_price)
            : parseFloat(classData.coop_drop_in_price)
        },
        credits: {
          available: parseInt(creditResult.rows[0]?.available_credits || 0),
          can_use_credit: isMember && creditSpotsAvailable > 0 && parseInt(creditResult.rows[0]?.available_credits || 0) > 0,
          class_credit_spots_remaining: creditSpotsAvailable
        }
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================
// TEACHER REFERRALS
// ============================================

// GET teacher's referrals
router.get('/referrals/mine',
  authenticate,
  async (req, res, next) => {
    try {
      const teacherResult = await db.query(
        'SELECT id FROM teachers WHERE user_id = $1',
        [req.user.id]
      );

      if (teacherResult.rows.length === 0) {
        return res.json({ referrals: [], summary: null });
      }

      const teacherId = teacherResult.rows[0].id;

      const referralsResult = await db.query(`
        SELECT
          tr.*,
          u.first_name, u.last_name, u.email
        FROM teacher_referrals tr
        JOIN users u ON tr.referred_user_id = u.id
        WHERE tr.referring_teacher_id = $1
        ORDER BY tr.referral_date DESC
      `, [teacherId]);

      const summaryResult = await db.query(`
        SELECT * FROM teacher_referral_summary WHERE teacher_id = $1
      `, [teacherId]);

      res.json({
        referrals: referralsResult.rows,
        summary: summaryResult.rows[0] || null
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET teacher's room credits
router.get('/referrals/credits',
  authenticate,
  async (req, res, next) => {
    try {
      const teacherResult = await db.query(
        'SELECT id FROM teachers WHERE user_id = $1',
        [req.user.id]
      );

      if (teacherResult.rows.length === 0) {
        return res.json({ credits: [], total_available: 0 });
      }

      const result = await db.query(`
        SELECT * FROM teacher_room_credits
        WHERE teacher_id = $1 AND status = 'active'
        ORDER BY expires_at NULLS LAST
      `, [teacherResult.rows[0].id]);

      const total = result.rows.reduce((sum, c) => sum + parseFloat(c.remaining), 0);

      res.json({
        credits: result.rows,
        total_available: total
      });
    } catch (err) {
      next(err);
    }
  }
);

// CREATE referral (when member signs up)
router.post('/referrals',
  authenticate,
  requirePermission('referral.manage'),
  [
    body('referring_teacher_id').isUUID(),
    body('referred_user_id').isUUID(),
  ],
  async (req, res, next) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { referring_teacher_id, referred_user_id, referral_source, notes } = req.body;

      const result = await db.query(`
        INSERT INTO teacher_referrals (
          referring_teacher_id, referred_user_id, referral_source, notes
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `, [referring_teacher_id, referred_user_id, referral_source || 'manual', notes]);

      res.status(201).json({ referral: result.rows[0] });
    } catch (err) {
      next(err);
    }
  }
);

// CONVERT referral (when referred user becomes member)
router.post('/referrals/:id/convert',
  authenticate,
  requirePermission('referral.manage'),
  [
    body('membership_id').isUUID(),
  ],
  async (req, res, next) => {
    try {
      const { id } = req.params;
      const { membership_id } = req.body;

      // Update referral
      const referralResult = await db.query(`
        UPDATE teacher_referrals
        SET converted_to_member = TRUE,
            membership_id = $1,
            conversion_date = CURRENT_DATE,
            bonus_status = 'approved',
            updated_at = NOW()
        WHERE id = $2
        RETURNING *
      `, [membership_id, id]);

      if (referralResult.rows.length === 0) {
        return res.status(404).json({ error: 'Referral not found' });
      }

      const referral = referralResult.rows[0];

      // Create room credit for teacher
      await db.query(`
        INSERT INTO teacher_room_credits (
          teacher_id, amount, remaining, source_type, referral_id, notes
        ) VALUES ($1, $2, $2, 'referral_bonus', $3, 'Referral bonus for new member conversion')
      `, [referral.referring_teacher_id, referral.bonus_amount, id]);

      // Update referral bonus status
      await db.query(`
        UPDATE teacher_referrals
        SET bonus_status = 'paid', bonus_paid_at = NOW()
        WHERE id = $1
      `, [id]);

      res.json({
        referral: referral,
        message: `$${referral.bonus_amount} room credit issued to teacher`
      });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================
// CO-OP SETTINGS
// ============================================

// GET co-op settings (public)
router.get('/settings', async (req, res, next) => {
  try {
    const result = await db.query(
      "SELECT value FROM settings WHERE key = 'coop'"
    );

    res.json({
      settings: result.rows[0]?.value || {
        member_discount_percent: 25,
        credits_per_month: 2,
        max_credits_per_class: 3,
        credits_rollover: false
      }
    });
  } catch (err) {
    next(err);
  }
});

// UPDATE co-op settings (admin)
router.put('/settings',
  authenticate,
  requirePermission('settings.edit'),
  async (req, res, next) => {
    try {
      const settings = req.body;

      const result = await db.query(`
        UPDATE settings
        SET value = $1, updated_at = NOW()
        WHERE key = 'coop'
        RETURNING *
      `, [JSON.stringify(settings)]);

      res.json({ settings: result.rows[0]?.value });
    } catch (err) {
      next(err);
    }
  }
);

// ============================================
// FINANCIAL SUMMARY
// ============================================

// GET co-op revenue summary (manager+)
router.get('/reports/revenue',
  authenticate,
  requirePermission('report.financial'),
  async (req, res, next) => {
    try {
      const { start_date, end_date } = req.query;

      const startDate = start_date || (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
      })();
      const endDate = end_date || new Date().toISOString().split('T')[0];

      // Room booking revenue
      const bookingRevenueResult = await db.query(`
        SELECT
          COUNT(*) as total_bookings,
          SUM(rental_price) as total_revenue,
          SUM(CASE WHEN payment_status = 'paid' THEN rental_price ELSE 0 END) as collected
        FROM room_bookings
        WHERE date BETWEEN $1 AND $2
          AND status NOT IN ('cancelled')
      `, [startDate, endDate]);

      // Monthly contract revenue
      const contractRevenueResult = await db.query(`
        SELECT
          COUNT(*) as active_contracts,
          SUM(monthly_rate) as monthly_revenue
        FROM monthly_rental_contracts
        WHERE status = 'active'
      `, []);

      // Co-op class revenue (paid by students)
      const classRevenueResult = await db.query(`
        SELECT
          COUNT(DISTINCT c.id) as total_classes,
          COUNT(cb.id) as total_bookings,
          SUM(cb.final_price) FILTER (WHERE cb.payment_status = 'paid') as student_payments,
          COUNT(cb.id) FILTER (WHERE cb.used_coop_credit = TRUE) as credit_uses
        FROM classes c
        LEFT JOIN coop_bookings cb ON cb.class_id = c.id
        WHERE c.class_model IN ('coop_rental', 'monthly_tenant')
          AND c.date BETWEEN $1 AND $2
      `, [startDate, endDate]);

      // Referral stats
      const referralResult = await db.query(`
        SELECT
          COUNT(*) as total_referrals,
          COUNT(*) FILTER (WHERE converted_to_member = TRUE) as conversions,
          SUM(bonus_amount) FILTER (WHERE bonus_status = 'paid') as bonuses_paid
        FROM teacher_referrals
        WHERE referral_date BETWEEN $1 AND $2
      `, [startDate, endDate]);

      res.json({
        period: { start_date: startDate, end_date: endDate },
        room_rentals: bookingRevenueResult.rows[0],
        monthly_contracts: contractRevenueResult.rows[0],
        coop_classes: classRevenueResult.rows[0],
        referrals: referralResult.rows[0]
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
