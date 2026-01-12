// ============================================
// ADMIN ROUTES
// ============================================

const express = require('express');
const { body } = require('express-validator');
const db = require('../database/connection');
const { authenticate, requirePermission, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// ============================================
// SETTINGS
// ============================================

router.get('/settings', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT key, value, description FROM settings');
    
    const settings = {};
    for (const row of result.rows) {
      settings[row.key] = row.value;
    }

    res.json({ settings });
  } catch (error) {
    next(error);
  }
});

router.put('/settings/:key', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const result = await db.query(`
      UPDATE settings SET value = $1, updated_at = NOW() WHERE key = $2 RETURNING *
    `, [JSON.stringify(value), key]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }

    res.json({ message: 'Setting updated', setting: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MANAGE CLASS TYPES
// ============================================

router.get('/class-types', requirePermission('class.manage_types'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT * FROM class_types ORDER BY sort_order, name
    `);
    res.json({ class_types: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/class-types', requirePermission('class.manage_types'), [
  body('name').trim().notEmpty(),
  body('duration').isInt({ min: 15 }),
  body('category').isIn(['flow', 'power', 'yin', 'heated', 'beginner', 'meditation', 'workshop', 'private']),
], async (req, res, next) => {
  try {
    const { name, description, duration, category, level, is_heated, default_capacity, drop_in_price, color } = req.body;

    const result = await db.query(`
      INSERT INTO class_types (name, description, duration, category, level, is_heated, default_capacity, drop_in_price, color)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [name, description, duration, category, level || 'all', is_heated || false, default_capacity || 20, drop_in_price || 22, color]);

    res.status(201).json({ message: 'Class type created', class_type: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/class-types/:id', requirePermission('class.manage_types'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'duration', 'category', 'level', 'is_heated', 
                   'default_capacity', 'drop_in_price', 'color', 'is_active', 'sort_order'];

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

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);
    const result = await db.query(
      `UPDATE class_types SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ message: 'Class type updated', class_type: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MANAGE MEMBERSHIP TYPES
// ============================================

router.get('/membership-types', requirePermission('membership.manage'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM membership_types ORDER BY sort_order, price');
    res.json({ membership_types: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/membership-types', requirePermission('membership.manage'), async (req, res, next) => {
  try {
    const { name, description, price, type, duration_days, credits, is_intro_offer, stripe_price_id } = req.body;

    const result = await db.query(`
      INSERT INTO membership_types (name, description, price, type, duration_days, credits, is_intro_offer, stripe_price_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [name, description, price, type, duration_days, credits, is_intro_offer || false, stripe_price_id]);

    res.status(201).json({ message: 'Membership type created', membership_type: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/membership-types/:id', requirePermission('membership.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = ['name', 'description', 'price', 'type', 'duration_days', 'credits', 
                   'is_intro_offer', 'is_active', 'sort_order', 'stripe_price_id'];

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
      `UPDATE membership_types SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ message: 'Membership type updated', membership_type: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MANAGE TEACHERS
// ============================================

router.get('/teachers', requirePermission('staff.manage'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT t.*, u.email, u.first_name, u.last_name, u.phone
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      ORDER BY u.first_name
    `);
    res.json({ teachers: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/teachers', requirePermission('staff.manage'), [
  body('user_id').isUUID(),
], async (req, res, next) => {
  try {
    const { user_id, title, bio, specialties, certifications, hire_date, default_per_class_rate } = req.body;

    // Update user role to teacher
    await db.query('UPDATE users SET role = $1 WHERE id = $2 AND role = $3', ['teacher', user_id, 'student']);

    const result = await db.query(`
      INSERT INTO teachers (user_id, title, bio, specialties, certifications, hire_date, default_per_class_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [user_id, title, bio, specialties, certifications, hire_date, default_per_class_rate]);

    res.status(201).json({ message: 'Teacher created', teacher: result.rows[0] });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'User is already a teacher' });
    }
    next(error);
  }
});

router.put('/teachers/:id', requirePermission('staff.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const fields = ['title', 'bio', 'specialties', 'certifications', 'photo_url', 
                   'default_hourly_rate', 'default_per_class_rate', 'is_active'];

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
      `UPDATE teachers SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );

    res.json({ message: 'Teacher updated', teacher: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MANAGE WAIVERS
// ============================================

router.get('/waivers', requirePermission('waiver.manage'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM waiver_templates ORDER BY name');
    res.json({ waivers: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/waivers', requirePermission('waiver.manage'), async (req, res, next) => {
  try {
    const { name, content, is_required } = req.body;

    const result = await db.query(`
      INSERT INTO waiver_templates (name, content, is_required)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, content, is_required !== false]);

    res.status(201).json({ message: 'Waiver created', waiver: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/waivers/:id', requirePermission('waiver.manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, content, is_required, is_active } = req.body;

    // Increment version if content changed
    const result = await db.query(`
      UPDATE waiver_templates 
      SET name = COALESCE($1, name),
          content = COALESCE($2, content),
          is_required = COALESCE($3, is_required),
          is_active = COALESCE($4, is_active),
          version = CASE WHEN $2 IS NOT NULL THEN version + 1 ELSE version END
      WHERE id = $5
      RETURNING *
    `, [name, content, is_required, is_active, id]);

    res.json({ message: 'Waiver updated', waiver: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MANAGE TAGS
// ============================================

router.get('/tags', requirePermission('user.edit_all'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM tags ORDER BY name');
    res.json({ tags: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/tags', requirePermission('user.edit_all'), async (req, res, next) => {
  try {
    const { name, color, description } = req.body;

    const result = await db.query(`
      INSERT INTO tags (name, color, description)
      VALUES ($1, $2, $3)
      RETURNING *
    `, [name, color || '#6B7280', description]);

    res.status(201).json({ message: 'Tag created', tag: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/tags/:id', requirePermission('user.edit_all'), async (req, res, next) => {
  try {
    const { id } = req.params;

    // Can't delete system tags
    const result = await db.query(
      'DELETE FROM tags WHERE id = $1 AND is_system = false RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ error: 'Cannot delete system tag or tag not found' });
    }

    res.json({ message: 'Tag deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MANAGE FAQs
// ============================================

router.get('/faqs', async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM faqs ORDER BY sort_order');
    res.json({ faqs: result.rows });
  } catch (error) {
    next(error);
  }
});

router.post('/faqs', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    const { question, answer, category, sort_order } = req.body;

    const result = await db.query(`
      INSERT INTO faqs (question, answer, category, sort_order)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `, [question, answer, category, sort_order || 0]);

    res.status(201).json({ message: 'FAQ created', faq: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.put('/faqs/:id', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { question, answer, category, sort_order, is_active } = req.body;

    const result = await db.query(`
      UPDATE faqs 
      SET question = COALESCE($1, question),
          answer = COALESCE($2, answer),
          category = COALESCE($3, category),
          sort_order = COALESCE($4, sort_order),
          is_active = COALESCE($5, is_active)
      WHERE id = $6
      RETURNING *
    `, [question, answer, category, sort_order, is_active, id]);

    res.json({ message: 'FAQ updated', faq: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

router.delete('/faqs/:id', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    await db.query('DELETE FROM faqs WHERE id = $1', [req.params.id]);
    res.json({ message: 'FAQ deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// EMAIL TEMPLATES
// ============================================

router.get('/email-templates', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const result = await db.query('SELECT * FROM email_templates ORDER BY name');
    res.json({ templates: result.rows });
  } catch (error) {
    next(error);
  }
});

router.put('/email-templates/:id', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { subject, body_html, body_text, is_active } = req.body;

    const result = await db.query(`
      UPDATE email_templates 
      SET subject = COALESCE($1, subject),
          body_html = COALESCE($2, body_html),
          body_text = COALESCE($3, body_text),
          is_active = COALESCE($4, is_active),
          updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `, [subject, body_html, body_text, is_active, id]);

    res.json({ message: 'Template updated', template: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
