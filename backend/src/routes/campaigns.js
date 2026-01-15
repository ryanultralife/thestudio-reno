// ============================================
// AUTOMATED CAMPAIGNS API
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { requireAuth, requirePermission } = require('../middleware/auth');
const campaignsService = require('../services/campaigns');

// ============================================
// LIST CAMPAIGNS
// ============================================

router.get('/', requireAuth, requirePermission('manage_campaigns'), async (req, res) => {
  try {
    const { is_active, trigger_type, limit = 50, offset = 0 } = req.query;

    let query = 'SELECT * FROM notification_campaigns WHERE 1=1';
    const params = [];

    if (is_active !== undefined) {
      params.push(is_active === 'true');
      query += ` AND is_active = $${params.length}`;
    }

    if (trigger_type) {
      params.push(trigger_type);
      query += ` AND trigger_type = $${params.length}`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    res.json({ campaigns: result.rows });
  } catch (err) {
    console.error('Error fetching campaigns:', err);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// ============================================
// GET SINGLE CAMPAIGN
// ============================================

router.get('/:id', requireAuth, requirePermission('manage_campaigns'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'SELECT * FROM notification_campaigns WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Get stats
    const stats = await campaignsService.getCampaignStats(id);

    res.json({
      campaign: result.rows[0],
      stats,
    });
  } catch (err) {
    console.error('Error fetching campaign:', err);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// ============================================
// CREATE CAMPAIGN
// ============================================

router.post('/', requireAuth, requirePermission('manage_campaigns'), async (req, res) => {
  try {
    const {
      name,
      description,
      target_type,
      target_roles,
      trigger_type,
      trigger_config,
      channel,
      email_subject,
      email_body,
      email_template,
      sms_message,
      run_frequency,
      run_time,
      max_sends_per_run,
      cooldown_days,
      is_active,
    } = req.body;

    // Validation
    if (!name || !trigger_type) {
      return res.status(400).json({ error: 'Name and trigger_type are required' });
    }

    if (channel === 'email' && !email_subject && !email_template) {
      return res.status(400).json({ error: 'Email subject or template required for email campaigns' });
    }

    const result = await db.query(
      `INSERT INTO notification_campaigns (
        name, description, target_type, target_roles, trigger_type, trigger_config,
        channel, email_subject, email_body, email_template, sms_message,
        run_frequency, run_time, max_sends_per_run, cooldown_days,
        is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      RETURNING *`,
      [
        name, description, target_type, target_roles || ['student'], trigger_type,
        trigger_config || {}, channel || 'email', email_subject, email_body,
        email_template, sms_message, run_frequency || 'daily', run_time || '09:00:00',
        max_sends_per_run, cooldown_days || 30, is_active !== false, req.user.id,
      ]
    );

    res.status(201).json({ campaign: result.rows[0] });
  } catch (err) {
    console.error('Error creating campaign:', err);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

// ============================================
// UPDATE CAMPAIGN
// ============================================

router.put('/:id', requireAuth, requirePermission('manage_campaigns'), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Build update query dynamically
    const allowedFields = [
      'name', 'description', 'target_type', 'target_roles', 'trigger_type', 'trigger_config',
      'channel', 'email_subject', 'email_body', 'email_template', 'sms_message',
      'run_frequency', 'run_time', 'max_sends_per_run', 'cooldown_days', 'is_active',
    ];

    const setClauses = [];
    const values = [];
    let paramCount = 1;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramCount}`);
        values.push(updates[field]);
        paramCount++;
      }
    }

    if (setClauses.length === 0) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    setClauses.push(`updated_at = NOW()`);
    values.push(id);

    const query = `
      UPDATE notification_campaigns
      SET ${setClauses.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ campaign: result.rows[0] });
  } catch (err) {
    console.error('Error updating campaign:', err);
    res.status(500).json({ error: 'Failed to update campaign' });
  }
});

// ============================================
// DELETE CAMPAIGN
// ============================================

router.delete('/:id', requireAuth, requirePermission('manage_campaigns'), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(
      'DELETE FROM notification_campaigns WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    res.json({ success: true, message: 'Campaign deleted' });
  } catch (err) {
    console.error('Error deleting campaign:', err);
    res.status(500).json({ error: 'Failed to delete campaign' });
  }
});

// ============================================
// PREVIEW CAMPAIGN
// See who would receive the campaign
// ============================================

router.get('/:id/preview', requireAuth, requirePermission('manage_campaigns'), async (req, res) => {
  try {
    const { id } = req.params;

    const preview = await campaignsService.getCampaignPreview(id);

    res.json(preview);
  } catch (err) {
    console.error('Error previewing campaign:', err);
    res.status(500).json({ error: 'Failed to preview campaign' });
  }
});

// ============================================
// RUN CAMPAIGN MANUALLY
// Trigger a campaign run immediately
// ============================================

router.post('/:id/run', requireAuth, requirePermission('manage_campaigns'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get campaign
    const { rows: [campaign] } = await db.query(
      'SELECT * FROM notification_campaigns WHERE id = $1',
      [id]
    );

    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    // Run it
    const sent_count = await campaignsService.runSingleCampaign(campaign);

    res.json({
      success: true,
      message: `Campaign run complete. Sent ${sent_count} messages.`,
      sent_count,
    });
  } catch (err) {
    console.error('Error running campaign:', err);
    res.status(500).json({ error: 'Failed to run campaign' });
  }
});

// ============================================
// GET CAMPAIGN STATS
// ============================================

router.get('/:id/stats', requireAuth, requirePermission('view_campaign_reports'), async (req, res) => {
  try {
    const { id } = req.params;

    const stats = await campaignsService.getCampaignStats(id);

    // Get recent sends
    const { rows: recent_sends } = await db.query(
      `SELECT
        l.*,
        u.first_name,
        u.last_name,
        u.email
       FROM notification_campaign_logs l
       JOIN users u ON l.user_id = u.id
       WHERE l.campaign_id = $1
       ORDER BY l.sent_at DESC
       LIMIT 50`,
      [id]
    );

    res.json({
      stats,
      recent_sends,
    });
  } catch (err) {
    console.error('Error fetching campaign stats:', err);
    res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

// ============================================
// GET ALL CAMPAIGN TYPES / TRIGGERS
// For dropdown in UI
// ============================================

router.get('/meta/trigger-types', requireAuth, async (req, res) => {
  const triggerTypes = [
    {
      value: 'membership_expiring',
      label: 'Membership Expiring',
      description: 'Send X days before membership expires',
      config_fields: [{ name: 'days_before', type: 'number', default: 7 }],
    },
    {
      value: 'membership_expired',
      label: 'Membership Expired',
      description: 'Send X days after membership expires',
      config_fields: [{ name: 'days_after', type: 'number', default: 3 }],
    },
    {
      value: 'inactive_member',
      label: 'Inactive Member',
      description: 'No visits in X days',
      config_fields: [{ name: 'days_inactive', type: 'number', default: 14 }],
    },
    {
      value: 'declining_attendance',
      label: 'Declining Attendance',
      description: 'Attendance has dropped compared to previous period',
      config_fields: [{ name: 'threshold_percent', type: 'number', default: 50 }],
    },
    {
      value: 'no_upcoming_bookings',
      label: 'No Upcoming Bookings',
      description: 'Active member with no future bookings',
      config_fields: [],
    },
    {
      value: 'low_credits',
      label: 'Low Credits',
      description: 'Credits below threshold',
      config_fields: [{ name: 'threshold', type: 'number', default: 2 }],
    },
    {
      value: 'teacher_no_classes',
      label: 'Teacher Inactive',
      description: 'Teacher hasn\'t taught in X days',
      config_fields: [{ name: 'days_inactive', type: 'number', default: 21 }],
    },
    {
      value: 'attendance_milestone',
      label: 'Attendance Milestone',
      description: 'After completing X classes',
      config_fields: [{ name: 'milestone', type: 'number', default: 10 }],
    },
    {
      value: 'new_member_welcome',
      label: 'New Member Welcome',
      description: 'X days after signup',
      config_fields: [{ name: 'days_after_signup', type: 'number', default: 1 }],
    },
    {
      value: 'birthday',
      label: 'Birthday',
      description: 'On user\'s birthday',
      config_fields: [],
    },
  ];

  res.json({ trigger_types: triggerTypes });
});

// ============================================
// TRACKING ENDPOINTS (for email opens/clicks)
// ============================================

// Track email open (via 1x1 pixel)
router.get('/track/open/:campaignId/:userId', async (req, res) => {
  try {
    const { campaignId, userId } = req.params;
    await campaignsService.markEmailOpened(campaignId, userId);

    // Return 1x1 transparent pixel
    const pixel = Buffer.from(
      'R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7',
      'base64'
    );
    res.writeHead(200, {
      'Content-Type': 'image/gif',
      'Content-Length': pixel.length,
    });
    res.end(pixel);
  } catch (err) {
    console.error('Error tracking open:', err);
    res.status(500).end();
  }
});

// Track email click
router.get('/track/click/:campaignId/:userId', async (req, res) => {
  try {
    const { campaignId, userId } = req.params;
    const { url } = req.query;

    await campaignsService.markEmailClicked(campaignId, userId);

    // Redirect to actual URL
    res.redirect(url || process.env.FRONTEND_URL);
  } catch (err) {
    console.error('Error tracking click:', err);
    res.redirect(process.env.FRONTEND_URL);
  }
});

module.exports = router;
