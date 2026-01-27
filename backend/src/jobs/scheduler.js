// ============================================
// JOB SCHEDULER
// Schedules and runs background jobs
// ============================================

const cron = require('node-cron');
const coopJobs = require('./coop');
const mindbodyJobs = require('./mindbody');
const marketingJobs = require('./marketing');

// Track scheduled jobs
const scheduledJobs = new Map();

// ============================================
// SCHEDULE DEFINITIONS
// ============================================

const jobSchedules = {
  // Monthly credits allocation - 1st of month at 00:01
  'coop:allocate-monthly-credits': {
    schedule: '1 0 1 * *',
    handler: coopJobs.runMonthlyCreditsAllocation,
    description: 'Allocate monthly co-op credits to members',
  },

  // Expire unused credits - Daily at 00:05
  'coop:expire-unused-credits': {
    schedule: '5 0 * * *',
    handler: coopJobs.runExpireUnusedCredits,
    description: 'Expire unused co-op credits',
  },

  // Weekly payouts - Monday at 06:00
  'coop:process-weekly-payouts': {
    schedule: '0 6 * * 1',
    handler: coopJobs.runWeeklyPayouts,
    description: 'Process weekly teacher payouts',
  },

  // Check expiring insurance - Daily at 09:00
  'coop:check-expiring-insurance': {
    schedule: '0 9 * * *',
    handler: coopJobs.runExpiringInsuranceCheck,
    description: 'Check for expiring teacher insurance',
  },

  // Finalize completed classes - Every hour at :15
  'coop:finalize-completed-classes': {
    schedule: '15 * * * *',
    handler: coopJobs.runFinalizeCompletedClasses,
    description: 'Finalize completed co-op classes',
  },

  // Send class reminders - Daily at 18:00
  'coop:send-class-reminders': {
    schedule: '0 18 * * *',
    handler: coopJobs.runCoopClassReminders,
    description: 'Send reminders for tomorrow\'s co-op classes',
  },

  // ============================================
  // MINDBODY SYNC JOBS
  // ============================================

  // Daily full sync - Run at 3:00 AM (low-traffic time)
  'mindbody:daily-sync': {
    schedule: '0 3 * * *',
    handler: mindbodyJobs.runDailySync,
    description: 'Full MindBody data sync (classes, clients, bookings)',
  },

  // Incremental sync - Run every 4 hours for schedule updates
  'mindbody:incremental-sync': {
    schedule: '0 */4 * * *',
    handler: mindbodyJobs.runIncrementalSync,
    description: 'Incremental sync of classes and bookings',
  },

  // Process sync queue - Every 5 minutes
  'mindbody:process-queue': {
    schedule: '*/5 * * * *',
    handler: mindbodyJobs.processSyncQueue,
    description: 'Process queued sync items from webhooks',
  },

  // Retry failed webhooks - Every hour at :30
  'mindbody:retry-webhooks': {
    schedule: '30 * * * *',
    handler: mindbodyJobs.retryFailedWebhooks,
    description: 'Retry failed webhook event processing',
  },

  // Cleanup old data - Weekly on Sunday at 2:00 AM
  'mindbody:cleanup': {
    schedule: '0 2 * * 0',
    handler: mindbodyJobs.cleanupOldData,
    description: 'Clean up old sync logs and processed queue items',
  },

  // Health check - Daily at 10:00 AM
  'mindbody:health-check': {
    schedule: '0 10 * * *',
    handler: mindbodyJobs.checkSyncHealth,
    description: 'Check MindBody sync health and alert if issues',
  },

  // ============================================
  // MARKETING AUTOMATION JOBS
  // ============================================

  // Process scheduled campaigns - Every 5 minutes
  'marketing:process-campaigns': {
    schedule: '*/5 * * * *',
    handler: marketingJobs.processScheduledCampaigns,
    description: 'Send scheduled email campaigns',
  },

  // Process automation steps - Every 5 minutes
  'marketing:process-automations': {
    schedule: '*/5 * * * *',
    handler: marketingJobs.processAutomationSteps,
    description: 'Execute pending automation steps',
  },

  // Check trigger conditions - Daily at 8:00 AM
  'marketing:check-triggers': {
    schedule: '0 8 * * *',
    handler: marketingJobs.checkTriggerConditions,
    description: 'Check time-based automation triggers (expiring memberships, inactive users)',
  },

  // Update segment counts - Daily at 4:00 AM
  'marketing:update-segments': {
    schedule: '0 4 * * *',
    handler: marketingJobs.updateSegmentCounts,
    description: 'Recalculate segment member counts',
  },

  // Send daily digest - Daily at 9:00 AM
  'marketing:daily-digest': {
    schedule: '0 9 * * *',
    handler: marketingJobs.sendDailyDigest,
    description: 'Send marketing activity summary to admins',
  },

  // Cleanup old data - Weekly on Sunday at 3:00 AM
  'marketing:cleanup': {
    schedule: '0 3 * * 0',
    handler: marketingJobs.cleanupOldData,
    description: 'Clean up old campaign sends and tracking data',
  },
};

// ============================================
// SCHEDULER FUNCTIONS
// ============================================

/**
 * Start all scheduled jobs
 */
function startScheduler() {
  console.log('[Scheduler] Starting job scheduler...');

  for (const [jobName, config] of Object.entries(jobSchedules)) {
    if (!cron.validate(config.schedule)) {
      console.error(`[Scheduler] Invalid cron expression for ${jobName}: ${config.schedule}`);
      continue;
    }

    const job = cron.schedule(config.schedule, async () => {
      console.log(`[Scheduler] Running job: ${jobName}`);
      const startTime = Date.now();

      try {
        const result = await config.handler();
        const duration = Date.now() - startTime;
        console.log(`[Scheduler] Job ${jobName} completed in ${duration}ms`);

        // Log job execution
        await logJobExecution(jobName, 'success', duration, result);
      } catch (error) {
        const duration = Date.now() - startTime;
        console.error(`[Scheduler] Job ${jobName} failed:`, error);

        // Log job failure
        await logJobExecution(jobName, 'failed', duration, null, error.message);
      }
    }, {
      timezone: process.env.TZ || 'America/Los_Angeles',
    });

    scheduledJobs.set(jobName, job);
    console.log(`[Scheduler] Scheduled: ${jobName} (${config.schedule}) - ${config.description}`);
  }

  console.log(`[Scheduler] ${scheduledJobs.size} jobs scheduled`);
}

/**
 * Stop all scheduled jobs
 */
function stopScheduler() {
  console.log('[Scheduler] Stopping job scheduler...');

  for (const [jobName, job] of scheduledJobs) {
    job.stop();
    console.log(`[Scheduler] Stopped: ${jobName}`);
  }

  scheduledJobs.clear();
  console.log('[Scheduler] All jobs stopped');
}

/**
 * Run a specific job manually
 * @param {string} jobName - Name of the job to run
 */
async function runJobManually(jobName) {
  const config = jobSchedules[jobName];

  if (!config) {
    throw new Error(`Unknown job: ${jobName}`);
  }

  console.log(`[Scheduler] Manually running job: ${jobName}`);
  const startTime = Date.now();

  try {
    const result = await config.handler();
    const duration = Date.now() - startTime;
    console.log(`[Scheduler] Job ${jobName} completed manually in ${duration}ms`);

    await logJobExecution(jobName, 'success', duration, result, null, true);
    return result;
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`[Scheduler] Job ${jobName} failed:`, error);

    await logJobExecution(jobName, 'failed', duration, null, error.message, true);
    throw error;
  }
}

/**
 * Get status of all scheduled jobs
 */
function getSchedulerStatus() {
  const status = [];

  for (const [jobName, config] of Object.entries(jobSchedules)) {
    const job = scheduledJobs.get(jobName);
    status.push({
      name: jobName,
      description: config.description,
      schedule: config.schedule,
      running: job ? job.options.scheduled : false,
    });
  }

  return status;
}

/**
 * Log job execution to database
 */
async function logJobExecution(jobName, status, durationMs, result = null, errorMessage = null, manual = false) {
  try {
    const db = require('../database/connection');
    await db.query(`
      INSERT INTO job_logs (job_name, status, duration_ms, result, error_message, is_manual, executed_at)
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [jobName, status, durationMs, result ? JSON.stringify(result) : null, errorMessage, manual]);
  } catch (error) {
    // Table might not exist yet - just log to console
    console.warn('[Scheduler] Could not log job execution to database:', error.message);
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  startScheduler,
  stopScheduler,
  runJobManually,
  getSchedulerStatus,
  jobSchedules,
};
