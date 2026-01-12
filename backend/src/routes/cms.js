// ============================================
// CMS & MEDIA ROUTES
// ============================================

const express = require('express');
const router = express.Router();
const { pool } = require('../database/connection');
const { authenticateToken, requirePermission } = require('../middleware/auth');

// ============================================
// SITE SETTINGS
// ============================================

// Get all settings (public)
router.get('/settings', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(row => {
      settings[row.key] = row.value;
    });
    res.json({ settings });
  } catch (err) {
    next(err);
  }
});

// Get single setting
router.get('/settings/:key', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', [req.params.key]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ value: result.rows[0].value });
  } catch (err) {
    next(err);
  }
});

// Update setting (admin only)
router.put('/settings/:key', authenticateToken, requirePermission('manage_settings'), async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;
    
    const result = await pool.query(`
      INSERT INTO site_settings (key, value, updated_by, updated_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (key) DO UPDATE SET value = $2, updated_by = $3, updated_at = NOW()
      RETURNING *
    `, [key, JSON.stringify(value), req.user.id]);
    
    res.json({ setting: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================
// LOCATIONS
// ============================================

// Get all locations (public)
router.get('/locations', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT * FROM locations WHERE is_active = true ORDER BY sort_order
    `);
    res.json({ locations: result.rows });
  } catch (err) {
    next(err);
  }
});

// Get single location
router.get('/locations/:slug', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM locations WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ location: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================
// CONTENT BLOCKS
// ============================================

// Get content for a page (public)
router.get('/content/:page', async (req, res, next) => {
  try {
    const { page } = req.params;
    const result = await pool.query(`
      SELECT * FROM content_blocks 
      WHERE page = $1 AND is_active = true 
      ORDER BY sort_order
    `, [page]);
    res.json({ blocks: result.rows });
  } catch (err) {
    next(err);
  }
});

// Get all content blocks (admin)
router.get('/content', authenticateToken, requirePermission('manage_content'), async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM content_blocks ORDER BY page, sort_order');
    res.json({ blocks: result.rows });
  } catch (err) {
    next(err);
  }
});

// Update content block
router.put('/content/:id', authenticateToken, requirePermission('manage_content'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, subtitle, body, image_url, button_text, button_url, is_active } = req.body;
    
    const result = await pool.query(`
      UPDATE content_blocks SET
        title = COALESCE($1, title),
        subtitle = COALESCE($2, subtitle),
        body = COALESCE($3, body),
        image_url = COALESCE($4, image_url),
        button_text = COALESCE($5, button_text),
        button_url = COALESCE($6, button_url),
        is_active = COALESCE($7, is_active),
        updated_at = NOW(),
        updated_by = $8
      WHERE id = $9
      RETURNING *
    `, [title, subtitle, body, image_url, button_text, button_url, is_active, req.user.id, id]);
    
    res.json({ block: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Create content block
router.post('/content', authenticateToken, requirePermission('manage_content'), async (req, res, next) => {
  try {
    const { page, section, title, subtitle, body, image_url, button_text, button_url } = req.body;
    
    const result = await pool.query(`
      INSERT INTO content_blocks (page, section, title, subtitle, body, image_url, button_text, button_url, updated_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [page, section, title, subtitle, body, image_url, button_text, button_url, req.user.id]);
    
    res.status(201).json({ block: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================
// EVENTS & WORKSHOPS
// ============================================

// Get upcoming events (public)
router.get('/events', async (req, res, next) => {
  try {
    const { type, featured, limit = 10 } = req.query;
    
    let query = `
      SELECT e.*, l.name as location_name 
      FROM events e
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.status = 'published' AND e.start_date >= CURRENT_DATE
    `;
    const params = [];
    
    if (type) {
      params.push(type);
      query += ` AND e.event_type = $${params.length}`;
    }
    
    if (featured === 'true') {
      query += ` AND e.is_featured = true`;
    }
    
    query += ` ORDER BY e.start_date, e.start_time`;
    params.push(parseInt(limit));
    query += ` LIMIT $${params.length}`;
    
    const result = await pool.query(query, params);
    res.json({ events: result.rows });
  } catch (err) {
    next(err);
  }
});

// Get single event
router.get('/events/:slug', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT e.*, l.name as location_name, l.address_line1, l.city, l.state
      FROM events e
      LEFT JOIN locations l ON e.location_id = l.id
      WHERE e.slug = $1
    `, [req.params.slug]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json({ event: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Create event (admin)
router.post('/events', authenticateToken, requirePermission('manage_events'), async (req, res, next) => {
  try {
    const {
      title, description, short_description, start_date, start_time, end_time,
      price, member_price, capacity, location_id, event_type, is_featured, image_url
    } = req.body;
    
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
    
    const result = await pool.query(`
      INSERT INTO events (
        title, slug, description, short_description, start_date, start_time, end_time,
        price, member_price, capacity, location_id, event_type, is_featured, image_url, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'published')
      RETURNING *
    `, [title, slug, description, short_description, start_date, start_time, end_time,
        price, member_price, capacity, location_id, event_type, is_featured || false, image_url]);
    
    res.status(201).json({ event: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Register for event
router.post('/events/:id/register', async (req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    const { id } = req.params;
    const { email, first_name, last_name, phone, quantity = 1 } = req.body;
    
    // Check capacity
    const event = await client.query('SELECT * FROM events WHERE id = $1', [id]);
    if (event.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    const e = event.rows[0];
    if (e.capacity && e.registered_count + quantity > e.capacity) {
      if (e.waitlist_enabled) {
        // Add to waitlist
        const reg = await client.query(`
          INSERT INTO event_registrations (event_id, email, first_name, last_name, phone, quantity, status)
          VALUES ($1, $2, $3, $4, $5, $6, 'waitlist')
          RETURNING *
        `, [id, email, first_name, last_name, phone, quantity]);
        
        await client.query('COMMIT');
        return res.json({ registration: reg.rows[0], status: 'waitlist' });
      }
      return res.status(400).json({ error: 'Event is full' });
    }
    
    // Create registration
    const reg = await client.query(`
      INSERT INTO event_registrations (event_id, email, first_name, last_name, phone, quantity, status)
      VALUES ($1, $2, $3, $4, $5, $6, 'confirmed')
      RETURNING *
    `, [id, email, first_name, last_name, phone, quantity]);
    
    // Update count
    await client.query('UPDATE events SET registered_count = registered_count + $1 WHERE id = $2', [quantity, id]);
    
    await client.query('COMMIT');
    res.status(201).json({ registration: reg.rows[0], status: 'confirmed' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

// ============================================
// MEDIA LIBRARY
// ============================================

// Get media files
router.get('/media', authenticateToken, async (req, res, next) => {
  try {
    const { folder, limit = 50, offset = 0 } = req.query;
    
    let query = 'SELECT * FROM media WHERE 1=1';
    const params = [];
    
    if (folder) {
      params.push(folder);
      query += ` AND folder = $${params.length}`;
    }
    
    query += ' ORDER BY created_at DESC';
    params.push(parseInt(limit), parseInt(offset));
    query += ` LIMIT $${params.length - 1} OFFSET $${params.length}`;
    
    const result = await pool.query(query, params);
    res.json({ media: result.rows });
  } catch (err) {
    next(err);
  }
});

// Upload media (creates record - actual upload handled by frontend to Cloudinary)
router.post('/media', authenticateToken, requirePermission('manage_media'), async (req, res, next) => {
  try {
    const { 
      filename, original_filename, mime_type, file_size,
      url, thumbnail_url, alt_text, folder, cloudinary_public_id 
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO media (
        filename, original_filename, mime_type, file_size,
        url, thumbnail_url, alt_text, folder, cloudinary_public_id, uploaded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [filename, original_filename, mime_type, file_size, url, thumbnail_url, alt_text, folder || 'general', cloudinary_public_id, req.user.id]);
    
    res.status(201).json({ media: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Delete media
router.delete('/media/:id', authenticateToken, requirePermission('manage_media'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM media WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

// ============================================
// TESTIMONIALS
// ============================================

// Get testimonials (public)
router.get('/testimonials', async (req, res, next) => {
  try {
    const { featured } = req.query;
    let query = 'SELECT * FROM testimonials WHERE is_active = true';
    if (featured === 'true') query += ' AND is_featured = true';
    query += ' ORDER BY sort_order, created_at DESC';
    
    const result = await pool.query(query);
    res.json({ testimonials: result.rows });
  } catch (err) {
    next(err);
  }
});

// ============================================
// NEWSLETTER
// ============================================

// Subscribe
router.post('/newsletter/subscribe', async (req, res, next) => {
  try {
    const { email, first_name, last_name, phone, sms_opt_in, source = 'website' } = req.body;
    
    const result = await pool.query(`
      INSERT INTO newsletter_subscribers (email, first_name, last_name, phone, sms_opt_in, sms_opt_in_at, source)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (email) DO UPDATE SET
        first_name = COALESCE($2, newsletter_subscribers.first_name),
        last_name = COALESCE($3, newsletter_subscribers.last_name),
        phone = COALESCE($4, newsletter_subscribers.phone),
        sms_opt_in = COALESCE($5, newsletter_subscribers.sms_opt_in),
        status = 'active'
      RETURNING id, email, status
    `, [email, first_name, last_name, phone, sms_opt_in || false, sms_opt_in ? new Date() : null, source]);
    
    res.json({ subscriber: result.rows[0], message: 'Subscribed successfully!' });
  } catch (err) {
    next(err);
  }
});

// Unsubscribe
router.post('/newsletter/unsubscribe', async (req, res, next) => {
  try {
    const { email } = req.body;
    await pool.query(`
      UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = NOW()
      WHERE email = $1
    `, [email]);
    res.json({ message: 'Unsubscribed successfully' });
  } catch (err) {
    next(err);
  }
});

// ============================================
// TEACHERS (extended profiles)
// ============================================

// Get teachers (public)
router.get('/team', async (req, res, next) => {
  try {
    const result = await pool.query(`
      SELECT id, first_name, last_name, photo_url, bio, certifications, specialties, instagram, website, is_featured
      FROM users
      WHERE role = 'teacher' AND is_active = true
      ORDER BY is_featured DESC, first_name
    `);
    res.json({ teachers: result.rows });
  } catch (err) {
    next(err);
  }
});

// Update teacher profile
router.put('/team/:id', authenticateToken, async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Teachers can only edit their own profile, managers/owners can edit all
    if (req.user.id !== id && !['manager', 'owner', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    
    const { bio, certifications, specialties, photo_url, instagram, website } = req.body;
    
    const result = await pool.query(`
      UPDATE users SET
        bio = COALESCE($1, bio),
        certifications = COALESCE($2, certifications),
        specialties = COALESCE($3, specialties),
        photo_url = COALESCE($4, photo_url),
        instagram = COALESCE($5, instagram),
        website = COALESCE($6, website),
        updated_at = NOW()
      WHERE id = $7
      RETURNING id, first_name, last_name, bio, certifications, specialties, photo_url, instagram, website
    `, [bio, certifications, specialties, photo_url, instagram, website, id]);
    
    res.json({ teacher: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// ============================================
// DISPLAY BOARD / DIGITAL SIGNAGE
// ============================================

// Get active display slides (public - for TV display)
router.get('/display/slides', async (req, res, next) => {
  try {
    const now = new Date();
    const currentDay = now.getDay(); // 0-6
    const currentTime = now.toTimeString().slice(0, 8); // HH:MM:SS
    
    const result = await pool.query(`
      SELECT * FROM display_slides
      WHERE is_active = true
        AND (start_date IS NULL OR start_date <= CURRENT_DATE)
        AND (end_date IS NULL OR end_date >= CURRENT_DATE)
        AND ($1 = ANY(days_of_week) OR days_of_week IS NULL OR days_of_week = '{}')
        AND (start_time IS NULL OR start_time <= $2::time)
        AND (end_time IS NULL OR end_time >= $2::time)
      ORDER BY sort_order, created_at
    `, [currentDay, currentTime]);
    
    res.json({ slides: result.rows });
  } catch (err) {
    next(err);
  }
});

// Get all display slides (admin)
router.get('/display/slides/all', authenticateToken, requirePermission('manage_content'), async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM display_slides ORDER BY sort_order, created_at DESC');
    res.json({ slides: result.rows });
  } catch (err) {
    next(err);
  }
});

// Create display slide
router.post('/display/slides', authenticateToken, requirePermission('manage_content'), async (req, res, next) => {
  try {
    const {
      title, subtitle, body, image_url, background_url,
      layout, duration_seconds, sort_order, slide_type,
      start_date, end_date, days_of_week, start_time, end_time
    } = req.body;
    
    const result = await pool.query(`
      INSERT INTO display_slides (
        title, subtitle, body, image_url, background_url,
        layout, duration_seconds, sort_order, slide_type,
        start_date, end_date, days_of_week, start_time, end_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `, [title, subtitle, body, image_url, background_url,
        layout || 'centered', duration_seconds || 15, sort_order || 0, slide_type || 'promo',
        start_date, end_date, days_of_week, start_time, end_time]);
    
    res.status(201).json({ slide: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Update display slide
router.put('/display/slides/:id', authenticateToken, requirePermission('manage_content'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title, subtitle, body, image_url, background_url,
      layout, duration_seconds, sort_order, slide_type,
      start_date, end_date, days_of_week, start_time, end_time, is_active
    } = req.body;
    
    const result = await pool.query(`
      UPDATE display_slides SET
        title = COALESCE($1, title),
        subtitle = COALESCE($2, subtitle),
        body = COALESCE($3, body),
        image_url = COALESCE($4, image_url),
        background_url = COALESCE($5, background_url),
        layout = COALESCE($6, layout),
        duration_seconds = COALESCE($7, duration_seconds),
        sort_order = COALESCE($8, sort_order),
        slide_type = COALESCE($9, slide_type),
        start_date = $10,
        end_date = $11,
        days_of_week = COALESCE($12, days_of_week),
        start_time = $13,
        end_time = $14,
        is_active = COALESCE($15, is_active),
        updated_at = NOW()
      WHERE id = $16
      RETURNING *
    `, [title, subtitle, body, image_url, background_url,
        layout, duration_seconds, sort_order, slide_type,
        start_date, end_date, days_of_week, start_time, end_time, is_active, id]);
    
    res.json({ slide: result.rows[0] });
  } catch (err) {
    next(err);
  }
});

// Delete display slide
router.delete('/display/slides/:id', authenticateToken, requirePermission('manage_content'), async (req, res, next) => {
  try {
    await pool.query('DELETE FROM display_slides WHERE id = $1', [req.params.id]);
    res.json({ message: 'Deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
