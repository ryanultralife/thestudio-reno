// ============================================
// SOCIAL MEDIA ROUTES
// ============================================

const express = require('express');
const db = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');
const social = require('../services/social');

const router = express.Router();

router.use(authenticate);

// ============================================
// GET SOCIAL SETTINGS
// ============================================

router.get('/settings', requirePermission('settings.view'), async (req, res) => {
  res.json({
    facebook: {
      connected: !!process.env.FACEBOOK_PAGE_ID,
      pageId: process.env.FACEBOOK_PAGE_ID || null,
    },
    instagram: {
      connected: !!process.env.INSTAGRAM_ACCOUNT_ID,
      accountId: process.env.INSTAGRAM_ACCOUNT_ID || null,
    },
  });
});

// ============================================
// POST MANUALLY
// ============================================

router.post('/post', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    const { message, imageUrl, platforms = ['facebook'] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const content = { message, imageUrl };
    const results = {};

    if (platforms.includes('facebook')) {
      results.facebook = imageUrl 
        ? await social.postPhotoToFacebook(content)
        : await social.postToFacebook(content);
    }

    if (platforms.includes('instagram') && imageUrl) {
      results.instagram = await social.postToInstagram(content);
    }

    // Log to database
    await db.query(`
      INSERT INTO social_posts (content, image_url, facebook_post_id, instagram_post_id, posted_by, posted_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `, [message, imageUrl, results.facebook, results.instagram, req.user.id]);

    res.json({
      message: 'Posted successfully',
      results,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SCHEDULE POST
// ============================================

router.post('/schedule', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    const { message, imageUrl, scheduledFor, platforms = ['facebook'] } = req.body;

    if (!message || !scheduledFor) {
      return res.status(400).json({ error: 'Message and scheduledFor are required' });
    }

    const result = await db.query(`
      INSERT INTO scheduled_social_posts (content, image_url, scheduled_for, platforms, created_by, status)
      VALUES ($1, $2, $3, $4, $5, 'pending')
      RETURNING *
    `, [message, imageUrl, scheduledFor, platforms, req.user.id]);

    res.status(201).json({
      message: 'Post scheduled',
      post: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET SCHEDULED POSTS
// ============================================

router.get('/scheduled', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT sp.*, u.first_name, u.last_name
      FROM scheduled_social_posts sp
      LEFT JOIN users u ON sp.created_by = u.id
      WHERE sp.status = 'pending'
      ORDER BY sp.scheduled_for
    `);

    res.json({ posts: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// DELETE SCHEDULED POST
// ============================================

router.delete('/scheduled/:id', requirePermission('settings.edit'), async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query(
      `DELETE FROM scheduled_social_posts WHERE id = $1 AND status = 'pending'`,
      [id]
    );

    res.json({ message: 'Scheduled post deleted' });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET POST HISTORY
// ============================================

router.get('/history', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(`
      SELECT sp.*, u.first_name, u.last_name
      FROM social_posts sp
      LEFT JOIN users u ON sp.posted_by = u.id
      ORDER BY sp.posted_at DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);

    res.json({ posts: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ANNOUNCE CLASS (Auto-generate post for a class)
// ============================================

router.post('/announce-class/:classId', requirePermission('class.create'), async (req, res, next) => {
  try {
    const { classId } = req.params;

    const result = await social.announceNewClass(classId);

    if (!result) {
      return res.status(400).json({ error: 'Failed to create announcement' });
    }

    res.json({
      message: 'Class announced on social media',
      result,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GENERATE PREVIEW (for UI)
// ============================================

router.post('/preview', requirePermission('settings.view'), async (req, res, next) => {
  try {
    const { type, data } = req.body;

    let content;
    if (type === 'class') {
      content = social.generateClassPost(data);
    } else if (type === 'event') {
      content = social.generateEventPost(data);
    } else {
      return res.status(400).json({ error: 'Invalid type' });
    }

    res.json({ content });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
