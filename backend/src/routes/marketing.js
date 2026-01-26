// ============================================
// MARKETING ROUTES
// Campaigns, segments, automations, and tracking
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');
const { SegmentationEngine, CampaignService, AutomationService, SMSCampaignService } = require('../services/marketing');

const segmentEngine = new SegmentationEngine();
const campaignService = new CampaignService();
const automationService = new AutomationService();
const smsCampaignService = new SMSCampaignService();

// ============================================
// EMAIL TEMPLATES
// ============================================

/**
 * GET /api/marketing/templates
 * List all email templates
 */
router.get('/templates', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const { type } = req.query;

    let query = 'SELECT * FROM marketing_email_templates WHERE is_active = true';
    const params = [];

    if (type) {
      query += ' AND template_type = $1';
      params.push(type);
    }

    query += ' ORDER BY name';

    const result = await db.query(query, params);
    res.json({ templates: result.rows });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketing/templates/:id
 * Get a single template
 */
router.get('/templates/:id', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM marketing_email_templates WHERE id = $1', [req.params.id]);
    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Template not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/templates
 * Create a new template
 */
router.post('/templates', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { name, description, subject, previewText, bodyHtml, bodyText, templateType, availableTokens } = req.body;

    const result = await db.query(`
      INSERT INTO marketing_email_templates (
        name, description, subject, preview_text, body_html, body_text,
        template_type, available_tokens, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [name, description, subject, previewText, bodyHtml, bodyText, templateType || 'marketing', availableTokens, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/marketing/templates/:id
 * Update a template
 */
router.put('/templates/:id', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { name, description, subject, previewText, bodyHtml, bodyText, templateType } = req.body;

    const result = await db.query(`
      UPDATE marketing_email_templates
      SET name = $1, description = $2, subject = $3, preview_text = $4,
          body_html = $5, body_text = $6, template_type = $7, updated_at = NOW()
      WHERE id = $8
      RETURNING *
    `, [name, description, subject, previewText, bodyHtml, bodyText, templateType, req.params.id]);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SEGMENTS
// ============================================

/**
 * GET /api/marketing/segments
 * List all segments
 */
router.get('/segments', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM marketing_segments
      WHERE is_active = true
      ORDER BY is_system DESC, name
    `);
    res.json({ segments: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketing/segments/:id
 * Get segment details with members
 */
router.get('/segments/:id', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const segment = await db.query('SELECT * FROM marketing_segments WHERE id = $1', [req.params.id]);
    if (!segment.rows[0]) {
      return res.status(404).json({ error: 'Segment not found' });
    }

    const { limit = 50, offset = 0 } = req.query;
    const { users } = await segmentEngine.getSegmentMembers(req.params.id, {
      limit: parseInt(limit),
      offset: parseInt(offset),
    });

    res.json({
      segment: segment.rows[0],
      members: users,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/segments
 * Create a new segment
 */
router.post('/segments', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { name, description, rules } = req.body;

    const segment = await segmentEngine.createSegment(name, description, rules, req.user.id);
    res.status(201).json(segment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/segments/preview
 * Preview segment results without saving
 */
router.post('/segments/preview', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const { rules } = req.body;
    const result = await segmentEngine.previewSegment(rules, 50);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/marketing/segments/:id
 * Update a segment
 */
router.put('/segments/:id', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { name, description, rules } = req.body;

    const result = await db.query(`
      UPDATE marketing_segments
      SET name = $1, description = $2, rules = $3, updated_at = NOW()
      WHERE id = $4 AND is_system = false
      RETURNING *
    `, [name, description, rules, req.params.id]);

    if (!result.rows[0]) {
      return res.status(404).json({ error: 'Segment not found or is a system segment' });
    }

    // Recalculate count
    const { count } = await segmentEngine.evaluateSegment(rules, { countOnly: true });
    await db.query('UPDATE marketing_segments SET member_count = $1, last_calculated_at = NOW() WHERE id = $2', [count, req.params.id]);

    res.json({ ...result.rows[0], member_count: count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// CAMPAIGNS
// ============================================

/**
 * GET /api/marketing/campaigns
 * List all campaigns
 */
router.get('/campaigns', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const campaigns = await campaignService.listCampaigns({
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketing/campaigns/:id
 * Get campaign details
 */
router.get('/campaigns/:id', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const campaign = await campaignService.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const analytics = await campaignService.getCampaignAnalytics(req.params.id);
    res.json({ campaign, analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/campaigns
 * Create a new campaign
 */
router.post('/campaigns', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const campaign = await campaignService.createCampaign(req.body, req.user.id);
    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/marketing/campaigns/:id
 * Update a campaign
 */
router.put('/campaigns/:id', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { name, description, subjectLine, previewText, customHtml, segmentId, templateId, scheduledFor } = req.body;

    const result = await db.query(`
      UPDATE marketing_campaigns
      SET name = $1, description = $2, subject_line = $3, preview_text = $4,
          custom_html = $5, segment_id = $6, template_id = $7, scheduled_for = $8, updated_at = NOW()
      WHERE id = $9 AND status IN ('draft', 'scheduled')
      RETURNING *
    `, [name, description, subjectLine, previewText, customHtml, segmentId, templateId, scheduledFor, req.params.id]);

    if (!result.rows[0]) {
      return res.status(400).json({ error: 'Cannot update campaign after sending' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/campaigns/:id/schedule
 * Schedule a campaign
 */
router.post('/campaigns/:id/schedule', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { scheduledFor } = req.body;
    const result = await campaignService.scheduleCampaign(req.params.id, scheduledFor);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/campaigns/:id/send
 * Send a campaign immediately
 */
router.post('/campaigns/:id/send', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    // Send in background
    campaignService.sendCampaign(req.params.id)
      .then(result => console.log('[Marketing] Campaign sent:', result))
      .catch(error => console.error('[Marketing] Campaign send failed:', error));

    res.json({ success: true, message: 'Campaign is being sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/campaigns/:id/test
 * Send a test email
 */
router.post('/campaigns/:id/test', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { testEmail } = req.body;
    const result = await campaignService.sendTestEmail(req.params.id, testEmail || req.user.email);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/campaigns/:id/cancel
 * Cancel a scheduled campaign
 */
router.post('/campaigns/:id/cancel', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    await db.query(`
      UPDATE marketing_campaigns SET status = 'cancelled' WHERE id = $1 AND status = 'scheduled'
    `, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SMS CAMPAIGNS
// ============================================

/**
 * GET /api/marketing/sms/campaigns
 * List all SMS campaigns
 */
router.get('/sms/campaigns', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const { status, limit = 50, offset = 0 } = req.query;
    const campaigns = await smsCampaignService.listCampaigns({
      status,
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    res.json({ campaigns });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketing/sms/campaigns/:id
 * Get SMS campaign details
 */
router.get('/sms/campaigns/:id', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const campaign = await smsCampaignService.getCampaign(req.params.id);
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const analytics = await smsCampaignService.getCampaignAnalytics(req.params.id);
    res.json({ campaign, analytics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/sms/campaigns
 * Create a new SMS campaign
 */
router.post('/sms/campaigns', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const campaign = await smsCampaignService.createCampaign(req.body, req.user.id);
    res.status(201).json(campaign);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/marketing/sms/campaigns/:id
 * Update an SMS campaign
 */
router.put('/sms/campaigns/:id', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { name, description, message, segmentId, scheduledFor } = req.body;

    const result = await db.query(`
      UPDATE marketing_sms_campaigns
      SET name = $1, description = $2, message = $3, segment_id = $4, scheduled_for = $5, updated_at = NOW()
      WHERE id = $6 AND status IN ('draft', 'scheduled')
      RETURNING *
    `, [name, description, message, segmentId, scheduledFor, req.params.id]);

    if (!result.rows[0]) {
      return res.status(400).json({ error: 'Cannot update campaign after sending' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/sms/campaigns/:id/schedule
 * Schedule an SMS campaign
 */
router.post('/sms/campaigns/:id/schedule', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { scheduledFor } = req.body;
    const result = await smsCampaignService.scheduleCampaign(req.params.id, scheduledFor);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/sms/campaigns/:id/send
 * Send an SMS campaign immediately
 */
router.post('/sms/campaigns/:id/send', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    // Send in background
    smsCampaignService.sendCampaign(req.params.id)
      .then(result => console.log('[Marketing] SMS campaign sent:', result))
      .catch(error => console.error('[Marketing] SMS campaign send failed:', error));

    res.json({ success: true, message: 'SMS campaign is being sent' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/sms/campaigns/:id/test
 * Send a test SMS
 */
router.post('/sms/campaigns/:id/test', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { testPhone } = req.body;
    if (!testPhone) {
      return res.status(400).json({ error: 'Test phone number is required' });
    }
    const result = await smsCampaignService.sendTestSMS(req.params.id, testPhone);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/sms/campaigns/:id/cancel
 * Cancel a scheduled SMS campaign
 */
router.post('/sms/campaigns/:id/cancel', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    await db.query(`
      UPDATE marketing_sms_campaigns SET status = 'cancelled' WHERE id = $1 AND status = 'scheduled'
    `, [req.params.id]);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketing/sms/stats
 * Get SMS opt-in statistics
 */
router.get('/sms/stats', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const stats = await smsCampaignService.getOptInStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/sms/webhook
 * Receive SMS replies (from Twilio)
 */
router.post('/sms/webhook', express.urlencoded({ extended: true }), async (req, res) => {
  try {
    const { From: from, Body: body } = req.body;

    if (!from || !body) {
      return res.status(400).send('Missing required fields');
    }

    const result = await smsCampaignService.handleIncomingReply(from, body);

    // Respond with TwiML if we need to send a reply
    if (result.message) {
      res.set('Content-Type', 'text/xml');
      res.send(`<?xml version="1.0" encoding="UTF-8"?>
        <Response>
          <Message>${result.message}</Message>
        </Response>`);
    } else {
      res.status(200).send('<Response></Response>');
    }
  } catch (error) {
    console.error('[SMS Webhook] Error:', error);
    res.status(500).send('<Response></Response>');
  }
});

// ============================================
// AUTOMATIONS
// ============================================

/**
 * GET /api/marketing/automations
 * List all automations
 */
router.get('/automations', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const result = await automationService.listAutomations();
    res.json({ automations: result.rows });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketing/automations/:id
 * Get automation details with steps
 */
router.get('/automations/:id', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const automation = await db.query('SELECT * FROM marketing_automations WHERE id = $1', [req.params.id]);
    if (!automation.rows[0]) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const steps = await db.query(`
      SELECT * FROM marketing_automation_steps
      WHERE automation_id = $1
      ORDER BY step_order
    `, [req.params.id]);

    const stats = await automationService.getAutomationStats(req.params.id);

    res.json({
      automation: automation.rows[0],
      steps: steps.rows,
      stats,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/automations
 * Create a new automation
 */
router.post('/automations', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { name, description, triggerType, triggerConfig, segmentId, steps } = req.body;

    // Create automation
    const result = await db.query(`
      INSERT INTO marketing_automations (name, description, trigger_type, trigger_config, segment_id, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `, [name, description, triggerType, triggerConfig || {}, segmentId, req.user.id]);

    const automationId = result.rows[0].id;

    // Create steps
    if (steps && steps.length > 0) {
      for (let i = 0; i < steps.length; i++) {
        await db.query(`
          INSERT INTO marketing_automation_steps (automation_id, step_order, step_type, config)
          VALUES ($1, $2, $3, $4)
        `, [automationId, i + 1, steps[i].type, steps[i].config]);
      }
    }

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/marketing/automations/:id
 * Update an automation
 */
router.put('/automations/:id', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { name, description, triggerConfig, segmentId, isActive } = req.body;

    const result = await db.query(`
      UPDATE marketing_automations
      SET name = $1, description = $2, trigger_config = $3, segment_id = $4, is_active = $5, updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `, [name, description, triggerConfig, segmentId, isActive, req.params.id]);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/marketing/automations/:id/toggle
 * Toggle automation on/off
 */
router.put('/automations/:id/toggle', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const result = await db.query(`
      UPDATE marketing_automations
      SET is_active = NOT is_active, updated_at = NOW()
      WHERE id = $1
      RETURNING is_active
    `, [req.params.id]);

    res.json({ isActive: result.rows[0].is_active });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/automations/:id/trigger
 * Manually trigger automation for a user
 */
router.post('/automations/:id/trigger', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { userId, contextData } = req.body;

    await automationService.enrollUser(req.params.id, userId, contextData || {});
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// TRACKING ENDPOINTS (Public)
// ============================================

/**
 * GET /api/marketing/track/open/:sendId
 * Track email open (1x1 tracking pixel)
 */
router.get('/track/open/:sendId', async (req, res) => {
  try {
    await campaignService.recordOpen(req.params.sendId);
  } catch (error) {
    console.error('Error tracking open:', error);
  }

  // Return 1x1 transparent GIF
  const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
  res.set('Content-Type', 'image/gif');
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.send(pixel);
});

/**
 * GET /api/marketing/track/click/:sendId
 * Track link click and redirect
 */
router.get('/track/click/:sendId', async (req, res) => {
  try {
    const { url } = req.query;

    if (!url) {
      return res.status(400).send('Missing URL');
    }

    await campaignService.recordClick(
      req.params.sendId,
      url,
      req.ip,
      req.headers['user-agent']
    );

    res.redirect(url);
  } catch (error) {
    console.error('Error tracking click:', error);
    res.redirect(req.query.url || '/');
  }
});

// ============================================
// UNSUBSCRIBE
// ============================================

/**
 * POST /api/marketing/unsubscribe
 * Unsubscribe from marketing emails
 */
router.post('/unsubscribe', async (req, res) => {
  try {
    const { email, reason } = req.body;

    // Update marketing preferences
    await db.query(`
      UPDATE marketing_preferences mp
      SET email_marketing_enabled = false, unsubscribed_at = NOW(), unsubscribe_reason = $1
      FROM users u
      WHERE mp.user_id = u.id AND u.email = $2
    `, [reason, email]);

    // Add to suppression list
    await db.query(`
      INSERT INTO marketing_suppression_list (email, reason, source)
      VALUES ($1, 'unsubscribed', 'user_request')
      ON CONFLICT (email) DO NOTHING
    `, [email]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketing/resubscribe
 * Resubscribe to marketing emails
 */
router.post('/resubscribe', authenticate, async (req, res) => {
  try {
    const user = await db.query('SELECT email FROM users WHERE id = $1', [req.user.id]);

    await db.query(`
      UPDATE marketing_preferences
      SET email_marketing_enabled = true, unsubscribed_at = NULL
      WHERE user_id = $1
    `, [req.user.id]);

    await db.query('DELETE FROM marketing_suppression_list WHERE email = $1', [user.rows[0].email]);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// PREFERENCES
// ============================================

/**
 * GET /api/marketing/preferences
 * Get current user's marketing preferences
 */
router.get('/preferences', authenticate, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT * FROM marketing_preferences WHERE user_id = $1
    `, [req.user.id]);

    res.json(result.rows[0] || {
      email_marketing_enabled: true,
      sms_marketing_enabled: true,
      receive_newsletters: true,
      receive_promotions: true,
      receive_class_announcements: true,
      receive_workshop_announcements: true,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/marketing/preferences
 * Update marketing preferences
 */
router.put('/preferences', authenticate, async (req, res) => {
  try {
    const {
      emailMarketingEnabled,
      smsMarketingEnabled,
      receiveNewsletters,
      receivePromotions,
      receiveClassAnnouncements,
      receiveWorkshopAnnouncements,
      maxEmailsPerWeek,
    } = req.body;

    const result = await db.query(`
      INSERT INTO marketing_preferences (
        user_id, email_marketing_enabled, sms_marketing_enabled,
        receive_newsletters, receive_promotions, receive_class_announcements,
        receive_workshop_announcements, max_emails_per_week
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (user_id) DO UPDATE SET
        email_marketing_enabled = EXCLUDED.email_marketing_enabled,
        sms_marketing_enabled = EXCLUDED.sms_marketing_enabled,
        receive_newsletters = EXCLUDED.receive_newsletters,
        receive_promotions = EXCLUDED.receive_promotions,
        receive_class_announcements = EXCLUDED.receive_class_announcements,
        receive_workshop_announcements = EXCLUDED.receive_workshop_announcements,
        max_emails_per_week = EXCLUDED.max_emails_per_week,
        updated_at = NOW()
      RETURNING *
    `, [
      req.user.id,
      emailMarketingEnabled ?? true,
      smsMarketingEnabled ?? true,
      receiveNewsletters ?? true,
      receivePromotions ?? true,
      receiveClassAnnouncements ?? true,
      receiveWorkshopAnnouncements ?? true,
      maxEmailsPerWeek ?? 3,
    ]);

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
