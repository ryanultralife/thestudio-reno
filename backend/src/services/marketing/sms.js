// ============================================
// SMS CAMPAIGN SERVICE
// Send SMS marketing messages with tracking
// TCPA compliant messaging
// ============================================

const db = require('../../database/connection');
const { sendSMS } = require('../notifications');
const { SegmentationEngine } = require('./segments');

const segmentEngine = new SegmentationEngine();

// SMS rate limits and compliance
const SMS_BATCH_SIZE = 100;
const SMS_BATCH_DELAY_MS = 1000; // 1 second between batches
const QUIET_HOURS_START = 21; // 9 PM
const QUIET_HOURS_END = 8; // 8 AM

class SMSCampaignService {
  /**
   * Create a new SMS campaign
   */
  async createCampaign(data, createdBy) {
    // Validate message length
    if (data.message && data.message.length > 160) {
      console.warn('[SMS] Message exceeds 160 characters, will be split into multiple parts');
    }

    const result = await db.query(`
      INSERT INTO marketing_sms_campaigns (
        name, description, message, segment_id, recipient_list,
        scheduled_for, is_promotional, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      data.name,
      data.description,
      data.message,
      data.segmentId,
      data.recipientList,
      data.scheduledFor,
      data.isPromotional ?? true,
      createdBy,
    ]);

    return result.rows[0];
  }

  /**
   * Schedule an SMS campaign
   */
  async scheduleCampaign(campaignId, scheduledFor) {
    // Check quiet hours compliance
    const scheduleHour = new Date(scheduledFor).getHours();
    if (scheduleHour >= QUIET_HOURS_START || scheduleHour < QUIET_HOURS_END) {
      throw new Error(`Cannot schedule SMS during quiet hours (${QUIET_HOURS_END}AM - ${QUIET_HOURS_START}PM)`);
    }

    const campaign = await this.getCampaign(campaignId);
    const recipientCount = await this.getRecipientCount(campaign);

    await db.query(`
      UPDATE marketing_sms_campaigns
      SET status = 'scheduled', scheduled_for = $1, total_recipients = $2, updated_at = NOW()
      WHERE id = $3
    `, [scheduledFor, recipientCount, campaignId]);

    return { success: true, recipientCount };
  }

  /**
   * Send an SMS campaign immediately
   */
  async sendCampaign(campaignId) {
    const campaign = await this.getCampaign(campaignId);

    if (!campaign) {
      throw new Error('Campaign not found');
    }

    if (campaign.status === 'sent') {
      throw new Error('Campaign already sent');
    }

    // Check quiet hours
    const currentHour = new Date().getHours();
    if (currentHour >= QUIET_HOURS_START || currentHour < QUIET_HOURS_END) {
      throw new Error(`Cannot send SMS during quiet hours (${QUIET_HOURS_END}AM - ${QUIET_HOURS_START}PM)`);
    }

    // Mark as sending
    await db.query(`
      UPDATE marketing_sms_campaigns SET status = 'sending', updated_at = NOW() WHERE id = $1
    `, [campaignId]);

    try {
      const recipients = await this.getCampaignRecipients(campaign);

      console.log(`[SMS Campaign] Sending "${campaign.name}" to ${recipients.length} recipients`);

      let sent = 0;
      let failed = 0;
      let skipped = 0;

      // Send in batches with rate limiting
      for (let i = 0; i < recipients.length; i += SMS_BATCH_SIZE) {
        const batch = recipients.slice(i, i + SMS_BATCH_SIZE);

        await Promise.all(batch.map(async (recipient) => {
          try {
            const result = await this.sendCampaignSMS(campaign, recipient);
            if (result.skipped) {
              skipped++;
            } else {
              sent++;
            }
          } catch (error) {
            failed++;
            console.error(`[SMS Campaign] Failed to send to ${recipient.phone}:`, error.message);
          }
        }));

        // Update progress
        await db.query(`
          UPDATE marketing_sms_campaigns SET total_sent = $1 WHERE id = $2
        `, [sent, campaignId]);

        // Rate limiting delay between batches
        if (i + SMS_BATCH_SIZE < recipients.length) {
          await this.sleep(SMS_BATCH_DELAY_MS);
        }
      }

      // Mark as complete
      await db.query(`
        UPDATE marketing_sms_campaigns
        SET status = 'sent', sent_at = NOW(), total_recipients = $1, total_sent = $2
        WHERE id = $3
      `, [recipients.length, sent, campaignId]);

      console.log(`[SMS Campaign] "${campaign.name}" complete: ${sent} sent, ${failed} failed, ${skipped} skipped`);

      return { success: true, sent, failed, skipped };
    } catch (error) {
      await db.query(`
        UPDATE marketing_sms_campaigns SET status = 'draft', updated_at = NOW() WHERE id = $1
      `, [campaignId]);
      throw error;
    }
  }

  /**
   * Send a single campaign SMS
   */
  async sendCampaignSMS(campaign, recipient) {
    // Check opt-in status (TCPA compliance)
    const optIn = await db.query(`
      SELECT sms_opted_in, sms_opt_in_date, sms_consent_text
      FROM marketing_subscribers
      WHERE user_id = $1 OR phone = $2
    `, [recipient.id, recipient.phone]);

    // Skip if not opted in for promotional messages
    if (campaign.is_promotional && (!optIn.rows[0] || !optIn.rows[0].sms_opted_in)) {
      console.log(`[SMS Campaign] Skipping ${recipient.phone} - not opted in`);
      return { skipped: true, reason: 'not_opted_in' };
    }

    // Build personalized message
    const message = this.processTemplate(campaign.message, recipient);

    // Create send record
    const sendId = await this.createCampaignSend(campaign.id, recipient, message);

    // Send SMS
    try {
      const result = await sendSMS(recipient.phone, message);

      // Update send record
      await db.query(`
        UPDATE marketing_sms_sends
        SET status = 'sent', sent_at = NOW(), twilio_sid = $1
        WHERE id = $2
      `, [result.sid || null, sendId]);

      return { success: true, sendId };
    } catch (error) {
      await db.query(`
        UPDATE marketing_sms_sends
        SET status = 'failed', error_message = $1
        WHERE id = $2
      `, [error.message, sendId]);
      throw error;
    }
  }

  /**
   * Create a campaign send record
   */
  async createCampaignSend(campaignId, recipient, message) {
    const result = await db.query(`
      INSERT INTO marketing_sms_sends (
        campaign_id, user_id, subscriber_id, phone, message_content
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [
      campaignId,
      recipient.id,
      recipient.subscriber_id,
      recipient.phone,
      message,
    ]);

    return result.rows[0].id;
  }

  /**
   * Get campaign recipients (opted-in SMS users)
   */
  async getCampaignRecipients(campaign) {
    if (campaign.recipient_list && campaign.recipient_list.length > 0) {
      // Manual recipient list - still need opt-in check
      const result = await db.query(`
        SELECT
          u.id, u.phone, u.first_name, u.last_name,
          ms.id as subscriber_id, ms.sms_opted_in
        FROM users u
        LEFT JOIN marketing_subscribers ms ON ms.user_id = u.id OR ms.phone = u.phone
        WHERE u.id = ANY($1) AND u.is_active = true AND u.phone IS NOT NULL
      `, [campaign.recipient_list]);
      return result.rows;
    }

    if (campaign.segment_id) {
      // Segment-based recipients - filter by SMS opt-in
      const { users } = await segmentEngine.getSegmentMembers(campaign.segment_id, { limit: 50000 });

      // Get opt-in status for all users
      const userIds = users.map(u => u.id);
      const optIns = await db.query(`
        SELECT user_id, phone, sms_opted_in, id as subscriber_id
        FROM marketing_subscribers
        WHERE (user_id = ANY($1) OR phone = ANY($2)) AND sms_opted_in = true
      `, [userIds, users.map(u => u.phone).filter(Boolean)]);

      const optInMap = new Map();
      optIns.rows.forEach(row => {
        if (row.user_id) optInMap.set(row.user_id, row);
        if (row.phone) optInMap.set(row.phone, row);
      });

      return users
        .filter(u => u.phone && (optInMap.has(u.id) || optInMap.has(u.phone)))
        .map(u => {
          const sub = optInMap.get(u.id) || optInMap.get(u.phone);
          return { ...u, subscriber_id: sub?.subscriber_id };
        });
    }

    // Default: all SMS opted-in subscribers
    const result = await db.query(`
      SELECT
        u.id, u.phone, u.first_name, u.last_name,
        ms.id as subscriber_id
      FROM marketing_subscribers ms
      JOIN users u ON u.id = ms.user_id OR u.phone = ms.phone
      WHERE ms.sms_opted_in = true AND u.phone IS NOT NULL
    `);

    return result.rows;
  }

  /**
   * Get recipient count
   */
  async getRecipientCount(campaign) {
    const recipients = await this.getCampaignRecipients(campaign);
    return recipients.length;
  }

  /**
   * Process template with personalization
   */
  processTemplate(template, data) {
    if (!template) return '';

    let result = template;
    const replacements = {
      first_name: data.first_name || '',
      last_name: data.last_name || '',
      name: `${data.first_name || ''} ${data.last_name || ''}`.trim(),
    };

    for (const [key, value] of Object.entries(replacements)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      result = result.replace(regex, value);
    }

    return result;
  }

  /**
   * Get campaign by ID
   */
  async getCampaign(id) {
    const result = await db.query('SELECT * FROM marketing_sms_campaigns WHERE id = $1', [id]);
    return result.rows[0];
  }

  /**
   * List SMS campaigns
   */
  async listCampaigns(options = {}) {
    const { status, limit = 50, offset = 0 } = options;

    let query = `
      SELECT
        c.*,
        ROUND((c.total_sent::decimal / NULLIF(c.total_recipients, 0)) * 100, 1) as delivery_rate
      FROM marketing_sms_campaigns c
    `;
    const params = [];

    if (status) {
      query += ' WHERE status = $1';
      params.push(status);
    }

    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);
    return result.rows;
  }

  /**
   * Get campaign analytics
   */
  async getCampaignAnalytics(campaignId) {
    const campaign = await this.getCampaign(campaignId);

    // Get send status breakdown
    const statusBreakdown = await db.query(`
      SELECT status, COUNT(*) as count
      FROM marketing_sms_sends
      WHERE campaign_id = $1
      GROUP BY status
    `, [campaignId]);

    // Get sends over time
    const sendsOverTime = await db.query(`
      SELECT DATE_TRUNC('hour', sent_at) as hour, COUNT(*) as sends
      FROM marketing_sms_sends
      WHERE campaign_id = $1 AND sent_at IS NOT NULL
      GROUP BY hour
      ORDER BY hour
    `, [campaignId]);

    return {
      ...campaign,
      statusBreakdown: statusBreakdown.rows,
      sendsOverTime: sendsOverTime.rows,
    };
  }

  /**
   * Send a test SMS
   */
  async sendTestSMS(campaignId, testPhone) {
    const campaign = await this.getCampaign(campaignId);

    const testRecipient = {
      first_name: 'Test',
      last_name: 'User',
    };

    const message = '[TEST] ' + this.processTemplate(campaign.message, testRecipient);
    return sendSMS(testPhone, message);
  }

  /**
   * Process scheduled SMS campaigns (called by cron job)
   */
  async processScheduledCampaigns() {
    // Check quiet hours
    const currentHour = new Date().getHours();
    if (currentHour >= QUIET_HOURS_START || currentHour < QUIET_HOURS_END) {
      console.log('[SMS Campaign] Skipping processing during quiet hours');
      return { processed: 0, reason: 'quiet_hours' };
    }

    const scheduled = await db.query(`
      SELECT * FROM marketing_sms_campaigns
      WHERE status = 'scheduled' AND scheduled_for <= NOW()
    `);

    for (const campaign of scheduled.rows) {
      console.log(`[SMS Campaign] Processing scheduled campaign: ${campaign.name}`);
      try {
        await this.sendCampaign(campaign.id);
      } catch (error) {
        console.error(`[SMS Campaign] Error sending ${campaign.name}:`, error.message);
      }
    }

    return { processed: scheduled.rows.length };
  }

  /**
   * Handle incoming SMS replies (for opt-out processing)
   */
  async handleIncomingReply(from, body) {
    const normalizedBody = body.trim().toUpperCase();

    // TCPA required opt-out keywords
    const optOutKeywords = ['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT'];
    const optInKeywords = ['START', 'YES', 'UNSTOP'];

    if (optOutKeywords.includes(normalizedBody)) {
      // Process opt-out
      await this.processOptOut(from, body);
      return { action: 'opted_out', message: 'You have been unsubscribed from SMS messages.' };
    }

    if (optInKeywords.includes(normalizedBody)) {
      // Process opt-in
      await this.processOptIn(from, body);
      return { action: 'opted_in', message: 'You have been subscribed to SMS messages.' };
    }

    // Log other replies
    await db.query(`
      INSERT INTO marketing_sms_replies (from_phone, message_body)
      VALUES ($1, $2)
    `, [from, body]);

    return { action: 'logged' };
  }

  /**
   * Process SMS opt-out
   */
  async processOptOut(phone, message) {
    const normalizedPhone = this.normalizePhone(phone);

    // Update subscriber record
    await db.query(`
      UPDATE marketing_subscribers
      SET sms_opted_in = false, sms_opt_out_date = NOW(), sms_opt_out_source = 'sms_reply'
      WHERE phone = $1
    `, [normalizedPhone]);

    // Log for compliance
    await db.query(`
      INSERT INTO marketing_consent_audit_log (
        subscriber_phone, action, source, message_content
      ) VALUES ($1, 'sms_opt_out', 'sms_reply', $2)
    `, [normalizedPhone, message]);

    console.log(`[SMS] Opt-out processed for ${normalizedPhone}`);
  }

  /**
   * Process SMS opt-in
   */
  async processOptIn(phone, message) {
    const normalizedPhone = this.normalizePhone(phone);

    // Update or insert subscriber
    await db.query(`
      INSERT INTO marketing_subscribers (phone, sms_opted_in, sms_opt_in_date, sms_opt_in_source)
      VALUES ($1, true, NOW(), 'sms_reply')
      ON CONFLICT (phone) DO UPDATE SET
        sms_opted_in = true,
        sms_opt_in_date = NOW(),
        sms_opt_in_source = 'sms_reply'
    `, [normalizedPhone]);

    // Log for compliance
    await db.query(`
      INSERT INTO marketing_consent_audit_log (
        subscriber_phone, action, source, message_content
      ) VALUES ($1, 'sms_opt_in', 'sms_reply', $2)
    `, [normalizedPhone, message]);

    console.log(`[SMS] Opt-in processed for ${normalizedPhone}`);
  }

  /**
   * Normalize phone number format
   */
  normalizePhone(phone) {
    // Remove all non-numeric characters
    const digits = phone.replace(/\D/g, '');

    // Handle US numbers
    if (digits.length === 10) {
      return '+1' + digits;
    }
    if (digits.length === 11 && digits.startsWith('1')) {
      return '+' + digits;
    }

    // Return with + prefix
    return digits.startsWith('+') ? digits : '+' + digits;
  }

  /**
   * Get SMS opt-in stats
   */
  async getOptInStats() {
    const result = await db.query(`
      SELECT
        COUNT(*) as total_subscribers,
        COUNT(*) FILTER (WHERE sms_opted_in = true) as opted_in,
        COUNT(*) FILTER (WHERE sms_opted_in = false) as opted_out,
        COUNT(*) FILTER (WHERE sms_opt_in_date >= NOW() - INTERVAL '30 days') as new_last_30_days,
        COUNT(*) FILTER (WHERE sms_opt_out_date >= NOW() - INTERVAL '30 days') as optouts_last_30_days
      FROM marketing_subscribers
      WHERE phone IS NOT NULL
    `);

    return result.rows[0];
  }

  /**
   * Sleep helper for rate limiting
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { SMSCampaignService };
