// ============================================
// SPACE RENTAL INQUIRIES API
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { requireAuth, requirePermission } = require('../middleware/auth');

// ============================================
// PUBLIC ROUTES
// ============================================

/**
 * POST /api/rentals/inquiries
 * Submit a space rental inquiry (public)
 */
router.post('/inquiries', async (req, res) => {
  try {
    const {
      first_name,
      last_name,
      email,
      phone,
      room_type,
      rental_type,
      preferred_days,
      start_date,
      practice_type,
      experience_years,
      has_insurance,
      following_size,
      message,
      hear_about_us,
    } = req.body;

    // Validation
    if (!first_name || !last_name || !email) {
      return res.status(400).json({ error: 'Name and email are required' });
    }

    // Email format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Insert inquiry
    const result = await db.query(
      `INSERT INTO space_rental_inquiries (
        first_name, last_name, email, phone,
        room_type, rental_type, preferred_days, start_date,
        practice_type, experience_years, has_insurance, following_size,
        message, hear_about_us
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING id, created_at`,
      [
        first_name, last_name, email, phone,
        room_type, rental_type, preferred_days, start_date,
        practice_type, experience_years, has_insurance, following_size,
        message, hear_about_us,
      ]
    );

    const inquiry = result.rows[0];

    // Send email notification
    try {
      const emailService = require('../services/notifications');
      await emailService.sendRentalInquiryNotification({
        id: inquiry.id,
        first_name,
        last_name,
        email,
        phone,
        room_type,
        rental_type,
        practice_type,
        message,
      });
    } catch (emailErr) {
      console.error('Failed to send email notification:', emailErr);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully! We\'ll be in touch soon.',
      inquiry_id: inquiry.id,
    });

  } catch (error) {
    console.error('Error submitting rental inquiry:', error);
    res.status(500).json({ error: 'Failed to submit inquiry' });
  }
});

// ============================================
// ADMIN ROUTES (Staff only)
// ============================================

/**
 * GET /api/rentals/inquiries
 * List all rental inquiries (admin only)
 */
router.get('/inquiries', requireAuth, requirePermission('admin.view'), async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;

    let query = `
      SELECT
        i.*,
        u.first_name as contacted_by_first_name,
        u.last_name as contacted_by_last_name
      FROM space_rental_inquiries i
      LEFT JOIN users u ON i.contacted_by = u.id
    `;

    const params = [];

    if (status) {
      params.push(status);
      query += ` WHERE i.status = $${params.length}`;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      inquiries: result.rows,
      count: result.rows.length,
    });

  } catch (error) {
    console.error('Error fetching rental inquiries:', error);
    res.status(500).json({ error: 'Failed to fetch inquiries' });
  }
});

/**
 * GET /api/rentals/inquiries/:id
 * Get single inquiry details (admin only)
 */
router.get('/inquiries/:id', requireAuth, requirePermission('admin.view'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        i.*,
        u.first_name as contacted_by_first_name,
        u.last_name as contacted_by_last_name,
        u.email as contacted_by_email
      FROM space_rental_inquiries i
      LEFT JOIN users u ON i.contacted_by = u.id
      WHERE i.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json(result.rows[0]);

  } catch (error) {
    console.error('Error fetching inquiry:', error);
    res.status(500).json({ error: 'Failed to fetch inquiry' });
  }
});

/**
 * PATCH /api/rentals/inquiries/:id
 * Update inquiry status/notes (admin only)
 */
router.patch('/inquiries/:id', requireAuth, requirePermission('admin.edit'), async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    const updates = [];
    const params = [id];

    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }

    if (admin_notes !== undefined) {
      params.push(admin_notes);
      updates.push(`admin_notes = $${params.length}`);
    }

    // Mark as contacted if status is being changed from 'new'
    if (status && status !== 'new') {
      params.push(req.user.id);
      updates.push(`contacted_by = $${params.length}`);
      updates.push(`contacted_at = NOW()`);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No updates provided' });
    }

    const result = await db.query(
      `UPDATE space_rental_inquiries
       SET ${updates.join(', ')}
       WHERE id = $1
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({
      success: true,
      inquiry: result.rows[0],
    });

  } catch (error) {
    console.error('Error updating inquiry:', error);
    res.status(500).json({ error: 'Failed to update inquiry' });
  }
});

/**
 * DELETE /api/rentals/inquiries/:id
 * Delete inquiry (admin only)
 */
router.delete('/inquiries/:id', requireAuth, requirePermission('admin.edit'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM space_rental_inquiries WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Inquiry not found' });
    }

    res.json({
      success: true,
      message: 'Inquiry deleted',
    });

  } catch (error) {
    console.error('Error deleting inquiry:', error);
    res.status(500).json({ error: 'Failed to delete inquiry' });
  }
});

module.exports = router;
