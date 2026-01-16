// ============================================
// AUTHENTICATION ROUTES
// ============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const db = require('../database/connection');
const { authenticate, generateToken } = require('../middleware/auth');
const notifications = require('../services/notifications');

const router = express.Router();

// ============================================
// REGISTER
// ============================================

router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('first_name').trim().notEmpty(),
  body('last_name').trim().optional(),
  body('phone').trim().optional(),
  body('email_opt_in').optional().isBoolean(),
  body('sms_opt_in').optional().isBoolean(),
], async (req, res, next) => {
  const client = await db.getClient();

  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const {
      email,
      password,
      first_name,
      last_name,
      phone,
      email_opt_in = true,  // Default to true (user can opt out)
      sms_opt_in = false    // Default to false (must opt in)
    } = req.body;

    // Check if exists
    const existing = await client.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    await client.query('BEGIN');

    // Create user
    const password_hash = await bcrypt.hash(password, 12);
    const userResult = await client.query(
      `INSERT INTO users (email, password_hash, first_name, last_name, phone, email_opt_in, sms_opt_in, notifications_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7, true)
       RETURNING id, email, first_name, last_name, phone, role, email_opt_in, sms_opt_in, created_at`,
      [email, password_hash, first_name, last_name, phone, email_opt_in, sms_opt_in]
    );

    const user = userResult.rows[0];

    // Check for required waivers
    const waivers = await client.query(
      'SELECT id, name FROM waiver_templates WHERE is_required = true AND is_active = true'
    );

    await client.query('COMMIT');

    const token = generateToken(user.id);

    // Send welcome notification (async, don't wait)
    notifications.notifyWelcome(user.id).catch(console.error);

    res.status(201).json({
      message: 'Registration successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      token,
      pending_waivers: waivers.rows,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ============================================
// LOGIN
// ============================================

router.post('/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed' });
    }

    const { email, password } = req.body;

    const result = await db.query(
      `SELECT id, email, password_hash, first_name, last_name, role, is_active
       FROM users WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    if (!user.is_active) {
      return res.status(403).json({ error: 'Account deactivated' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update last login
    await db.query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

    const token = generateToken(user.id);

    // Check for unsigned waivers
    const pendingWaivers = await db.query(`
      SELECT wt.id, wt.name 
      FROM waiver_templates wt
      WHERE wt.is_required = true AND wt.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM signed_waivers sw 
          WHERE sw.user_id = $1 AND sw.waiver_template_id = wt.id
        )
    `, [user.id]);

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role,
      },
      token,
      pending_waivers: pendingWaivers.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET CURRENT USER
// ============================================

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
        u.avatar_url, u.date_of_birth, u.emergency_contact_name, u.emergency_contact_phone,
        u.created_at,
        mt.name as membership_name, mt.type as membership_type,
        um.end_date as membership_expires, um.credits_remaining,
        um.status as membership_status
      FROM users u
      LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
      LEFT JOIN membership_types mt ON mt.id = um.membership_type_id
      WHERE u.id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = result.rows[0];

    // Get upcoming bookings count
    const bookingsResult = await db.query(`
      SELECT COUNT(*) FROM bookings b
      JOIN classes c ON b.class_id = c.id
      WHERE b.user_id = $1 AND b.status = 'booked' AND c.date >= CURRENT_DATE
    `, [req.user.id]);

    // Get tags
    const tagsResult = await db.query(`
      SELECT t.name, t.color FROM user_tags ut
      JOIN tags t ON ut.tag_id = t.id
      WHERE ut.user_id = $1
    `, [req.user.id]);

    res.json({
      ...user,
      upcoming_bookings: parseInt(bookingsResult.rows[0].count),
      tags: tagsResult.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE PROFILE
// ============================================

router.put('/me', authenticate, [
  body('first_name').optional().trim().notEmpty(),
  body('last_name').optional().trim(),
  body('phone').optional().trim(),
  body('date_of_birth').optional().isISO8601(),
  body('emergency_contact_name').optional().trim(),
  body('emergency_contact_phone').optional().trim(),
], async (req, res, next) => {
  try {
    const allowedFields = [
      'first_name', 'last_name', 'phone', 'date_of_birth',
      'emergency_contact_name', 'emergency_contact_phone', 'avatar_url'
    ];

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

    values.push(req.user.id);
    const result = await db.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, first_name, last_name, phone, role`,
      values
    );

    res.json({ message: 'Profile updated', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CHANGE PASSWORD
// ============================================

router.post('/change-password', authenticate, [
  body('current_password').notEmpty(),
  body('new_password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
], async (req, res, next) => {
  try {
    const { current_password, new_password } = req.body;

    const result = await db.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user.id]
    );

    const validPassword = await bcrypt.compare(current_password, result.rows[0].password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Current password incorrect' });
    }

    const newHash = await bcrypt.hash(new_password, 12);
    await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [newHash, req.user.id]
    );

    res.json({ message: 'Password updated' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SIGN WAIVER
// ============================================

router.post('/waivers/:waiverId/sign', authenticate, [
  body('signature_data').notEmpty(),
  body('signature_type').isIn(['drawn', 'typed']),
], async (req, res, next) => {
  try {
    const { waiverId } = req.params;
    const { signature_data, signature_type } = req.body;

    // Check waiver exists
    const waiver = await db.query(
      'SELECT id, name FROM waiver_templates WHERE id = $1 AND is_active = true',
      [waiverId]
    );

    if (waiver.rows.length === 0) {
      return res.status(404).json({ error: 'Waiver not found' });
    }

    // Sign waiver
    await db.query(`
      INSERT INTO signed_waivers (user_id, waiver_template_id, signature_data, signature_type, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, waiver_template_id) DO UPDATE SET
        signature_data = $3, signature_type = $4, signed_at = NOW()
    `, [req.user.id, waiverId, signature_data, signature_type, req.ip, req.get('user-agent')]);

    res.json({ message: 'Waiver signed', waiver: waiver.rows[0].name });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET REQUIRED WAIVERS
// ============================================

router.get('/waivers/required', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT wt.id, wt.name, wt.content, wt.version,
             sw.signed_at
      FROM waiver_templates wt
      LEFT JOIN signed_waivers sw ON sw.waiver_template_id = wt.id AND sw.user_id = $1
      WHERE wt.is_required = true AND wt.is_active = true
      ORDER BY sw.signed_at NULLS FIRST
    `, [req.user.id]);

    const waivers = result.rows.map(w => ({
      ...w,
      signed: !!w.signed_at,
    }));

    res.json({ waivers });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
