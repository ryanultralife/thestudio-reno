// ============================================
// MINDBODY API ROUTES
// Configuration, sync management, and webhooks
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');
const { getClient, SyncService, WebhookHandler } = require('../services/mindbody');

// ============================================
// CONFIGURATION ROUTES
// ============================================

/**
 * GET /api/mindbody/config
 * Get MindBody configuration (admin only)
 */
router.get('/config', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        id, site_id, site_name, auto_sync_enabled, sync_interval_minutes,
        last_full_sync, is_active, created_at, updated_at,
        staff_username IS NOT NULL as has_staff_credentials,
        user_token IS NOT NULL as has_user_token,
        user_token_expires_at
      FROM mindbody_config
      LIMIT 1
    `);

    // Also get MindBody settings from main settings table
    const settingsResult = await db.query(
      "SELECT value FROM settings WHERE key = 'mindbody'"
    );

    res.json({
      config: result.rows[0] || null,
      settings: settingsResult.rows[0]?.value || {},
    });
  } catch (error) {
    console.error('Error fetching MindBody config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mindbody/config
 * Create or update MindBody configuration
 */
router.post('/config', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const {
      siteId,
      siteName,
      apiKey,
      staffUsername,
      staffPassword,
      autoSyncEnabled,
      syncIntervalMinutes,
    } = req.body;

    if (!siteId || !apiKey) {
      return res.status(400).json({ error: 'Site ID and API Key are required' });
    }

    // Upsert config
    const result = await db.query(`
      INSERT INTO mindbody_config (
        site_id, site_name, api_key, staff_username, staff_password_encrypted,
        auto_sync_enabled, sync_interval_minutes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (site_id) DO UPDATE SET
        site_name = EXCLUDED.site_name,
        api_key = EXCLUDED.api_key,
        staff_username = COALESCE(EXCLUDED.staff_username, mindbody_config.staff_username),
        staff_password_encrypted = CASE
          WHEN EXCLUDED.staff_password_encrypted IS NOT NULL
          THEN EXCLUDED.staff_password_encrypted
          ELSE mindbody_config.staff_password_encrypted
        END,
        auto_sync_enabled = EXCLUDED.auto_sync_enabled,
        sync_interval_minutes = EXCLUDED.sync_interval_minutes,
        updated_at = NOW()
      RETURNING id, site_id, site_name, auto_sync_enabled
    `, [
      siteId,
      siteName,
      apiKey,
      staffUsername,
      staffPassword, // Note: In production, encrypt this
      autoSyncEnabled ?? true,
      syncIntervalMinutes ?? 1440, // Default to daily (1440 minutes)
    ]);

    res.json({ success: true, config: result.rows[0] });
  } catch (error) {
    console.error('Error saving MindBody config:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mindbody/config/test
 * Test MindBody API connection
 */
router.post('/config/test', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const client = getClient({
      apiKey: req.body.apiKey || process.env.MINDBODY_API_KEY,
      siteId: req.body.siteId || process.env.MINDBODY_SITE_ID,
    });

    const result = await client.testConnection();

    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/mindbody/settings
 * Update MindBody sync settings
 */
router.put('/settings', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { settings } = req.body;

    await db.query(`
      UPDATE settings SET value = $1, updated_at = NOW()
      WHERE key = 'mindbody'
    `, [settings]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating MindBody settings:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SYNC STATUS & HISTORY
// ============================================

/**
 * GET /api/mindbody/status
 * Get sync status overview
 */
router.get('/status', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const status = await db.query('SELECT * FROM mindbody_sync_status LIMIT 1');

    // Get recent sync logs
    const logs = await db.query(`
      SELECT * FROM mindbody_sync_log
      ORDER BY started_at DESC
      LIMIT 10
    `);

    // Get entity counts
    const counts = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM mindbody_client_map) as clients,
        (SELECT COUNT(*) FROM mindbody_staff_map) as staff,
        (SELECT COUNT(*) FROM mindbody_class_map) as classes,
        (SELECT COUNT(*) FROM mindbody_class_type_map) as class_types,
        (SELECT COUNT(*) FROM mindbody_booking_map) as bookings,
        (SELECT COUNT(*) FROM mindbody_location_map) as locations,
        (SELECT COUNT(*) FROM mindbody_client_map WHERE studioflow_user_id IS NOT NULL) as clients_mapped,
        (SELECT COUNT(*) FROM mindbody_staff_map WHERE studioflow_teacher_id IS NOT NULL) as staff_mapped,
        (SELECT COUNT(*) FROM mindbody_class_map WHERE studioflow_class_id IS NOT NULL) as classes_mapped
    `);

    res.json({
      status: status.rows[0] || null,
      recentSyncs: logs.rows,
      counts: counts.rows[0],
    });
  } catch (error) {
    console.error('Error fetching MindBody status:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mindbody/logs
 * Get sync log history
 */
router.get('/logs', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;

    let query = `
      SELECT * FROM mindbody_sync_log
      ${type ? 'WHERE sync_type = $3' : ''}
      ORDER BY started_at DESC
      LIMIT $1 OFFSET $2
    `;
    const params = type ? [limit, offset, type] : [limit, offset];

    const result = await db.query(query, params);

    res.json({ logs: result.rows });
  } catch (error) {
    console.error('Error fetching sync logs:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// SYNC ACTIONS
// ============================================

/**
 * POST /api/mindbody/sync/full
 * Trigger a full sync
 */
router.post('/sync/full', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const syncService = new SyncService();

    // Run sync in background
    syncService.fullSync('manual', req.user.id)
      .then(result => {
        console.log('[MindBody] Full sync completed:', result);
      })
      .catch(error => {
        console.error('[MindBody] Full sync failed:', error);
      });

    res.json({
      success: true,
      message: 'Full sync started',
      status: 'running',
    });
  } catch (error) {
    console.error('Error starting full sync:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mindbody/sync/incremental
 * Trigger an incremental sync (classes and bookings only)
 */
router.post('/sync/incremental', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const syncService = new SyncService();

    syncService.incrementalSync('manual', req.user.id)
      .then(result => {
        console.log('[MindBody] Incremental sync completed:', result);
      })
      .catch(error => {
        console.error('[MindBody] Incremental sync failed:', error);
      });

    res.json({
      success: true,
      message: 'Incremental sync started',
      status: 'running',
    });
  } catch (error) {
    console.error('Error starting incremental sync:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mindbody/sync/:type
 * Trigger sync for specific entity type
 */
router.post('/sync/:type', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { type } = req.params;
    const validTypes = ['locations', 'staff', 'classTypes', 'clients', 'classes', 'bookings'];

    if (!validTypes.includes(type)) {
      return res.status(400).json({ error: `Invalid sync type. Valid types: ${validTypes.join(', ')}` });
    }

    const syncService = new SyncService();
    await syncService.startSyncLog(type, 'manual', req.user.id);

    const methodMap = {
      locations: 'syncLocations',
      staff: 'syncStaff',
      classTypes: 'syncClassTypes',
      clients: 'syncClients',
      classes: 'syncClasses',
      bookings: 'syncBookings',
    };

    // Run in background
    syncService[methodMap[type]]()
      .then(async () => {
        await syncService.completeSyncLog('completed');
      })
      .catch(async (error) => {
        await syncService.completeSyncLog('failed');
        console.error(`[MindBody] ${type} sync failed:`, error);
      });

    res.json({
      success: true,
      message: `${type} sync started`,
      status: 'running',
    });
  } catch (error) {
    console.error('Error starting sync:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// MAPPING MANAGEMENT
// ============================================

/**
 * GET /api/mindbody/mappings/:type
 * Get entity mappings
 */
router.get('/mappings/:type', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const { type } = req.params;
    const { unmappedOnly, limit = 100, offset = 0 } = req.query;

    const tableMap = {
      clients: 'mindbody_client_map',
      staff: 'mindbody_staff_map',
      classes: 'mindbody_class_map',
      classTypes: 'mindbody_class_type_map',
      locations: 'mindbody_location_map',
      bookings: 'mindbody_booking_map',
      memberships: 'mindbody_membership_map',
    };

    const table = tableMap[type];
    if (!table) {
      return res.status(400).json({ error: 'Invalid mapping type' });
    }

    const sfIdColumn = {
      clients: 'studioflow_user_id',
      staff: 'studioflow_teacher_id',
      classes: 'studioflow_class_id',
      classTypes: 'studioflow_class_type_id',
      locations: 'studioflow_location_id',
      bookings: 'studioflow_booking_id',
      memberships: 'studioflow_user_membership_id',
    }[type];

    let query = `SELECT * FROM ${table}`;
    const params = [limit, offset];

    if (unmappedOnly === 'true') {
      query += ` WHERE ${sfIdColumn} IS NULL`;
    }

    query += ` ORDER BY last_synced_at DESC LIMIT $1 OFFSET $2`;

    const result = await db.query(query, params);

    // Get total count
    const countQuery = unmappedOnly === 'true'
      ? `SELECT COUNT(*) FROM ${table} WHERE ${sfIdColumn} IS NULL`
      : `SELECT COUNT(*) FROM ${table}`;
    const countResult = await db.query(countQuery);

    res.json({
      mappings: result.rows,
      total: parseInt(countResult.rows[0].count),
    });
  } catch (error) {
    console.error('Error fetching mappings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/mindbody/mappings/:type/:id
 * Manually update a mapping
 */
router.put('/mappings/:type/:id', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const { type, id } = req.params;
    const { studioflowId } = req.body;

    const tableMap = {
      clients: { table: 'mindbody_client_map', column: 'studioflow_user_id' },
      staff: { table: 'mindbody_staff_map', column: 'studioflow_teacher_id' },
      classes: { table: 'mindbody_class_map', column: 'studioflow_class_id' },
      classTypes: { table: 'mindbody_class_type_map', column: 'studioflow_class_type_id' },
      locations: { table: 'mindbody_location_map', column: 'studioflow_location_id' },
    };

    const mapping = tableMap[type];
    if (!mapping) {
      return res.status(400).json({ error: 'Invalid mapping type' });
    }

    await db.query(`
      UPDATE ${mapping.table}
      SET ${mapping.column} = $1, updated_at = NOW()
      WHERE id = $2
    `, [studioflowId || null, id]);

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating mapping:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// WEBHOOK ENDPOINT
// ============================================

/**
 * POST /api/mindbody/webhook
 * Receive MindBody webhook events
 */
router.post('/webhook', express.json(), async (req, res) => {
  try {
    const signature = req.headers['x-mindbody-signature'];
    const handler = new WebhookHandler();

    // Verify signature if secret is configured
    if (process.env.MINDBODY_WEBHOOK_SECRET && !handler.verifySignature(req.body, signature)) {
      console.warn('[MindBody Webhook] Invalid signature');
      return res.status(401).json({ error: 'Invalid signature' });
    }

    const eventType = req.body.eventType || req.body.EventType || req.headers['x-mindbody-event-type'];

    if (!eventType) {
      return res.status(400).json({ error: 'Missing event type' });
    }

    // Acknowledge immediately (MindBody expects quick response)
    res.status(200).json({ received: true });

    // Process webhook asynchronously
    handler.processWebhook(eventType, req.body)
      .catch(error => {
        console.error('[MindBody Webhook] Processing error:', error);
      });
  } catch (error) {
    console.error('[MindBody Webhook] Error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mindbody/webhook/events
 * Get recent webhook events
 */
router.get('/webhook/events', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const { limit = 50, status } = req.query;

    let query = 'SELECT * FROM mindbody_webhook_events';
    const params = [limit];

    if (status) {
      query += ' WHERE status = $2';
      params.push(status);
    }

    query += ' ORDER BY received_at DESC LIMIT $1';

    const result = await db.query(query, params);

    res.json({ events: result.rows });
  } catch (error) {
    console.error('Error fetching webhook events:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/mindbody/webhook/retry
 * Retry failed webhook events
 */
router.post('/webhook/retry', authenticate, requirePermission('settings.edit'), async (req, res) => {
  try {
    const handler = new WebhookHandler();
    const result = await handler.retryFailedEvents();

    res.json(result);
  } catch (error) {
    console.error('Error retrying webhooks:', error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================
// DATA PREVIEW / EXPLORATION
// ============================================

/**
 * GET /api/mindbody/preview/classes
 * Preview classes from MindBody API (without syncing)
 */
router.get('/preview/classes', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;

    const client = getClient();
    const response = await client.getClasses({
      startDateTime: startDate ? new Date(startDate) : new Date(),
      endDateTime: endDate ? new Date(endDate) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      limit: parseInt(limit),
    });

    res.json({ classes: response.Classes || [] });
  } catch (error) {
    console.error('Error previewing classes:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mindbody/preview/clients
 * Preview clients from MindBody API
 */
router.get('/preview/clients', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const { search, limit = 20 } = req.query;

    const client = getClient();
    const response = await client.getClients({
      searchText: search,
      limit: parseInt(limit),
    });

    res.json({ clients: response.Clients || [] });
  } catch (error) {
    console.error('Error previewing clients:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mindbody/preview/staff
 * Preview staff from MindBody API
 */
router.get('/preview/staff', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const client = getClient();
    const response = await client.getStaff();

    res.json({ staff: response.StaffMembers || [] });
  } catch (error) {
    console.error('Error previewing staff:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/mindbody/preview/services
 * Preview services/memberships from MindBody API
 */
router.get('/preview/services', authenticate, requirePermission('settings.view'), async (req, res) => {
  try {
    const client = getClient();
    const response = await client.getServices();

    res.json({ services: response.Services || [] });
  } catch (error) {
    console.error('Error previewing services:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
