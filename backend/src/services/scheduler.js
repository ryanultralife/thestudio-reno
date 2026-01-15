// ============================================
// SCHEDULED JOBS
// Run automated tasks on intervals
// ============================================

const cron = require('node-cron');
const campaignsService = require('./campaigns');

// ============================================
// INITIALIZE SCHEDULER
// ============================================

function startScheduler() {
  console.log('[Scheduler] Starting scheduled jobs...');

  // Run campaigns every hour
  cron.schedule('0 * * * *', async () => {
    console.log('[Scheduler] Running hourly campaign check...');
    try {
      await campaignsService.runCampaigns();
    } catch (err) {
      console.error('[Scheduler] Error running campaigns:', err);
    }
  });

  console.log('[Scheduler] Scheduled jobs initialized');
  console.log('[Scheduler] - Campaigns: Every hour (0 * * * *)');
}

module.exports = { startScheduler };
