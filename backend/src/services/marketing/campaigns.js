// ============================================
// EMAIL CAMPAIGN SERVICE
// Send marketing emails with tracking
// ============================================

const db = require('../../database/connection');
const { sendEmail } = require('../notifications');
const { SegmentationEngine } = require('./segments');

const segmentEngine = new SegmentationEngine();

class CampaignService {
  /**
   * Create a new campaign
   */
  async createCampaign(data, createdBy) {
    const result = await db.query(`
      INSERT INTO marketing_campaigns (
        name, description, campaign_type, template_id,
        subject_line, preview_text, custom_html,
        segment_id, recipient_list, scheduled_for,
        created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `, [
      data.name,
      data.description,
      data.campaignType || 'one_time',
      data.templateId,
      data.subjectLine,
      data.previewText,
      data.customHtml,
      data.segmentId,
      data.recipientList,
      data.scheduledFor,
      createdBy,
    ]);

    return result.rows[0];
  }

  /**
   * Schedule a campaign for sending
   */
  async scheduleCampaign(campaignId, scheduledFor) {
    // Get recipient count
    const campaign = await this.getCampaign(campaignId);
    const recipientCount = await this.getRecipientCount(campaign);

    await db.query(`
      UPDATE marketing_campaigns
      SET status = 'scheduled', scheduled_for = $1, total_recipients = $2, updated_at = NOW()
      WHERE id = $3
    `, [scheduledFor, recipientCount, campaignId]);

    return { success: true, recipientCount };
  }

  /**
   * Send a campaign immediately
   */
  async sendCampaign(campaignId) {
    const campaign = await this.getCampaign(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'sent') {
      throw new Error('Campaign already sent');
    }

    // Mark as sending
    await db.query(`
      UPDATE marketing_campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1
    `, [campaignId]);

    try {
      // Get recipients
      const recipients = await this.getCampaignRecipients(campaign);

      console.log(`[Campaign] Sending "${campaign.name}" to ${recipients.length} recipients`);

      // Get template
      const template = await this.getTemplate(campaign.template_id);

      let sent = 0;
      let failed = 0;

      // Send emails in batches
      const batchSize = 50;
      for (let i = 0; i < recipients.length; i += batchSize) {
        const batch = recipients.slice(i, i + batchSize);

        await Promise.all(batch.map(async (recipient) => {
          try {
            await this.sendCampaignEmail(campaign, template, recipient);
            sent++;
          } catch (error) {
            failed++;
            console.error(`[Campaign] Failed to send to ${recipient.email}:`, error.message);
          }
        }));

        // Update progress periodically
        await db.query(`
          UPDATE marketing_campaigns SET total_sent = $1 WHERE id = $2
        `, [sent, campaignId]);
      }

      // Mark as complete
      await db.query(`
        UPDATE marketing_campaigns
        SET status = 'sent', sent_at = NOW(), total_recipients = $1, total_sent = $2
        WHERE id = $3
      `, [recipients.length, sent, campaignId]);

      console.log(`[Campaign] "${campaign.name}" complete: ${sent} sent, ${failed} failed`);

      return { success: true, sent, failed };
    } catch (error) {
      // Mark as failed
      await db.query(`
        UPDATE marketing_campaigns SET status = 'draft', updated_at = NOW() WHERE id = $1
      `, [campaignId]);
      throw error;
    }
  }

  /**
   * Send a single campaign email
   */
  async sendCampaignEmail(campaign, template, recipient) {
    // Check if user can receive marketing emails
    const canReceive = await db.query(
      'SELECT can_receive_marketing_email($1) as allowed',
      [recipient.id]
    );

    if (!canReceive.rows[0]?.allowed) {
      console.log(`[Campaign] Skipping ${recipient.email} - opted out`);
      return;
    }

    // Build personalization data
    const personalization = this.buildPersonalizationData(recipient, campaign);

    // Process template
    const subject = this.processTemplate(
      campaign.subject_line || template.subject,
      personalization
    );
    const html = this.processTemplate(
      campaign.custom_html || template.body_html,
      personalization
    );

    // Add tracking pixel
    const sendId = await this.createCampaignSend(campaign.id, recipient, personalization);
    const trackedHtml = this.addTrackingPixel(html, sendId);

    // Send email
    const result = await sendEmail(recipient.email, subject, trackedHtml);

    // Update send record
    if (result.success) {
      await db.query(`
        UPDATE marketing_campaign_sends
        SET status = 'sent', sent_at = NOW()
        WHERE id = $1
      `, [sendId]);
    } else {
      await db.query(`
        UPDATE marketing_campaign_sends
        SET status = 'failed', error_message = $1
        WHERE id = $2
      `, [result.error, sendId]);
    }

    return result;
  }

  /**
   * Create a campaign send record
   */
  async createCampaignSend(campaignId, recipient, personalization) {
    const result = await db.query(`
      INSERT INTO marketing_campaign_sends (
        campaign_id, user_id, recipient_email, recipient_name, personalization_data
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      campaignId,
      recipient.id,
      recipient.email,
      `${recipient.first_name} ${recipient.last_name}`,
      personalization,
    ]);

    return result.rows[0].id;
  }

  /**
   * Get campaign recipients
   */
  async getCampaignRecipients(campaign) {
    if (campaign.recipient_list && campaign.recipient_list.length > 0) {
      // Manual recipient list
      const result = await db.query(`
        SELECT id, email, first_name, last_name, phone
        FROM users
        WHERE id = ANY($1) AND is_active = true
      `, [campaign.recipient_list]);
      return result.rows;
    }

    if (campaign.segment_id) {
      // Segment-based recipients
      const { users } = await segmentEngine.getSegmentMembers(campaign.segment_id, { limit: 50000 });
      return users;
    }

    // Default: all active students
    const result = await db.query(`
      SELECT id, email, first_name, last_name, phone
      FROM users
      WHERE is_active = true AND role = 'student'
    `);
    return result.rows;
  }

  /**
   * Get recipient count for a campaign
   */
  async getRecipientCount(campaign) {
    const recipients = await this.getCampaignRecipients(campaign);
    return recipients.length;
  }

  /**
   * Build personalization data for a recipient
   */
  buildPersonalizationData(recipient, campaign = {}) {
    const baseUrl = process.env.FRONTEND_URL || 'https://thestudioreno.com';

    return {
      first_name: recipient.first_name || 'there',
      last_name: recipient.last_name || '',
      email: recipient.email,
      membership_name: recipient.membership_name || 'your membership',
      membership_type: recipient.membership_type,
      credits_remaining: recipient.credits_remaining,
      membership_end_date: recipient.membership_end_date,
      days_remaining: recipient.membership_end_date
        ? Math.max(0, Math.ceil((new Date(recipient.membership_end_date) - new Date()) / (1000 * 60 * 60 * 24)))
        : null,
      booking_url: `${baseUrl}/schedule`,
      renew_url: `${baseUrl}/pricing`,
      unsubscribe_url: `${baseUrl}/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
      ...campaign.customData,
    };
  }

  /**
   * Process template with personalization data
   */
  processTemplate(template, data) {
    if (!template) return '';

    let result = template;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value ?? '');
    }

    return result;
  }

  /**
   * Add tracking pixel to email HTML
   */
  addTrackingPixel(html, sendId) {
    const trackingUrl = `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/marketing/track/open/${sendId}`;
    const pixel = `<img src="${trackingUrl}" width="1" height="1" style="display:none;" alt="" />`;

    // Insert before closing body tag
    if (html.includes('</body>')) {
      return html.replace('</body>', `${pixel}</body>`);
    }

    // Or append to end
    return html + pixel;
  }

  /**
   * Record email open
   */
  async recordOpen(sendId) {
    await db.query(`
      UPDATE marketing_campaign_sends
      SET status = CASE WHEN status = 'sent' THEN 'opened' ELSE status END,
          opened_at = COALESCE(opened_at, NOW())
      WHERE id = $1
    `, [sendId]);

    // Update campaign stats
    await db.query(`
      UPDATE marketing_campaigns c
      SET total_opened = (
        SELECT COUNT(*) FROM marketing_campaign_sends s
        WHERE s.campaign_id = c.id AND s.opened_at IS NOT NULL
      )
      WHERE id = (SELECT campaign_id FROM marketing_campaign_sends WHERE id = $1)
    `, [sendId]);
  }

  /**
   * Record click
   */
  async recordClick(sendId, url, ip, userAgent) {
    const send = await db.query(
      'SELECT * FROM marketing_campaign_sends WHERE id = $1',
      [sendId]
    );

    if (!send.rows[0]) return;

    // Record click
    await db.query(`
      INSERT INTO marketing_click_tracking (send_id, campaign_id, user_id, original_url, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [sendId, send.rows[0].campaign_id, send.rows[0].user_id, url, ip, userAgent]);

    // Update send record
    await db.query(`
      UPDATE marketing_campaign_sends
      SET status = 'clicked',
          first_clicked_at = COALESCE(first_clicked_at, NOW()),
          click_count = click_count + 1
      WHERE id = $1
    `, [sendId]);

    // Update campaign stats
    await db.query(`
      UPDATE marketing_campaigns c
      SET total_clicked = (
        SELECT COUNT(DISTINCT s.id) FROM marketing_campaign_sends s
        WHERE s.campaign_id = c.id AND s.first_clicked_at IS NOT NULL
      )
      WHERE id = $2
    `, [sendId, send.rows[0].campaign_id]);
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(id) {
    const result = await db.query('SELECT * FROM marketing_campaigns WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * Get template by ID
   */
  async getTemplate(id) {
    const result = await db.query('SELECT * FROM marketing_email_templates WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * List campaigns with stats
   */
  async listCampaigns(options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let query = 'SELECT * FROM marketing_campaign_stats';
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT $' + (params.length + 1) + ' OFFSET $' + (params.length + 2);
    params.push(limit, offset);

    // Fix: Need to query the view differently since it doesn't have created_at
    const result = await db.query(`
      SELECT * FROM marketing_campaign_stats
      ${status ? 'WHERE status = $1' : ''}
      LIMIT ${status ? '$2' : '$1'} OFFSET ${status ? '$3' : '$2'}
    `, status ? [status, limit, offset] : [limit, offset]);

    return result.rows;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId) {
    const campaign = await db.query(`
      SELECT * FROM marketing_campaign_stats WHERE id = $1
    `, [campaignId]);

    // Get click breakdown
    const clicks = await db.query(`
      SELECT original_url, COUNT(*) as clicks
      FROM marketing_click_tracking
      WHERE campaign_id = $1
      GROUP BY original_url
      ORDER BY clicks DESC
    `, [campaignId]);

    // Get opens over time
    const opensOverTime = await db.query(`
      SELECT DATE_TRUNC('hour', opened_at) as hour, COUNT(*) as opens
      FROM marketing_campaign_sends
      WHERE campaign_id = $1 AND opened_at IS NOT NULL
      GROUP BY hour
      ORDER BY hour
    `, [campaignId]);

    return {
      ...campaign.rows[0],
      clicksByUrl: clicks.rows,
      opensOverTime: opensOverTime.rows,
    };
  }

  /**
   * Send a test email
   */
  async sendTestEmail(campaignId, testEmail) {
    const campaign = await this.getCampaign(campaignId);
    const template = await this.getTemplate(campaign.template_id);

    // Create fake recipient data
    const testRecipient = {
      id: null,
      email: testEmail,
      first_name: 'Test',
      last_name: 'User',
      membership_name: 'Monthly Unlimited',
      membership_type: 'unlimited',
      credits_remaining: 10,
      membership_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    };

    const personalization = this.buildPersonalizationData(testRecipient, campaign);
    const subject = '[TEST] ' + this.processTemplate(campaign.subject_line || template.subject, personalization);
    const html = this.processTemplate(campaign.custom_html || template.body_html, personalization);

    return sendEmail(testEmail, subject, html);
  }

  /**
   * Process scheduled campaigns (called by cron job)
   */
  async processScheduledCampaigns() {
    const scheduled = await db.query(`
      SELECT * FROM marketing_campaigns
      WHERE status = 'scheduled' AND scheduled_for <= NOW()
    `);

    for (const campaign of scheduled.rows) {
      console.log(`[Campaign] Processing scheduled campaign: ${campaign.name}`);
      try {
        await this.sendCampaign(campaign.id);
      } catch (error) {
        console.error(`[Campaign] Error sending ${campaign.name}:`, error.message);
      }
    }

    return { processed: scheduled.rows.length };
  }
}

module.exports = { CampaignService };
