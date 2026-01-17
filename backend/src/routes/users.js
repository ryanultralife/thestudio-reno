// ============================================
// USER MANAGEMENT ROUTES
// ============================================

const express = require('express');
const bcrypt = require('bcryptjs');
const { body, query, validationResult } = require('express-validator');
const db = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ============================================
// SEARCH USERS (Staff)
// ============================================

router.get('/search', requirePermission('user.view_basic'), async (req, res, next) => {
  try {
    const { q, role, status, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
        u.created_at, u.last_login, u.is_active,
        mt.name as membership_name, um.status as membership_status,
        um.credits_remaining, um.end_date as membership_expires
      FROM users u
      LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
      LEFT JOIN membership_types mt ON mt.id = um.membership_type_id
      WHERE 1=1
    `;

    const params = [];
    let paramIndex = 1;

    if (q) {
      query += ` AND (
        u.first_name ILIKE $${paramIndex} OR 
        u.last_name ILIKE $${paramIndex} OR 
        u.email ILIKE $${paramIndex} OR
        u.phone ILIKE $${paramIndex}
      )`;
      params.push(`%${q}%`);
      paramIndex++;
    }

    if (role) {
      query += ` AND u.role = $${paramIndex}`;
      params.push(role);
      paramIndex++;
    }

    if (status === 'active') {
      query += ` AND u.is_active = true`;
    } else if (status === 'inactive') {
      query += ` AND u.is_active = false`;
    }

    query += ` ORDER BY u.last_name, u.first_name LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count
    const countResult = await db.query(
      'SELECT COUNT(*) FROM users WHERE is_active = true',
    );

    res.json({
      users: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET USER DETAILS (Staff)
// ============================================

router.get('/:id', requirePermission('user.view_basic'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const userResult = await db.query(`
      SELECT 
        u.id, u.email, u.first_name, u.last_name, u.phone, u.role,
        u.avatar_url, u.date_of_birth, u.emergency_contact_name, u.emergency_contact_phone,
        u.created_at, u.last_login, u.is_active
      FROM users u
      WHERE u.id = $1
    `, [id]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];

    // Get memberships
    const memberships = await db.query(`
      SELECT um.*, mt.name, mt.type
      FROM user_memberships um
      JOIN membership_types mt ON um.membership_type_id = mt.id
      WHERE um.user_id = $1
      ORDER BY um.created_at DESC
    `, [id]);

    // Get recent bookings
    const bookings = await db.query(`
      SELECT 
        b.id, b.status, b.booked_at, b.checked_in_at,
        c.date, c.start_time,
        ct.name as class_name
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      WHERE b.user_id = $1
      ORDER BY c.date DESC, c.start_time DESC
      LIMIT 20
    `, [id]);

    // Get tags
    const tags = await db.query(`
      SELECT t.id, t.name, t.color
      FROM user_tags ut
      JOIN tags t ON ut.tag_id = t.id
      WHERE ut.user_id = $1
    `, [id]);

    // Get notes (if permission)
    const notes = await db.query(`
      SELECT n.id, n.note, n.created_at, u.first_name as created_by
      FROM user_notes n
      JOIN users u ON n.created_by = u.id
      WHERE n.user_id = $1 AND n.is_private = false
      ORDER BY n.created_at DESC
    `, [id]);

    // Get signed waivers
    const waivers = await db.query(`
      SELECT wt.name, sw.signed_at
      FROM signed_waivers sw
      JOIN waiver_templates wt ON sw.waiver_template_id = wt.id
      WHERE sw.user_id = $1
    `, [id]);

    // Stats
    const stats = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'checked_in') as total_classes,
        COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
        COUNT(*) FILTER (WHERE status = 'late_cancel') as late_cancels,
        MAX(c.date) FILTER (WHERE b.status = 'checked_in') as last_visit
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      WHERE b.user_id = $1
    `, [id]);

    res.json({
      user,
      memberships: memberships.rows,
      recent_bookings: bookings.rows,
      tags: tags.rows,
      notes: notes.rows,
      waivers: waivers.rows,
      stats: stats.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CREATE USER (Staff)
// ============================================

router.post('/', requirePermission('user.create'), [
  body('email').isEmail().normalizeEmail(),
  body('first_name').trim().notEmpty(),
  body('last_name').trim().optional(),
  body('phone').trim().optional(),
  body('role').optional().isIn(['student', 'teacher', 'front_desk', 'manager']),
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ error: 'Validation failed', details: errors.array() });
    }

    const { email, first_name, last_name, phone, role = 'student' } = req.body;

    // Check if exists
    const existing = await db.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    // Generate temporary password
    const tempPassword = Math.random().toString(36).slice(-8);
    const password_hash = await bcrypt.hash(tempPassword, 12);

    const result = await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, email, first_name, last_name, phone, role, created_at
    `, [email, password_hash, first_name, last_name, phone, role]);

    res.status(201).json({
      message: 'User created',
      user: result.rows[0],
      temp_password: tempPassword, // Should be emailed to user
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE USER (Staff)
// ============================================

router.put('/:id', requirePermission('user.edit_all'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const allowedFields = ['first_name', 'last_name', 'phone', 'date_of_birth', 
                          'emergency_contact_name', 'emergency_contact_phone'];

    // Only admin/owner can change roles
    if (req.body.role && ['owner', 'admin'].includes(req.user.role)) {
      allowedFields.push('role');
    }

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
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User updated', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// RESET USER PASSWORD (Staff - for helping users)
// ============================================

router.post('/:id/reset-password', requirePermission('user.edit_all'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { new_password } = req.body;

    // Validate password
    if (!new_password || new_password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Hash password
    const password_hash = await bcrypt.hash(new_password, 12);

    // Update password
    const result = await db.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id, email',
      [password_hash, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'Password reset successfully',
      user: result.rows[0],
      new_password // Return for staff to share with user
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DEACTIVATE USER (Manager+)
// ============================================

router.post('/:id/deactivate', requirePermission('user.deactivate'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Can't deactivate yourself
    if (id === req.user.id) {
      return res.status(400).json({ error: 'Cannot deactivate yourself' });
    }

    const result = await db.query(
      'UPDATE users SET is_active = false WHERE id = $1 RETURNING id, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deactivated', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REACTIVATE USER (Manager+)
// ============================================

router.post('/:id/reactivate', requirePermission('user.deactivate'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'UPDATE users SET is_active = true WHERE id = $1 RETURNING id, email',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User reactivated', user: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADD TAG TO USER
// ============================================

router.post('/:id/tags', requirePermission('user.edit_all'), [
  body('tag_id').isUUID(),
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tag_id } = req.body;

    await db.query(`
      INSERT INTO user_tags (user_id, tag_id, added_by)
      VALUES ($1, $2, $3)
      ON CONFLICT DO NOTHING
    `, [id, tag_id, req.user.id]);

    res.json({ message: 'Tag added' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REMOVE TAG FROM USER
// ============================================

router.delete('/:id/tags/:tagId', requirePermission('user.edit_all'), async (req, res, next) => {
  try {
    const { id, tagId } = req.params;

    await db.query(
      'DELETE FROM user_tags WHERE user_id = $1 AND tag_id = $2',
      [id, tagId]
    );

    res.json({ message: 'Tag removed' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ADD NOTE TO USER
// ============================================

router.post('/:id/notes', requirePermission('user.view_full'), [
  body('note').trim().notEmpty(),
  body('is_private').optional().isBoolean(),
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { note, is_private = false } = req.body;

    const result = await db.query(`
      INSERT INTO user_notes (user_id, created_by, note, is_private)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [id, req.user.id, note, is_private]);

    res.status(201).json({ message: 'Note added', note: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET ALL TAGS
// ============================================

router.get('/meta/tags', async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id, name, color, description FROM tags ORDER BY name'
    );
    res.json({ tags: result.rows });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
