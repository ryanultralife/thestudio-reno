// API routes for class series and multi-week programs (YTT, workshops, intensives)
const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');
const db = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');

// ============================================
// GET ALL SERIES
// ============================================

router.get('/', async (req, res, next) => {
  try {
    const {
      category,
      published_only = 'true',
      include_full = 'false',
      upcoming_only = 'true'
    } = req.query;

    let query = `
      SELECT
        cs.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        (SELECT COUNT(*) FROM series_registrations WHERE series_id = cs.id AND status IN ('confirmed', 'completed')) as enrolled_count,
        (SELECT COUNT(*) FROM classes WHERE series_id = cs.id) as scheduled_sessions
      FROM class_series cs
      LEFT JOIN users u ON cs.created_by = u.id
      WHERE 1=1
    `;

    const params = [];
    let paramCount = 1;

    if (published_only === 'true') {
      query += ` AND cs.is_published = true`;
    }

    if (include_full === 'false') {
      query += ` AND cs.is_full = false`;
    }

    if (upcoming_only === 'true') {
      query += ` AND cs.start_date >= CURRENT_DATE`;
    }

    if (category) {
      query += ` AND cs.category = $${paramCount}`;
      params.push(category);
      paramCount++;
    }

    query += ` ORDER BY cs.start_date ASC, cs.created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      series: result.rows,
      count: result.rows.length,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET SINGLE SERIES
// ============================================

router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        cs.*,
        u.first_name || ' ' || u.last_name as created_by_name,
        u.email as created_by_email,
        (SELECT COUNT(*) FROM series_registrations WHERE series_id = cs.id AND status IN ('confirmed', 'completed')) as enrolled_count,
        (SELECT COUNT(*) FROM series_registrations WHERE series_id = cs.id AND status = 'waitlist') as waitlist_count,
        (SELECT json_agg(
          json_build_object(
            'id', c.id,
            'date', c.date,
            'start_time', c.start_time,
            'end_time', c.end_time,
            'session_number', c.session_number,
            'is_cancelled', c.is_cancelled
          ) ORDER BY c.session_number
        ) FROM classes c WHERE c.series_id = cs.id) as sessions
      FROM class_series cs
      LEFT JOIN users u ON cs.created_by = u.id
      WHERE cs.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE SERIES
// ============================================

router.post('/', authenticate, requirePermission('series.create'), [
  body('name').trim().notEmpty().isLength({ max: 200 }),
  body('description').trim().notEmpty(),
  body('category').isIn(['teacher_training', 'workshop_series', 'intensive', 'retreat', 'specialty']),
  body('start_date').isISO8601(),
  body('end_date').isISO8601(),
  body('total_hours').optional().isFloat({ min: 0 }),
  body('total_sessions').optional().isInt({ min: 1 }),
  body('total_price').isFloat({ min: 0 }),
  body('deposit_amount').optional().isFloat({ min: 0 }),
  body('allow_payment_plan').optional().isBoolean(),
  body('payment_plan_installments').optional().isInt({ min: 2, max: 12 }),
  body('payment_plan_interval').optional().isIn(['weekly', 'monthly', 'custom']),
  body('min_participants').optional().isInt({ min: 1 }),
  body('max_participants').isInt({ min: 1 }),
  body('prerequisites').optional().trim(),
  body('materials_included').optional().trim(),
  body('registration_deadline').optional().isISO8601(),
], async (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const {
      name,
      description,
      category,
      start_date,
      end_date,
      total_hours,
      total_sessions,
      total_price,
      deposit_amount,
      allow_payment_plan,
      payment_plan_installments,
      payment_plan_interval,
      min_participants,
      max_participants,
      prerequisites,
      materials_included,
      registration_deadline,
      is_published = false,
    } = req.body;

    // Validate dates
    if (new Date(start_date) >= new Date(end_date)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    if (registration_deadline && new Date(registration_deadline) >= new Date(start_date)) {
      return res.status(400).json({ error: 'Registration deadline must be before start date' });
    }

    // Check if user is teacher or admin
    const userCheck = await db.query(
      'SELECT role FROM users WHERE id = $1',
      [req.user.id]
    );

    const isCoopSeries = userCheck.rows[0]?.role === 'teacher';

    const result = await db.query(`
      INSERT INTO class_series (
        name, description, category, start_date, end_date,
        total_hours, total_sessions, total_price, deposit_amount,
        allow_payment_plan, payment_plan_installments, payment_plan_interval,
        min_participants, max_participants, prerequisites, materials_included,
        registration_deadline, is_published, is_coop_series, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
      RETURNING *
    `, [
      name, description, category, start_date, end_date,
      total_hours, total_sessions, total_price, deposit_amount,
      allow_payment_plan, payment_plan_installments, payment_plan_interval,
      min_participants, max_participants, prerequisites, materials_included,
      registration_deadline, is_published, isCoopSeries, req.user.id
    ]);

    res.status(201).json({
      message: 'Series created successfully',
      series: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE SERIES
// ============================================

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check ownership or admin permission
    const seriesCheck = await db.query(
      'SELECT created_by, is_coop_series FROM class_series WHERE id = $1',
      [id]
    );

    if (seriesCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Series not found' });
    }

    const series = seriesCheck.rows[0];
    const isOwner = series.created_by === req.user.id;

    if (!isOwner && !req.user.permissions?.includes('series.manage_all')) {
      return res.status(403).json({ error: 'Permission denied' });
    }

    // Allow updating specific fields
    const allowedFields = [
      'description', 'prerequisites', 'materials_included',
      'is_published', 'registration_deadline', 'max_participants'
    ];

    const updates = [];
    const params = [id];
    let paramCount = 2;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${paramCount}`);
        params.push(req.body[field]);
        paramCount++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push(`updated_at = NOW()`);

    const query = `
      UPDATE class_series
      SET ${updates.join(', ')}
      WHERE id = $1
      RETURNING *
    `;

    const result = await db.query(query, params);

    res.json({
      message: 'Series updated successfully',
      series: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REGISTER FOR SERIES
// ============================================

router.post('/:id/register', authenticate, [
  body('special_requests').optional().trim(),
  body('payment_plan').optional().isBoolean(),
], async (req, res, next) => {
  const client = await db.getClient();

  try {
    const { id } = req.params;
    const { special_requests, payment_plan = false } = req.body;
    const userId = req.user.id;

    await client.query('BEGIN');

    // Get series details
    const seriesResult = await client.query(`
      SELECT
        cs.*,
        (SELECT COUNT(*) FROM series_registrations WHERE series_id = cs.id AND status IN ('confirmed', 'completed')) as enrolled_count
      FROM class_series cs
      WHERE cs.id = $1
      FOR UPDATE
    `, [id]);

    if (seriesResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Series not found' });
    }

    const series = seriesResult.rows[0];

    // Check if already registered
    const existingReg = await client.query(
      'SELECT id, status FROM series_registrations WHERE user_id = $1 AND series_id = $2',
      [userId, id]
    );

    if (existingReg.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(409).json({
        error: 'Already registered',
        registration: existingReg.rows[0],
      });
    }

    // Check capacity
    let status = 'pending';
    if (series.enrolled_count >= series.max_participants) {
      status = 'waitlist';
    } else {
      status = 'confirmed';
    }

    // Check if past registration deadline
    if (series.registration_deadline && new Date(series.registration_deadline) < new Date()) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Registration deadline has passed' });
    }

    // Create registration
    const regResult = await client.query(`
      INSERT INTO series_registrations (
        user_id, series_id, status, special_requests, payment_plan_active
      )
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [userId, id, status, special_requests, payment_plan && series.allow_payment_plan]);

    const registration = regResult.rows[0];

    // Create payment records if using payment plan
    if (payment_plan && series.allow_payment_plan) {
      const installmentAmount = (series.total_price - (series.deposit_amount || 0)) / series.payment_plan_installments;

      // Create deposit payment
      if (series.deposit_amount) {
        await client.query(`
          INSERT INTO series_payments (
            registration_id, amount, payment_type, status, due_date
          )
          VALUES ($1, $2, 'deposit', 'pending', CURRENT_DATE + INTERVAL '7 days')
        `, [registration.id, series.deposit_amount]);
      }

      // Create installment payments
      for (let i = 0; i < series.payment_plan_installments; i++) {
        const dueDate = new Date(series.start_date);
        if (series.payment_plan_interval === 'monthly') {
          dueDate.setMonth(dueDate.getMonth() + i);
        } else if (series.payment_plan_interval === 'weekly') {
          dueDate.setDate(dueDate.getDate() + (i * 7));
        }

        await client.query(`
          INSERT INTO series_payments (
            registration_id, amount, payment_type, status, due_date
          )
          VALUES ($1, $2, 'installment', 'pending', $3)
        `, [registration.id, installmentAmount, dueDate]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: status === 'waitlist' ? 'Added to waitlist' : 'Registration successful',
      registration,
      status,
      payment_plan_active: payment_plan && series.allow_payment_plan,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ============================================
// GET MY REGISTRATIONS
// ============================================

router.get('/my/registrations', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT
        sr.*,
        cs.name as series_name,
        cs.start_date,
        cs.end_date,
        cs.total_price,
        cs.category,
        (SELECT COUNT(*) FROM series_attendance sa WHERE sa.registration_id = sr.id AND sa.attended = true) as sessions_attended,
        (SELECT COUNT(*) FROM classes c WHERE c.series_id = cs.id) as total_sessions
      FROM series_registrations sr
      JOIN class_series cs ON sr.series_id = cs.id
      WHERE sr.user_id = $1
      ORDER BY cs.start_date DESC
    `, [req.user.id]);

    res.json({
      registrations: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET SERIES REGISTRATIONS (for teachers/admins)
// ============================================

router.get('/:id/registrations', authenticate, requirePermission('series.manage_registrations'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT
        sr.*,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        (SELECT COUNT(*) FROM series_attendance sa WHERE sa.registration_id = sr.id AND sa.attended = true) as sessions_attended
      FROM series_registrations sr
      JOIN users u ON sr.user_id = u.id
      WHERE sr.series_id = $1
      ORDER BY sr.registration_date ASC
    `, [id]);

    res.json({
      registrations: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
