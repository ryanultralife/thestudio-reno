// ============================================
// AUTOMATED NOTIFICATION CAMPAIGNS SERVICE
// Checks conditions and triggers automated emails/SMS
// ============================================

const db = require('../database/connection');
const notifications = require('./notifications');

// ============================================
// RUN CAMPAIGNS
// Check and execute campaigns that are due
// ============================================

async function runCampaigns() {
  console.log('[Campaigns] Starting campaign run...');

  try {
    // Get campaigns that are due to run
    const { rows: campaigns } = await db.query(`
      SELECT * FROM notification_campaigns
      WHERE is_active = true
        AND (next_run_at IS NULL OR next_run_at <= NOW())
      ORDER BY next_run_at ASC NULLS FIRST
    `);

    if (campaigns.length === 0) {
      console.log('[Campaigns] No campaigns due to run');
      return { campaigns_checked: 0, total_sent: 0 };
    }

    console.log(`[Campaigns] Found ${campaigns.length} campaigns to run`);

    let total_sent = 0;

    for (const campaign of campaigns) {
      try {
        const sent = await runSingleCampaign(campaign);
        total_sent += sent;

        // Update next run time
        await updateNextRunTime(campaign);
      } catch (err) {
        console.error(`[Campaigns] Error running campaign ${campaign.id}:`, err);
        // Continue with other campaigns
      }
    }

    console.log(`[Campaigns] Campaign run complete. Total sent: ${total_sent}`);
    return { campaigns_checked: campaigns.length, total_sent };

  } catch (err) {
    console.error('[Campaigns] Error in runCampaigns:', err);
    throw err;
  }
}

// ============================================
// RUN SINGLE CAMPAIGN
// Execute one campaign and send to eligible users
// ============================================

async function runSingleCampaign(campaign) {
  console.log(`[Campaigns] Running campaign: ${campaign.name} (${campaign.id})`);

  try {
    // Get eligible users using our database function
    const { rows: targets } = await db.query(
      `SELECT * FROM get_campaign_targets($1)`,
      [campaign.id]
    );

    if (targets.length === 0) {
      console.log(`[Campaigns] No eligible users for campaign: ${campaign.name}`);
      return 0;
    }

    console.log(`[Campaigns] Found ${targets.length} eligible users`);

    // Apply max sends limit
    const toSend = campaign.max_sends_per_run
      ? targets.slice(0, campaign.max_sends_per_run)
      : targets;

    let sent_count = 0;

    // Send to each user
    for (const user of toSend) {
      try {
        await sendCampaignMessage(campaign, user);
        sent_count++;
      } catch (err) {
        console.error(`[Campaigns] Error sending to user ${user.user_id}:`, err);
        // Log the failure
        await logCampaignSend(campaign.id, user.user_id, 'failed', campaign.channel, err.message);
      }
    }

    // Update campaign stats
    await db.query(
      `UPDATE notification_campaigns
       SET total_sent = total_sent + $1,
           last_run_at = NOW()
       WHERE id = $2`,
      [sent_count, campaign.id]
    );

    console.log(`[Campaigns] Sent ${sent_count} messages for campaign: ${campaign.name}`);
    return sent_count;

  } catch (err) {
    console.error(`[Campaigns] Error running campaign ${campaign.id}:`, err);
    throw err;
  }
}

// ============================================
// SEND CAMPAIGN MESSAGE
// Send email/SMS to individual user
// ============================================

async function sendCampaignMessage(campaign, user) {
  // Get user's full data for personalization
  const { rows: [userData] } = await db.query(
    `SELECT u.*,
            m.end_date as membership_end_date,
            m.credits_remaining,
            mem.classes_last_30_days,
            mem.days_since_last_class
     FROM users u
     LEFT JOIN memberships m ON u.id = m.user_id AND m.status = 'active'
     LEFT JOIN member_engagement_metrics mem ON u.id = mem.user_id
     WHERE u.id = $1`,
    [user.user_id]
  );

  if (!userData) {
    throw new Error('User not found');
  }

  // Personalize message
  const personalizedSubject = personalize(campaign.email_subject, userData);
  const personalizedBody = personalize(campaign.email_body, userData);
  const personalizedSMS = campaign.sms_message ? personalize(campaign.sms_message, userData) : null;

  // Send based on channel
  if (campaign.channel === 'email' || campaign.channel === 'both') {
    await notifications.sendEmail(
      userData.email,
      personalizedSubject,
      personalizedBody
    );

    await logCampaignSend(campaign.id, user.user_id, 'sent', 'email');
  }

  if ((campaign.channel === 'sms' || campaign.channel === 'both') && userData.phone && personalizedSMS) {
    await notifications.sendSMS(
      userData.phone,
      personalizedSMS
    );

    await logCampaignSend(campaign.id, user.user_id, 'sent', 'sms');
  }
}

// ============================================
// PERSONALIZE MESSAGE
// Replace template variables with user data
// ============================================

function personalize(template, userData) {
  if (!template) return '';

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const vars = {
    first_name: userData.first_name || 'there',
    last_name: userData.last_name || '',
    email: userData.email,
    expiration_date: userData.membership_end_date
      ? new Date(userData.membership_end_date).toLocaleDateString()
      : '',
    credits_remaining: userData.credits_remaining || 0,
    classes_last_month: userData.classes_last_30_days || 0,
    days_since_visit: userData.days_since_last_class || 0,
    schedule_link: `${frontendUrl}/schedule`,
    renewal_link: `${frontendUrl}/pricing`,
    purchase_link: `${frontendUrl}/pricing`,
    account_link: `${frontendUrl}/account`,
  };

  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value);
  }

  return result;
}

// ============================================
// LOG CAMPAIGN SEND
// Record that a message was sent
// ============================================

async function logCampaignSend(campaignId, userId, status, channel, errorMessage = null) {
  await db.query(
    `INSERT INTO notification_campaign_logs (campaign_id, user_id, status, channel, error_message)
     VALUES ($1, $2, $3, $4, $5)`,
    [campaignId, userId, status, channel, errorMessage]
  );
}

// ============================================
// UPDATE NEXT RUN TIME
// Calculate when campaign should run next
// ============================================

async function updateNextRunTime(campaign) {
  const nextRun = calculateNextRunTime(campaign.run_frequency, campaign.run_time);

  await db.query(
    `UPDATE notification_campaigns
     SET next_run_at = $1
     WHERE id = $2`,
    [nextRun, campaign.id]
  );
}

function calculateNextRunTime(frequency, runTime) {
  const now = new Date();
  let next = new Date();

  // Parse run time
  const [hours, minutes, seconds] = runTime.split(':').map(Number);

  switch (frequency) {
    case 'hourly':
      next.setHours(next.getHours() + 1, 0, 0, 0);
      break;

    case 'daily':
      next.setHours(hours, minutes, seconds || 0, 0);
      // If already past today's run time, schedule for tomorrow
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
      break;

    case 'weekly':
      next.setHours(hours, minutes, seconds || 0, 0);
      next.setDate(next.getDate() + 7);
      break;

    default:
      // Default to daily
      next.setHours(hours, minutes, seconds || 0, 0);
      if (next <= now) {
        next.setDate(next.getDate() + 1);
      }
  }

  return next;
}

// ============================================
// GET CAMPAIGN PREVIEW
// Preview who would receive a campaign
// ============================================

async function getCampaignPreview(campaignId) {
  try {
    const { rows: targets } = await db.query(
      `SELECT
        user_id,
        email,
        first_name,
        last_name,
        phone
       FROM get_campaign_targets($1)
       LIMIT 100`, // Preview first 100
      [campaignId]
    );

    return { targets, count: targets.length };
  } catch (err) {
    console.error('[Campaigns] Error getting campaign preview:', err);
    throw err;
  }
}

// ============================================
// GET CAMPAIGN STATS
// Get performance metrics for a campaign
// ============================================

async function getCampaignStats(campaignId) {
  const { rows: [stats] } = await db.query(
    `SELECT
      COUNT(*) as total_sends,
      COUNT(*) FILTER (WHERE status = 'sent') as successful_sends,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_sends,
      COUNT(*) FILTER (WHERE opened_at IS NOT NULL) as total_opens,
      COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) as total_clicks,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE opened_at IS NOT NULL) / NULLIF(COUNT(*), 0),
        2
      ) as open_rate,
      ROUND(
        100.0 * COUNT(*) FILTER (WHERE clicked_at IS NOT NULL) / NULLIF(COUNT(*), 0),
        2
      ) as click_rate
     FROM notification_campaign_logs
     WHERE campaign_id = $1`,
    [campaignId]
  );

  return stats;
}

// ============================================
// MARK EMAIL OPENED (for tracking)
// ============================================

async function markEmailOpened(campaignId, userId) {
  await db.query(
    `UPDATE notification_campaign_logs
     SET opened_at = NOW(),
         status = 'opened'
     WHERE campaign_id = $1
       AND user_id = $2
       AND opened_at IS NULL`,
    [campaignId, userId]
  );

  // Update campaign stats
  await db.query(
    `UPDATE notification_campaigns
     SET total_opened = total_opened + 1
     WHERE id = $1`,
    [campaignId]
  );
}

// ============================================
// MARK EMAIL CLICKED (for tracking)
// ============================================

async function markEmailClicked(campaignId, userId) {
  await db.query(
    `UPDATE notification_campaign_logs
     SET clicked_at = NOW(),
         status = 'clicked'
     WHERE campaign_id = $1
       AND user_id = $2
       AND clicked_at IS NULL`,
    [campaignId, userId]
  );

  // Update campaign stats
  await db.query(
    `UPDATE notification_campaigns
     SET total_clicked = total_clicked + 1
     WHERE id = $1`,
    [campaignId]
  );
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  runCampaigns,
  runSingleCampaign,
  getCampaignPreview,
  getCampaignStats,
  markEmailOpened,
  markEmailClicked,
};
