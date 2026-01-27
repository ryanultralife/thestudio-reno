// ============================================
// MINDBODY WEBHOOK HANDLER
// Process real-time events from MindBody
// ============================================

const db = require('../../database/connection');
const { SyncService } = require('./sync');
const crypto = require('crypto');

/**
 * MindBody Webhook Event Types:
 * - classSchedule.created
 * - classSchedule.updated
 * - classSchedule.cancelled
 * - client.created
 * - client.updated
 * - client.deactivated
 * - clientVisit.created (booking)
 * - clientVisit.updated
 * - clientVisit.cancelled
 * - appointment.booked
 * - appointment.cancelled
 * - sale.completed
 * - clientMembership.created
 * - clientMembership.updated
 */

class WebhookHandler {
  constructor(siteId) {
    this.siteId = siteId || process.env.MINDBODY_SITE_ID;
    this.syncService = new SyncService(this.siteId);
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload, signature) {
    const secret = process.env.MINDBODY_WEBHOOK_SECRET;
    if (!secret) {
      console.warn('[MindBody Webhook] No webhook secret configured, skipping verification');
      return true;
    }

    const hmac = crypto.createHmac('sha256', secret);
    const expectedSignature = hmac.update(JSON.stringify(payload)).digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature || ''),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Store incoming webhook event
   */
  async storeEvent(eventType, payload, eventId = null) {
    const result = await db.query(`
      INSERT INTO mindbody_webhook_events (event_id, event_type, site_id, payload)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [
      eventId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventType,
      this.siteId,
      payload,
    ]);

    return result.rows[0].id;
  }

  /**
   * Main webhook processing entry point
   */
  async processWebhook(eventType, payload) {
    console.log(`[MindBody Webhook] Received event: ${eventType}`);

    const eventId = await this.storeEvent(eventType, payload);

    try {
      // Mark as processing
      await db.query(`
        UPDATE mindbody_webhook_events SET status = 'processing' WHERE id = $1
      `, [eventId]);

      // Route to appropriate handler
      let result;
      switch (eventType) {
        // Class events
        case 'classSchedule.created':
        case 'classSchedule.updated':
          result = await this.handleClassEvent(payload);
          break;
        case 'classSchedule.cancelled':
          result = await this.handleClassCancelled(payload);
          break;

        // Client events
        case 'client.created':
        case 'client.updated':
          result = await this.handleClientEvent(payload);
          break;
        case 'client.deactivated':
          result = await this.handleClientDeactivated(payload);
          break;

        // Booking events
        case 'clientVisit.created':
          result = await this.handleBookingCreated(payload);
          break;
        case 'clientVisit.updated':
          result = await this.handleBookingUpdated(payload);
          break;
        case 'clientVisit.cancelled':
          result = await this.handleBookingCancelled(payload);
          break;

        // Membership events
        case 'clientMembership.created':
        case 'clientMembership.updated':
          result = await this.handleMembershipEvent(payload);
          break;

        // Sale events
        case 'sale.completed':
          result = await this.handleSaleCompleted(payload);
          break;

        default:
          console.log(`[MindBody Webhook] Unhandled event type: ${eventType}`);
          result = { handled: false, reason: 'Unhandled event type' };
      }

      // Mark as processed
      await db.query(`
        UPDATE mindbody_webhook_events
        SET status = 'processed', processed_at = NOW()
        WHERE id = $1
      `, [eventId]);

      return result;
    } catch (error) {
      console.error(`[MindBody Webhook] Error processing ${eventType}:`, error.message);

      // Mark as failed
      await db.query(`
        UPDATE mindbody_webhook_events
        SET status = 'failed', error = $1, retry_count = retry_count + 1
        WHERE id = $2
      `, [error.message, eventId]);

      throw error;
    }
  }

  // ============================================
  // CLASS EVENT HANDLERS
  // ============================================

  async handleClassEvent(payload) {
    const mbClass = payload.Class || payload;

    // Queue for sync processing
    await db.query(`
      INSERT INTO mindbody_sync_queue (site_id, entity_type, entity_id, action, payload)
      VALUES ($1, 'class', $2, 'sync', $3)
      ON CONFLICT DO NOTHING
    `, [this.siteId, mbClass.Id?.toString(), payload]);

    // Process immediately if the class is within our sync window
    const startDateTime = new Date(mbClass.StartDateTime);
    const now = new Date();
    const twoWeeksFromNow = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

    if (startDateTime >= now && startDateTime <= twoWeeksFromNow) {
      await this.syncService.processClass(mbClass, { create_missing_classes: true });
    }

    return { handled: true, classId: mbClass.Id };
  }

  async handleClassCancelled(payload) {
    const mbClass = payload.Class || payload;
    const mbClassId = mbClass.Id?.toString();

    // Update mapping
    await db.query(`
      UPDATE mindbody_class_map
      SET mb_is_cancelled = true, last_synced_at = NOW()
      WHERE mindbody_site_id = $1 AND mindbody_class_id = $2
    `, [this.siteId, mbClassId]);

    // Get StudioFlow class ID
    const mapResult = await db.query(`
      SELECT studioflow_class_id FROM mindbody_class_map
      WHERE mindbody_site_id = $1 AND mindbody_class_id = $2
    `, [this.siteId, mbClassId]);

    if (mapResult.rows[0]?.studioflow_class_id) {
      // Cancel the StudioFlow class
      await db.query(`
        UPDATE classes
        SET is_cancelled = true, cancellation_reason = 'Cancelled in MindBody', cancelled_at = NOW()
        WHERE id = $1
      `, [mapResult.rows[0].studioflow_class_id]);

      // Cancel all bookings for this class
      await db.query(`
        UPDATE bookings
        SET status = 'cancelled', cancelled_at = NOW()
        WHERE class_id = $1 AND status = 'booked'
      `, [mapResult.rows[0].studioflow_class_id]);
    }

    return { handled: true, cancelled: true };
  }

  // ============================================
  // CLIENT EVENT HANDLERS
  // ============================================

  async handleClientEvent(payload) {
    const mbClient = payload.Client || payload;

    // Queue for sync
    await db.query(`
      INSERT INTO mindbody_sync_queue (site_id, entity_type, entity_id, action, payload)
      VALUES ($1, 'client', $2, 'sync', $3)
      ON CONFLICT DO NOTHING
    `, [this.siteId, mbClient.Id?.toString(), payload]);

    // Process immediately
    await this.syncService.processClient(mbClient, {
      create_missing_users: true,
      update_existing: true,
    });

    return { handled: true, clientId: mbClient.Id };
  }

  async handleClientDeactivated(payload) {
    const mbClient = payload.Client || payload;
    const mbClientId = mbClient.Id?.toString();

    // Update mapping
    await db.query(`
      UPDATE mindbody_client_map
      SET sync_status = 'inactive', last_synced_at = NOW()
      WHERE mindbody_site_id = $1 AND mindbody_client_id = $2
    `, [this.siteId, mbClientId]);

    // Optionally deactivate StudioFlow user
    const mapResult = await db.query(`
      SELECT studioflow_user_id FROM mindbody_client_map
      WHERE mindbody_site_id = $1 AND mindbody_client_id = $2
    `, [this.siteId, mbClientId]);

    // Note: We don't automatically deactivate users, just update the mapping status

    return { handled: true, deactivated: true };
  }

  // ============================================
  // BOOKING EVENT HANDLERS
  // ============================================

  async handleBookingCreated(payload) {
    const visit = payload.Visit || payload;

    // Get class and client mappings
    const classMap = await db.query(`
      SELECT studioflow_class_id FROM mindbody_class_map
      WHERE mindbody_site_id = $1 AND mindbody_class_id = $2
    `, [this.siteId, visit.ClassId?.toString()]);

    const clientMap = await db.query(`
      SELECT studioflow_user_id FROM mindbody_client_map
      WHERE mindbody_site_id = $1 AND mindbody_client_id = $2
    `, [this.siteId, visit.ClientId?.toString()]);

    const sfClassId = classMap.rows[0]?.studioflow_class_id;
    const sfUserId = clientMap.rows[0]?.studioflow_user_id;

    let sfBookingId = null;

    if (sfClassId && sfUserId) {
      // Create booking in StudioFlow
      const result = await db.query(`
        INSERT INTO bookings (user_id, class_id, status, booking_source)
        VALUES ($1, $2, 'booked', 'mindbody')
        ON CONFLICT (user_id, class_id) DO UPDATE SET updated_at = NOW()
        RETURNING id
      `, [sfUserId, sfClassId]);
      sfBookingId = result.rows[0].id;
    }

    // Create booking mapping
    await db.query(`
      INSERT INTO mindbody_booking_map (
        mindbody_site_id, mindbody_visit_id, studioflow_booking_id,
        mb_class_id, mb_client_id, mb_signed_in
      ) VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (mindbody_site_id, mindbody_visit_id) DO UPDATE SET
        studioflow_booking_id = COALESCE(mindbody_booking_map.studioflow_booking_id, EXCLUDED.studioflow_booking_id),
        last_synced_at = NOW()
    `, [
      this.siteId,
      visit.Id?.toString(),
      sfBookingId,
      visit.ClassId?.toString(),
      visit.ClientId?.toString(),
      visit.SignedIn || false,
    ]);

    return { handled: true, bookingId: sfBookingId };
  }

  async handleBookingUpdated(payload) {
    const visit = payload.Visit || payload;
    const mbVisitId = visit.Id?.toString();

    // Get existing mapping
    const mapResult = await db.query(`
      SELECT studioflow_booking_id FROM mindbody_booking_map
      WHERE mindbody_site_id = $1 AND mindbody_visit_id = $2
    `, [this.siteId, mbVisitId]);

    const sfBookingId = mapResult.rows[0]?.studioflow_booking_id;

    if (sfBookingId) {
      // Update StudioFlow booking status based on SignedIn
      if (visit.SignedIn) {
        await db.query(`
          UPDATE bookings
          SET status = 'checked_in', checked_in_at = NOW()
          WHERE id = $1 AND status = 'booked'
        `, [sfBookingId]);
      }
    }

    // Update mapping
    await db.query(`
      UPDATE mindbody_booking_map
      SET mb_signed_in = $1, mb_last_modified = NOW(), last_synced_at = NOW()
      WHERE mindbody_site_id = $2 AND mindbody_visit_id = $3
    `, [visit.SignedIn || false, this.siteId, mbVisitId]);

    return { handled: true, updated: true };
  }

  async handleBookingCancelled(payload) {
    const visit = payload.Visit || payload;
    const mbVisitId = visit.Id?.toString();

    // Get mapping
    const mapResult = await db.query(`
      SELECT studioflow_booking_id FROM mindbody_booking_map
      WHERE mindbody_site_id = $1 AND mindbody_visit_id = $2
    `, [this.siteId, mbVisitId]);

    const sfBookingId = mapResult.rows[0]?.studioflow_booking_id;

    if (sfBookingId) {
      // Cancel StudioFlow booking
      const status = visit.LateCancelled ? 'late_cancel' : 'cancelled';
      await db.query(`
        UPDATE bookings
        SET status = $1, cancelled_at = NOW()
        WHERE id = $2
      `, [status, sfBookingId]);
    }

    // Update mapping
    await db.query(`
      UPDATE mindbody_booking_map
      SET mb_late_cancelled = $1, last_synced_at = NOW()
      WHERE mindbody_site_id = $2 AND mindbody_visit_id = $3
    `, [visit.LateCancelled || false, this.siteId, mbVisitId]);

    return { handled: true, cancelled: true };
  }

  // ============================================
  // MEMBERSHIP EVENT HANDLERS
  // ============================================

  async handleMembershipEvent(payload) {
    const contract = payload.ClientContract || payload;

    // Get client mapping
    const clientMap = await db.query(`
      SELECT studioflow_user_id FROM mindbody_client_map
      WHERE mindbody_site_id = $1 AND mindbody_client_id = $2
    `, [this.siteId, contract.ClientId?.toString()]);

    // Store/update membership mapping
    await db.query(`
      INSERT INTO mindbody_membership_map (
        mindbody_site_id, mindbody_client_contract_id, mindbody_contract_id,
        mb_client_id, mb_contract_name, mb_start_date, mb_end_date,
        mb_remaining_count, mb_is_auto_renewing, mb_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (mindbody_site_id, mindbody_client_contract_id) DO UPDATE SET
        mb_contract_name = EXCLUDED.mb_contract_name,
        mb_end_date = EXCLUDED.mb_end_date,
        mb_remaining_count = EXCLUDED.mb_remaining_count,
        mb_is_auto_renewing = EXCLUDED.mb_is_auto_renewing,
        mb_status = EXCLUDED.mb_status,
        last_synced_at = NOW()
    `, [
      this.siteId,
      contract.Id?.toString(),
      contract.ContractId?.toString(),
      contract.ClientId?.toString(),
      contract.ContractName,
      contract.StartDate,
      contract.EndDate,
      contract.RemainingCount,
      contract.IsAutoRenewing,
      contract.Status,
    ]);

    return { handled: true };
  }

  // ============================================
  // SALE EVENT HANDLERS
  // ============================================

  async handleSaleCompleted(payload) {
    const sale = payload.Sale || payload;

    // Log sale for reference but don't create transaction
    // (transactions should come through payment system)
    console.log(`[MindBody Webhook] Sale completed: ${sale.Id}`);

    return { handled: true, logged: true };
  }

  // ============================================
  // RETRY FAILED EVENTS
  // ============================================

  async retryFailedEvents() {
    const failedEvents = await db.query(`
      SELECT * FROM mindbody_webhook_events
      WHERE status = 'failed' AND retry_count < 3
      ORDER BY received_at ASC
      LIMIT 10
    `);

    for (const event of failedEvents.rows) {
      try {
        await this.processWebhook(event.event_type, event.payload);
      } catch (error) {
        console.error(`[MindBody Webhook] Retry failed for event ${event.id}:`, error.message);
      }
    }

    return { retried: failedEvents.rows.length };
  }
}

module.exports = { WebhookHandler };
