// ============================================
// MINDBODY DATA IMPORT SERVICE
// Full migration from MindBody with history
// ============================================

const db = require('../../database/connection');
const { getClient } = require('./client');

class MindbodyImportService {
  constructor() {
    this.client = getClient();
    this.siteId = process.env.MINDBODY_SITE_ID;
    this.stats = {
      clients: { fetched: 0, created: 0, updated: 0, failed: 0 },
      visits: { fetched: 0, created: 0 },
      memberships: { fetched: 0, created: 0 },
      purchases: { fetched: 0, created: 0 },
    };
    this.importJobId = null;
  }

  /**
   * Full import from MindBody
   * Pulls clients, visit history, memberships, and purchases
   */
  async runFullImport(options = {}) {
    console.log('[MindBody Import] Starting full data import...');

    // Create import job record
    const jobResult = await db.query(`
      INSERT INTO marketing_import_jobs (name, source, import_type, status, started_at, created_by)
      VALUES ($1, 'mindbody', 'full_sync', 'processing', NOW(), $2)
      RETURNING id
    `, ['MindBody Full Import', options.userId]);

    this.importJobId = jobResult.rows[0].id;

    try {
      // Step 1: Import all clients with full details
      console.log('[MindBody Import] Step 1: Importing clients...');
      await this.importClients(options);

      // Step 2: Import visit history for each client
      console.log('[MindBody Import] Step 2: Importing visit history...');
      await this.importVisitHistory(options);

      // Step 3: Import membership/service history
      console.log('[MindBody Import] Step 3: Importing memberships...');
      await this.importMemberships(options);

      // Step 4: Import purchase history
      console.log('[MindBody Import] Step 4: Importing purchases...');
      await this.importPurchases(options);

      // Mark complete
      await db.query(`
        UPDATE marketing_import_jobs
        SET status = 'completed', completed_at = NOW(),
            total_records = $1, created_records = $2, updated_records = $3
        WHERE id = $4
      `, [
        this.stats.clients.fetched,
        this.stats.clients.created,
        this.stats.clients.updated,
        this.importJobId,
      ]);

      console.log('[MindBody Import] Import completed!', this.stats);
      return { success: true, stats: this.stats };
    } catch (error) {
      await db.query(`
        UPDATE marketing_import_jobs
        SET status = 'failed', errors = $1
        WHERE id = $2
      `, [JSON.stringify([{ error: error.message }]), this.importJobId]);

      console.error('[MindBody Import] Import failed:', error);
      throw error;
    }
  }

  /**
   * Import all clients from MindBody
   */
  async importClients(options = {}) {
    let offset = 0;
    const limit = 200;
    let hasMore = true;

    while (hasMore) {
      try {
        const response = await this.client.getClients({ limit, offset });
        const clients = response.Clients || [];

        if (clients.length === 0) {
          hasMore = false;
          continue;
        }

        console.log(`[MindBody Import] Processing clients ${offset + 1} - ${offset + clients.length}`);

        for (const mbClient of clients) {
          try {
            await this.processClientImport(mbClient);
            this.stats.clients.fetched++;
          } catch (error) {
            console.error(`[MindBody Import] Client ${mbClient.Id} failed:`, error.message);
            this.stats.clients.failed++;
          }
        }

        offset += limit;
        if (clients.length < limit) {
          hasMore = false;
        }

        // Safety limit
        if (offset > 50000) {
          console.warn('[MindBody Import] Safety limit reached');
          break;
        }
      } catch (error) {
        console.error('[MindBody Import] Batch failed:', error.message);
        hasMore = false;
      }
    }

    console.log(`[MindBody Import] Clients imported: ${this.stats.clients.fetched}`);
  }

  /**
   * Process a single client import
   */
  async processClientImport(mbClient) {
    const email = mbClient.Email?.toLowerCase();
    const phone = this.formatPhone(mbClient.MobilePhone || mbClient.HomePhone);

    // Check for existing user by email
    let userId = null;
    if (email) {
      const userResult = await db.query('SELECT id FROM users WHERE LOWER(email) = $1', [email]);
      userId = userResult.rows[0]?.id;
    }

    // Create user if doesn't exist
    if (!userId && email) {
      const newUser = await db.query(`
        INSERT INTO users (email, first_name, last_name, phone, role, is_active, created_at)
        VALUES ($1, $2, $3, $4, 'student', $5, $6)
        ON CONFLICT (email) DO UPDATE SET
          first_name = COALESCE(NULLIF(users.first_name, ''), EXCLUDED.first_name),
          last_name = COALESCE(NULLIF(users.last_name, ''), EXCLUDED.last_name),
          phone = COALESCE(NULLIF(users.phone, ''), EXCLUDED.phone)
        RETURNING id
      `, [
        email,
        mbClient.FirstName || 'Unknown',
        mbClient.LastName || '',
        phone,
        mbClient.Active !== false,
        mbClient.CreationDate ? new Date(mbClient.CreationDate) : new Date(),
      ]);
      userId = newUser.rows[0].id;
      this.stats.clients.created++;
    } else if (userId) {
      this.stats.clients.updated++;
    }

    // Create/update subscriber record
    await db.query(`
      INSERT INTO marketing_subscribers (
        user_id, email, phone, first_name, last_name,
        email_opted_in, email_opt_in_date, email_opt_in_source,
        sms_opted_in, sms_opt_in_date, sms_opt_in_source,
        imported_from, imported_at, external_id, custom_fields
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'mindbody', $8, $9, 'mindbody', 'mindbody', NOW(), $10, $11)
      ON CONFLICT (LOWER(email)) WHERE email IS NOT NULL DO UPDATE SET
        user_id = COALESCE(marketing_subscribers.user_id, EXCLUDED.user_id),
        phone = COALESCE(NULLIF(EXCLUDED.phone, ''), marketing_subscribers.phone),
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        sms_opted_in = CASE WHEN EXCLUDED.phone IS NOT NULL THEN COALESCE(marketing_subscribers.sms_opted_in, EXCLUDED.sms_opted_in) ELSE marketing_subscribers.sms_opted_in END,
        external_id = EXCLUDED.external_id,
        custom_fields = marketing_subscribers.custom_fields || EXCLUDED.custom_fields,
        updated_at = NOW()
    `, [
      userId,
      email,
      phone,
      mbClient.FirstName,
      mbClient.LastName,
      mbClient.SendAccountEmails !== false,
      mbClient.CreationDate ? new Date(mbClient.CreationDate) : new Date(),
      mbClient.SendAccountTexts === true,
      mbClient.SendAccountTexts === true ? new Date() : null,
      mbClient.Id.toString(),
      JSON.stringify({
        mindbody_id: mbClient.Id,
        birth_date: mbClient.BirthDate,
        gender: mbClient.Gender,
        address: mbClient.AddressLine1,
        city: mbClient.City,
        state: mbClient.State,
        postal_code: mbClient.PostalCode,
        emergency_contact: mbClient.EmergencyContactInfoName,
        emergency_phone: mbClient.EmergencyContactInfoPhone,
        referred_by: mbClient.ReferredBy,
        notes: mbClient.Notes,
        is_prospect: mbClient.IsProspect,
        liability_released: mbClient.LiabilityRelease,
        liability_date: mbClient.LiabilityAgreementDate,
      }),
    ]);

    // Create MindBody ID mapping
    await db.query(`
      INSERT INTO mindbody_client_map (
        mindbody_site_id, mindbody_client_id, studioflow_user_id,
        mb_first_name, mb_last_name, mb_email, mb_phone
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (mindbody_site_id, mindbody_client_id) DO UPDATE SET
        studioflow_user_id = COALESCE(mindbody_client_map.studioflow_user_id, EXCLUDED.studioflow_user_id),
        last_synced_at = NOW()
    `, [
      this.siteId,
      mbClient.Id.toString(),
      userId,
      mbClient.FirstName,
      mbClient.LastName,
      email,
      phone,
    ]);

    return { userId, email };
  }

  /**
   * Import visit history for all imported clients
   */
  async importVisitHistory(options = {}) {
    // Get all client mappings
    const clientMaps = await db.query(`
      SELECT mindbody_client_id, studioflow_user_id
      FROM mindbody_client_map
      WHERE mindbody_site_id = $1 AND studioflow_user_id IS NOT NULL
    `, [this.siteId]);

    console.log(`[MindBody Import] Fetching visit history for ${clientMaps.rows.length} clients`);

    // Get visit history for each client (in batches)
    const batchSize = 10;
    for (let i = 0; i < clientMaps.rows.length; i += batchSize) {
      const batch = clientMaps.rows.slice(i, i + batchSize);

      await Promise.all(batch.map(async (map) => {
        try {
          // Get last 2 years of visits
          const startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 2);

          const response = await this.client.getClientVisits(map.mindbody_client_id, {
            startDate,
            endDate: new Date(),
          });

          const visits = response.Visits || [];

          for (const visit of visits) {
            await this.processVisitImport(visit, map.studioflow_user_id);
            this.stats.visits.fetched++;
          }
        } catch (error) {
          console.error(`[MindBody Import] Visit history failed for client ${map.mindbody_client_id}:`, error.message);
        }
      }));

      console.log(`[MindBody Import] Processed visits for clients ${i + 1} - ${Math.min(i + batchSize, clientMaps.rows.length)}`);
    }

    console.log(`[MindBody Import] Visits imported: ${this.stats.visits.fetched}`);
  }

  /**
   * Process a single visit import
   */
  async processVisitImport(visit, userId) {
    if (!visit.ClassId) return; // Skip non-class visits

    // Get class mapping
    const classMap = await db.query(`
      SELECT studioflow_class_id FROM mindbody_class_map
      WHERE mindbody_site_id = $1 AND mindbody_class_id = $2
    `, [this.siteId, visit.ClassId.toString()]);

    const classId = classMap.rows[0]?.studioflow_class_id;

    if (classId && userId) {
      // Create booking record
      await db.query(`
        INSERT INTO bookings (user_id, class_id, status, booked_at, checked_in_at, booking_source)
        VALUES ($1, $2, $3, $4, $5, 'mindbody_import')
        ON CONFLICT (user_id, class_id) DO UPDATE SET
          status = EXCLUDED.status,
          checked_in_at = COALESCE(bookings.checked_in_at, EXCLUDED.checked_in_at)
      `, [
        userId,
        classId,
        visit.SignedIn ? 'checked_in' : (visit.LateCancelled ? 'late_cancel' : 'booked'),
        visit.StartDateTime ? new Date(visit.StartDateTime) : new Date(),
        visit.SignedIn ? (visit.StartDateTime ? new Date(visit.StartDateTime) : new Date()) : null,
      ]);

      this.stats.visits.created++;
    }

    // Create booking mapping
    await db.query(`
      INSERT INTO mindbody_booking_map (
        mindbody_site_id, mindbody_visit_id, studioflow_booking_id,
        mb_class_id, mb_client_id, mb_signed_in, mb_late_cancelled
      ) VALUES ($1, $2, NULL, $3, $4, $5, $6)
      ON CONFLICT (mindbody_site_id, mindbody_visit_id) DO NOTHING
    `, [
      this.siteId,
      visit.Id.toString(),
      visit.ClassId?.toString(),
      visit.ClientId?.toString(),
      visit.SignedIn || false,
      visit.LateCancelled || false,
    ]);
  }

  /**
   * Import membership/service purchases
   */
  async importMemberships(options = {}) {
    const clientMaps = await db.query(`
      SELECT mindbody_client_id, studioflow_user_id
      FROM mindbody_client_map
      WHERE mindbody_site_id = $1 AND studioflow_user_id IS NOT NULL
    `, [this.siteId]);

    console.log(`[MindBody Import] Fetching memberships for ${clientMaps.rows.length} clients`);

    const batchSize = 10;
    for (let i = 0; i < clientMaps.rows.length; i += batchSize) {
      const batch = clientMaps.rows.slice(i, i + batchSize);

      await Promise.all(batch.map(async (map) => {
        try {
          const response = await this.client.getClientServices(map.mindbody_client_id, {
            showActiveOnly: false,
          });

          const services = response.ClientServices || [];

          for (const service of services) {
            await this.processMembershipImport(service, map.studioflow_user_id);
            this.stats.memberships.fetched++;
          }
        } catch (error) {
          console.error(`[MindBody Import] Memberships failed for client ${map.mindbody_client_id}:`, error.message);
        }
      }));
    }

    console.log(`[MindBody Import] Memberships imported: ${this.stats.memberships.fetched}`);
  }

  /**
   * Process membership import
   */
  async processMembershipImport(service, userId) {
    // Try to match to a StudioFlow membership type
    const membershipMatch = await db.query(`
      SELECT id, type FROM membership_types
      WHERE LOWER(name) LIKE LOWER($1) OR LOWER(name) LIKE LOWER($2)
      LIMIT 1
    `, [`%${service.Name}%`, `%${service.Name?.split(' ')[0]}%`]);

    let membershipTypeId = membershipMatch.rows[0]?.id;

    // Determine status
    let status = 'expired';
    if (service.ExpirationDate) {
      const expDate = new Date(service.ExpirationDate);
      if (expDate > new Date()) {
        status = 'active';
      }
    }
    if (service.Remaining > 0 || service.Remaining === null) {
      status = 'active';
    }

    if (userId) {
      await db.query(`
        INSERT INTO user_memberships (
          user_id, membership_type_id, start_date, end_date,
          credits_remaining, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT DO NOTHING
      `, [
        userId,
        membershipTypeId,
        service.ActiveDate ? new Date(service.ActiveDate) : new Date(),
        service.ExpirationDate ? new Date(service.ExpirationDate) : null,
        service.Remaining,
        status,
        service.ActiveDate ? new Date(service.ActiveDate) : new Date(),
      ]);

      this.stats.memberships.created++;
    }
  }

  /**
   * Import purchase/transaction history
   */
  async importPurchases(options = {}) {
    try {
      // Get sales from last 2 years
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);

      const response = await this.client.getSales({
        startDate,
        endDate: new Date(),
      });

      const sales = response.Sales || [];
      console.log(`[MindBody Import] Processing ${sales.length} sales`);

      for (const sale of sales) {
        try {
          // Get user mapping
          const clientMap = await db.query(`
            SELECT studioflow_user_id FROM mindbody_client_map
            WHERE mindbody_site_id = $1 AND mindbody_client_id = $2
          `, [this.siteId, sale.ClientId?.toString()]);

          const userId = clientMap.rows[0]?.studioflow_user_id;

          if (userId && sale.TotalAmount) {
            await db.query(`
              INSERT INTO transactions (
                user_id, type, amount, tax, total, payment_method,
                notes, status, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, 'completed', $8)
              ON CONFLICT DO NOTHING
            `, [
              userId,
              this.mapTransactionType(sale),
              sale.SubTotal || sale.TotalAmount,
              sale.TaxAmount || 0,
              sale.TotalAmount,
              sale.PaymentMethod || 'mindbody',
              `Imported from MindBody (Sale ID: ${sale.Id})`,
              sale.SaleDateTime ? new Date(sale.SaleDateTime) : new Date(),
            ]);

            this.stats.purchases.created++;
          }

          this.stats.purchases.fetched++;
        } catch (error) {
          console.error(`[MindBody Import] Sale ${sale.Id} failed:`, error.message);
        }
      }
    } catch (error) {
      console.error('[MindBody Import] Purchase import failed:', error.message);
    }

    console.log(`[MindBody Import] Purchases imported: ${this.stats.purchases.fetched}`);
  }

  /**
   * Get import summary statistics
   */
  async getImportSummary() {
    const summary = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users WHERE role = 'student') as total_users,
        (SELECT COUNT(*) FROM marketing_subscribers) as total_subscribers,
        (SELECT COUNT(*) FROM marketing_subscribers WHERE email_opted_in) as email_opted_in,
        (SELECT COUNT(*) FROM marketing_subscribers WHERE sms_opted_in) as sms_opted_in,
        (SELECT COUNT(*) FROM bookings WHERE booking_source = 'mindbody_import') as imported_bookings,
        (SELECT COUNT(*) FROM user_memberships) as total_memberships,
        (SELECT COUNT(*) FROM transactions) as total_transactions,
        (SELECT COUNT(DISTINCT user_id) FROM bookings WHERE status = 'checked_in') as users_with_visits,
        (SELECT MAX(c.date) FROM bookings b JOIN classes c ON b.class_id = c.id WHERE b.status = 'checked_in') as last_visit_date
    `);

    return summary.rows[0];
  }

  /**
   * Helper: Format phone number
   */
  formatPhone(phone) {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) return '+1' + digits;
    if (digits.length === 11 && digits[0] === '1') return '+' + digits;
    return phone;
  }

  /**
   * Helper: Map MindBody sale type to transaction type
   */
  mapTransactionType(sale) {
    const description = (sale.Description || '').toLowerCase();
    if (description.includes('unlimited') || description.includes('membership')) {
      return 'membership_purchase';
    }
    if (description.includes('class') || description.includes('pack')) {
      return 'membership_purchase';
    }
    if (description.includes('drop')) {
      return 'drop_in';
    }
    return 'membership_purchase';
  }
}

module.exports = { MindbodyImportService };
