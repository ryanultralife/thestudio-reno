// ============================================
// MARKETING BACKGROUND JOBS
// Scheduled campaign and automation tasks
// ============================================

const { CampaignService, AutomationService, SegmentationEngine } = require('../../services/marketing');

const campaignService = new CampaignService();
const automationService = new AutomationService();
const segmentEngine = new SegmentationEngine();

/**
 * Process scheduled campaigns
 * Run frequently to catch scheduled sends
 */
async function processScheduledCampaigns() {
  console.log('[Marketing Jobs] Processing scheduled campaigns...');

  try {
    const result = await campaignService.processScheduledCampaigns();
    console.log(`[Marketing Jobs] Processed ${result.processed} scheduled campaigns`);
    return result;
  } catch (error) {
    console.error('[Marketing Jobs] Error processing campaigns:', error.message);
    throw error;
  }
}

/**
 * Process automation steps
 * Executes pending automation steps for enrolled users
 */
async function processAutomationSteps() {
  console.log('[Marketing Jobs] Processing automation steps...');

  try {
    const result = await automationService.processAutomationSteps();
    console.log(`[Marketing Jobs] Processed ${result.processed} automation steps`);
    return result;
  } catch (error) {
    console.error('[Marketing Jobs] Error processing automations:', error.message);
    throw error;
  }
}

/**
 * Check trigger conditions
 * Evaluates time-based triggers (membership expiring, inactive users, etc.)
 */
async function checkTriggerConditions() {
  console.log('[Marketing Jobs] Checking automation trigger conditions...');

  try {
    await automationService.checkTriggerConditions();
    console.log('[Marketing Jobs] Trigger conditions checked');
    return { success: true };
  } catch (error) {
    console.error('[Marketing Jobs] Error checking triggers:', error.message);
    throw error;
  }
}

/**
 * Update segment counts
 * Recalculates member counts for all segments
 */
async function updateSegmentCounts() {
  console.log('[Marketing Jobs] Updating segment counts...');

  try {
    await segmentEngine.updateSegmentCounts();
    console.log('[Marketing Jobs] Segment counts updated');
    return { success: true };
  } catch (error) {
    console.error('[Marketing Jobs] Error updating segments:', error.message);
    throw error;
  }
}

/**
 * Send daily digest
 * Summary of marketing activity to admins
 */
async function sendDailyDigest() {
  console.log('[Marketing Jobs] Sending daily marketing digest...');

  const db = require('../../database/connection');
  const { sendEmail } = require('../../services/notifications');

  try {
    // Get yesterday's stats
    const campaignStats = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'sent') as campaigns_sent,
        SUM(total_sent) as emails_sent,
        SUM(total_opened) as emails_opened,
        SUM(total_clicked) as emails_clicked
      FROM marketing_campaigns
      WHERE sent_at >= NOW() - INTERVAL '24 hours'
    `);

    const automationStats = await db.query(`
      SELECT
        COUNT(*) as enrollments,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
      FROM marketing_automation_enrollments
      WHERE enrolled_at >= NOW() - INTERVAL '24 hours'
    `);

    const unsubscribes = await db.query(`
      SELECT COUNT(*) FROM marketing_preferences
      WHERE unsubscribed_at >= NOW() - INTERVAL '24 hours'
    `);

    // Only send if there's activity
    const stats = campaignStats.rows[0];
    const autoStats = automationStats.rows[0];

    if (parseInt(stats.emails_sent || 0) > 0 || parseInt(autoStats.enrollments || 0) > 0) {
      const html = `
        <h2>Daily Marketing Report</h2>
        <p>Here's what happened in the last 24 hours:</p>

        <h3>Campaigns</h3>
        <ul>
          <li>Campaigns sent: ${stats.campaigns_sent || 0}</li>
          <li>Emails delivered: ${stats.emails_sent || 0}</li>
          <li>Opens: ${stats.emails_opened || 0} (${stats.emails_sent > 0 ? Math.round((stats.emails_opened / stats.emails_sent) * 100) : 0}%)</li>
          <li>Clicks: ${stats.emails_clicked || 0}</li>
        </ul>

        <h3>Automations</h3>
        <ul>
          <li>New enrollments: ${autoStats.enrollments || 0}</li>
          <li>Completed: ${autoStats.completed || 0}</li>
        </ul>

        <h3>Unsubscribes</h3>
        <p>${unsubscribes.rows[0].count || 0} users unsubscribed</p>
      `;

      // Get admin emails
      const admins = await db.query(`
        SELECT email FROM users WHERE role IN ('admin', 'owner') AND is_active = true
      `);

      for (const admin of admins.rows) {
        await sendEmail(admin.email, 'Daily Marketing Report', html);
      }
    }

    console.log('[Marketing Jobs] Daily digest sent');
    return { success: true };
  } catch (error) {
    console.error('[Marketing Jobs] Error sending digest:', error.message);
    throw error;
  }
}

/**
 * Cleanup old data
 * Remove old sends, logs, and tracking data
 */
async function cleanupOldData() {
  console.log('[Marketing Jobs] Cleaning up old marketing data...');

  const db = require('../../database/connection');

  try {
    // Delete campaign sends older than 90 days
    const sendsResult = await db.query(`
      DELETE FROM marketing_campaign_sends
      WHERE created_at < NOW() - INTERVAL '90 days'
    `);

    // Delete click tracking older than 90 days
    const clicksResult = await db.query(`
      DELETE FROM marketing_click_tracking
      WHERE clicked_at < NOW() - INTERVAL '90 days'
    `);

    // Delete automation logs older than 30 days
    const logsResult = await db.query(`
      DELETE FROM marketing_automation_log
      WHERE executed_at < NOW() - INTERVAL '30 days'
    `);

    // Delete completed enrollments older than 30 days
    const enrollmentsResult = await db.query(`
      DELETE FROM marketing_automation_enrollments
      WHERE status = 'completed' AND completed_at < NOW() - INTERVAL '30 days'
    `);

    console.log(`[Marketing Jobs] Cleanup complete:
      - Campaign sends deleted: ${sendsResult.rowCount}
      - Click tracking deleted: ${clicksResult.rowCount}
      - Automation logs deleted: ${logsResult.rowCount}
      - Enrollments deleted: ${enrollmentsResult.rowCount}`
    );

    return {
      sendsDeleted: sendsResult.rowCount,
      clicksDeleted: clicksResult.rowCount,
      logsDeleted: logsResult.rowCount,
      enrollmentsDeleted: enrollmentsResult.rowCount,
    };
  } catch (error) {
    console.error('[Marketing Jobs] Cleanup error:', error.message);
    throw error;
  }
}

module.exports = {
  processScheduledCampaigns,
  processAutomationSteps,
  checkTriggerConditions,
  updateSegmentCounts,
  sendDailyDigest,
  cleanupOldData,
};
