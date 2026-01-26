// ============================================
// MINDBODY BACKGROUND JOBS
// Scheduled sync and maintenance tasks
// ============================================

const db = require('../../database/connection');
const { SyncService } = require('../../services/mindbody');

/**
 * Check if MindBody sync is enabled
 */
async function isSyncEnabled() {
  try {
    const configResult = await db.query(`
      SELECT is_active, auto_sync_enabled FROM mindbody_config LIMIT 1
    `);

    if (!configResult.rows[0]) {
      return false;
    }

    return configResult.rows[0].is_active && configResult.rows[0].auto_sync_enabled;
  } catch (error) {
    // Table might not exist yet
    return false;
  }
}

/**
 * Run daily full sync
 * Syncs all data from MindBody to StudioFlow
 */
async function runDailySync() {
  console.log('[MindBody Jobs] Starting daily sync...');

  if (!await isSyncEnabled()) {
    console.log('[MindBody Jobs] Sync is disabled, skipping');
    return { skipped: true, reason: 'Sync disabled' };
  }

  try {
    const syncService = new SyncService();
    const result = await syncService.fullSync('scheduled');

    console.log('[MindBody Jobs] Daily sync completed:', result.stats);
    return result;
  } catch (error) {
    console.error('[MindBody Jobs] Daily sync failed:', error);
    throw error;
  }
}

/**
 * Run incremental sync
 * Only syncs classes and bookings for upcoming schedule
 */
async function runIncrementalSync() {
  console.log('[MindBody Jobs] Starting incremental sync...');

  if (!await isSyncEnabled()) {
    console.log('[MindBody Jobs] Sync is disabled, skipping');
    return { skipped: true, reason: 'Sync disabled' };
  }

  try {
    const syncService = new SyncService();
    const result = await syncService.incrementalSync('scheduled');

    console.log('[MindBody Jobs] Incremental sync completed:', result.stats);
    return result;
  } catch (error) {
    console.error('[MindBody Jobs] Incremental sync failed:', error);
    throw error;
  }
}

/**
 * Process sync queue
 * Handle queued sync operations from webhooks
 */
async function processSyncQueue() {
  console.log('[MindBody Jobs] Processing sync queue...');

  try {
    // Get pending queue items
    const pendingItems = await db.query(`
      SELECT * FROM mindbody_sync_queue
      WHERE status = 'pending' AND scheduled_for <= NOW()
      ORDER BY priority DESC, created_at ASC
      LIMIT 50
    `);

    if (pendingItems.rows.length === 0) {
      return { processed: 0 };
    }

    console.log(`[MindBody Jobs] Processing ${pendingItems.rows.length} queued items`);

    const syncService = new SyncService();
    let processed = 0;
    let failed = 0;

    for (const item of pendingItems.rows) {
      try {
        // Mark as processing
        await db.query(`
          UPDATE mindbody_sync_queue SET status = 'processing' WHERE id = $1
        `, [item.id]);

        // Process based on entity type
        switch (item.entity_type) {
          case 'client':
            await syncService.processClient(item.payload.Client || item.payload, {
              create_missing_users: true,
              update_existing: true,
            });
            break;
          case 'class':
            await syncService.processClass(item.payload.Class || item.payload, {
              create_missing_classes: true,
            });
            break;
          // Add more entity types as needed
        }

        // Mark as completed
        await db.query(`
          UPDATE mindbody_sync_queue
          SET status = 'completed', processed_at = NOW()
          WHERE id = $1
        `, [item.id]);

        processed++;
      } catch (error) {
        // Mark as failed
        await db.query(`
          UPDATE mindbody_sync_queue
          SET status = 'failed', last_error = $1, attempts = attempts + 1
          WHERE id = $2
        `, [error.message, item.id]);

        failed++;
      }
    }

    console.log(`[MindBody Jobs] Queue processed: ${processed} success, ${failed} failed`);
    return { processed, failed };
  } catch (error) {
    console.error('[MindBody Jobs] Queue processing failed:', error);
    throw error;
  }
}

/**
 * Retry failed webhook events
 */
async function retryFailedWebhooks() {
  console.log('[MindBody Jobs] Retrying failed webhooks...');

  try {
    const { WebhookHandler } = require('../../services/mindbody');
    const handler = new WebhookHandler();
    const result = await handler.retryFailedEvents();

    console.log(`[MindBody Jobs] Retried ${result.retried} webhook events`);
    return result;
  } catch (error) {
    console.error('[MindBody Jobs] Webhook retry failed:', error);
    throw error;
  }
}

/**
 * Cleanup old sync data
 * Remove old sync logs and processed queue items
 */
async function cleanupOldData() {
  console.log('[MindBody Jobs] Cleaning up old sync data...');

  try {
    // Delete sync logs older than 30 days
    const logsResult = await db.query(`
      DELETE FROM mindbody_sync_log
      WHERE started_at < NOW() - INTERVAL '30 days'
    `);

    // Delete processed queue items older than 7 days
    const queueResult = await db.query(`
      DELETE FROM mindbody_sync_queue
      WHERE status IN ('completed', 'failed') AND created_at < NOW() - INTERVAL '7 days'
    `);

    // Delete processed webhook events older than 14 days
    const webhookResult = await db.query(`
      DELETE FROM mindbody_webhook_events
      WHERE status = 'processed' AND received_at < NOW() - INTERVAL '14 days'
    `);

    console.log(`[MindBody Jobs] Cleanup complete:
      - Sync logs deleted: ${logsResult.rowCount}
      - Queue items deleted: ${queueResult.rowCount}
      - Webhook events deleted: ${webhookResult.rowCount}`
    );

    return {
      logsDeleted: logsResult.rowCount,
      queueItemsDeleted: queueResult.rowCount,
      webhookEventsDeleted: webhookResult.rowCount,
    };
  } catch (error) {
    console.error('[MindBody Jobs] Cleanup failed:', error);
    throw error;
  }
}

/**
 * Check sync health
 * Alert if sync hasn't run successfully recently
 */
async function checkSyncHealth() {
  console.log('[MindBody Jobs] Checking sync health...');

  try {
    // Check last successful sync
    const lastSync = await db.query(`
      SELECT * FROM mindbody_sync_log
      WHERE status = 'completed'
      ORDER BY completed_at DESC
      LIMIT 1
    `);

    if (!lastSync.rows[0]) {
      return { healthy: false, reason: 'No successful syncs found' };
    }

    const lastSyncTime = new Date(lastSync.rows[0].completed_at);
    const hoursSinceSync = (Date.now() - lastSyncTime.getTime()) / (1000 * 60 * 60);

    // Alert if no sync in last 48 hours
    if (hoursSinceSync > 48) {
      console.warn(`[MindBody Jobs] WARNING: No successful sync in ${Math.round(hoursSinceSync)} hours`);
      return {
        healthy: false,
        reason: `No sync in ${Math.round(hoursSinceSync)} hours`,
        lastSync: lastSyncTime,
      };
    }

    // Check error rate in recent syncs
    const recentSyncs = await db.query(`
      SELECT
        COUNT(*) FILTER (WHERE status = 'completed') as success,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM mindbody_sync_log
      WHERE started_at > NOW() - INTERVAL '7 days'
    `);

    const errorRate = recentSyncs.rows[0].failed / (recentSyncs.rows[0].success + recentSyncs.rows[0].failed);

    if (errorRate > 0.3) {
      console.warn(`[MindBody Jobs] WARNING: High sync error rate: ${Math.round(errorRate * 100)}%`);
      return {
        healthy: false,
        reason: `High error rate: ${Math.round(errorRate * 100)}%`,
        stats: recentSyncs.rows[0],
      };
    }

    console.log('[MindBody Jobs] Sync health OK');
    return {
      healthy: true,
      lastSync: lastSyncTime,
      hoursSinceSync: Math.round(hoursSinceSync),
      stats: recentSyncs.rows[0],
    };
  } catch (error) {
    console.error('[MindBody Jobs] Health check failed:', error);
    return { healthy: false, reason: error.message };
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  runDailySync,
  runIncrementalSync,
  processSyncQueue,
  retryFailedWebhooks,
  cleanupOldData,
  checkSyncHealth,
};
