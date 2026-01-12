// ============================================
// NOTIFICATION PREFERENCES ROUTES
// ============================================

const express = require('express');
const { body } = require('express-validator');
const db = require('../database/connection');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// ============================================
// GET MY PREFERENCES
// ============================================

router.get('/preferences', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT * FROM notification_preferences WHERE user_id = $1
    `, [req.user.id]);

    if (result.rows.length === 0) {
      // Create default preferences
      const newPrefs = await db.query(`
        INSERT INTO notification_preferences (user_id)
        VALUES ($1)
        RETURNING *
      `, [req.user.id]);
      return res.json({ preferences: newPrefs.rows[0] });
    }

    res.json({ preferences: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UPDATE PREFERENCES
// ============================================

router.put('/preferences', async (req, res, next) => {
  try {
    const allowedFields = [
      'email_enabled', 'sms_enabled', 'sms_phone',
      'email_booking_confirmation', 'email_booking_reminder', 
      'email_class_cancelled', 'email_waitlist', 
      'email_membership_expiring', 'email_promotions',
      'sms_booking_confirmation', 'sms_booking_reminder',
      'sms_class_cancelled', 'sms_waitlist',
      'reminder_hours', 'timezone'
    ];

    const updates = [];
    const values = [];
    let idx = 1;

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates.push(`${field} = $${idx}`);
        values.push(req.body[field]);
        idx++;
      }
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    updates.push('updated_at = NOW()');
    values.push(req.user.id);

    const result = await db.query(`
      UPDATE notification_preferences 
      SET ${updates.join(', ')}
      WHERE user_id = $${idx}
      RETURNING *
    `, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Preferences not found' });
    }

    res.json({ message: 'Preferences updated', preferences: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// UNSUBSCRIBE (Public link)
// ============================================

router.get('/unsubscribe/:token', async (req, res) => {
  try {
    // Token would be a signed JWT or hash of user_id
    // For simplicity, using user_id directly (in production, use signed tokens)
    const { token } = req.params;
    const { type } = req.query; // email or sms

    // Basic validation
    const userId = token; // In production, decode/verify token

    if (type === 'sms') {
      await db.query(
        'UPDATE notification_preferences SET sms_enabled = false WHERE user_id = $1',
        [userId]
      );
    } else {
      await db.query(
        'UPDATE notification_preferences SET email_promotions = false WHERE user_id = $1',
        [userId]
      );
    }

    res.send(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding: 50px;">
          <h2>You've been unsubscribed</h2>
          <p>You will no longer receive ${type === 'sms' ? 'SMS' : 'promotional email'} notifications.</p>
          <p><a href="${process.env.FRONTEND_URL}">Back to The Studio Reno</a></p>
        </body>
      </html>
    `);
  } catch (error) {
    res.status(500).send('Error processing unsubscribe');
  }
});

module.exports = router;
