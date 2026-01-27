// ============================================
// MINDBODY SYNC SERVICE
// Orchestrates data synchronization
// ============================================

const db = require('../../database/connection');
const { getClient } = require('./client');

/**
 * Base sync service with common functionality
 */
class SyncService {
  constructor(siteId) {
    this.siteId = siteId || process.env.MINDBODY_SITE_ID;
    this.client = getClient();
    this.syncLogId = null;
    this.stats = {
      fetched: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: 0,
    };
    this.errors = [];
  }

  // ============================================
  // SYNC LOG MANAGEMENT
  // ============================================

  async startSyncLog(syncType, triggeredBy = 'manual', userId = null) {
    const result = await db.query(`
      INSERT INTO mindbody_sync_log (site_id, sync_type, triggered_by, triggered_by_user)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `, [this.siteId, syncType, triggeredBy, userId]);

    this.syncLogId = result.rows[0].id;
    this.stats = { fetched: 0, created: 0, updated: 0, skipped: 0, errors: 0 };
    this.errors = [];

    return this.syncLogId;
  }

  async completeSyncLog(status = 'completed') {
    if (!this.syncLogId) return;

    const duration = Date.now() - (this.startTime || Date.now());

    await db.query(`
      UPDATE mindbody_sync_log
      SET
        status = $1,
        records_fetched = $2,
        records_created = $3,
        records_updated = $4,
        records_skipped = $5,
        records_error = $6,
        errors = $7,
        completed_at = NOW(),
        duration_ms = $8
      WHERE id = $9
    `, [
      status,
      this.stats.fetched,
      this.stats.created,
      this.stats.updated,
      this.stats.skipped,
      this.stats.errors,
      JSON.stringify(this.errors.slice(0, 100)), // Limit stored errors
      duration,
      this.syncLogId,
    ]);
  }

  addError(entityType, entityId, error) {
    this.stats.errors++;
    this.errors.push({
      type: entityType,
      id: entityId,
      error: error.message || error,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================
  // LOCATION SYNC
  // ============================================

  async syncLocations() {
    console.log('[MindBody] Syncing locations...');

    try {
      const response = await this.client.getLocations();
      const locations = response.Locations || [];

      for (const mbLocation of locations) {
        try {
          // Check for existing mapping
          const existing = await db.query(`
            SELECT * FROM mindbody_location_map
            WHERE mindbody_site_id = $1 AND mindbody_location_id = $2
          `, [this.siteId, mbLocation.Id.toString()]);

          if (existing.rows.length > 0) {
            // Update existing mapping
            await db.query(`
              UPDATE mindbody_location_map
              SET
                mb_name = $1,
                mb_address = $2,
                mb_city = $3,
                mb_state = $4,
                mb_postal_code = $5,
                mb_phone = $6,
                last_synced_at = NOW()
              WHERE mindbody_site_id = $7 AND mindbody_location_id = $8
            `, [
              mbLocation.Name,
              mbLocation.Address,
              mbLocation.City,
              mbLocation.StateProvCode,
              mbLocation.PostalCode,
              mbLocation.Phone,
              this.siteId,
              mbLocation.Id.toString(),
            ]);
            this.stats.updated++;
          } else {
            // Try to find matching StudioFlow location
            let sfLocationId = null;
            const matchResult = await db.query(`
              SELECT id FROM locations
              WHERE LOWER(name) LIKE LOWER($1) OR LOWER(short_name) LIKE LOWER($1)
              LIMIT 1
            `, [`%${mbLocation.Name}%`]);

            if (matchResult.rows.length > 0) {
              sfLocationId = matchResult.rows[0].id;
            }

            // Create new mapping
            await db.query(`
              INSERT INTO mindbody_location_map (
                mindbody_site_id, mindbody_location_id, studioflow_location_id,
                mb_name, mb_address, mb_city, mb_state, mb_postal_code, mb_phone
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
              this.siteId,
              mbLocation.Id.toString(),
              sfLocationId,
              mbLocation.Name,
              mbLocation.Address,
              mbLocation.City,
              mbLocation.StateProvCode,
              mbLocation.PostalCode,
              mbLocation.Phone,
            ]);
            this.stats.created++;
          }

          this.stats.fetched++;
        } catch (error) {
          this.addError('location', mbLocation.Id, error);
        }
      }

      console.log(`[MindBody] Locations synced: ${this.stats.fetched}`);
      return locations;
    } catch (error) {
      console.error('[MindBody] Location sync error:', error.message);
      throw error;
    }
  }

  // ============================================
  // STAFF SYNC
  // ============================================

  async syncStaff() {
    console.log('[MindBody] Syncing staff...');

    try {
      const response = await this.client.getStaff();
      const staffMembers = response.StaffMembers || [];

      for (const mbStaff of staffMembers) {
        try {
          // Check for existing mapping
          const existing = await db.query(`
            SELECT * FROM mindbody_staff_map
            WHERE mindbody_site_id = $1 AND mindbody_staff_id = $2
          `, [this.siteId, mbStaff.Id.toString()]);

          if (existing.rows.length > 0) {
            // Update existing
            await db.query(`
              UPDATE mindbody_staff_map
              SET
                mb_first_name = $1,
                mb_last_name = $2,
                mb_email = $3,
                mb_bio = $4,
                last_synced_at = NOW()
              WHERE mindbody_site_id = $5 AND mindbody_staff_id = $6
            `, [
              mbStaff.FirstName,
              mbStaff.LastName,
              mbStaff.Email,
              mbStaff.Bio,
              this.siteId,
              mbStaff.Id.toString(),
            ]);
            this.stats.updated++;
          } else {
            // Try to match with existing StudioFlow user/teacher
            let sfUserId = null;
            let sfTeacherId = null;

            if (mbStaff.Email) {
              const userMatch = await db.query(`
                SELECT u.id as user_id, t.id as teacher_id
                FROM users u
                LEFT JOIN teachers t ON t.user_id = u.id
                WHERE LOWER(u.email) = LOWER($1)
              `, [mbStaff.Email]);

              if (userMatch.rows.length > 0) {
                sfUserId = userMatch.rows[0].user_id;
                sfTeacherId = userMatch.rows[0].teacher_id;
              }
            }

            // Create mapping
            await db.query(`
              INSERT INTO mindbody_staff_map (
                mindbody_site_id, mindbody_staff_id, studioflow_user_id, studioflow_teacher_id,
                mb_first_name, mb_last_name, mb_email, mb_bio
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              this.siteId,
              mbStaff.Id.toString(),
              sfUserId,
              sfTeacherId,
              mbStaff.FirstName,
              mbStaff.LastName,
              mbStaff.Email,
              mbStaff.Bio,
            ]);
            this.stats.created++;
          }

          this.stats.fetched++;
        } catch (error) {
          this.addError('staff', mbStaff.Id, error);
        }
      }

      console.log(`[MindBody] Staff synced: ${this.stats.fetched}`);
      return staffMembers;
    } catch (error) {
      console.error('[MindBody] Staff sync error:', error.message);
      throw error;
    }
  }

  // ============================================
  // CLASS TYPE SYNC
  // ============================================

  async syncClassTypes() {
    console.log('[MindBody] Syncing class types...');

    try {
      const response = await this.client.getClassDescriptions();
      const classDescriptions = response.ClassDescriptions || [];

      for (const mbClass of classDescriptions) {
        try {
          const existing = await db.query(`
            SELECT * FROM mindbody_class_type_map
            WHERE mindbody_site_id = $1 AND mindbody_class_description_id = $2
          `, [this.siteId, mbClass.Id.toString()]);

          if (existing.rows.length > 0) {
            await db.query(`
              UPDATE mindbody_class_type_map
              SET
                mb_name = $1,
                mb_description = $2,
                mb_duration = $3,
                mb_category = $4,
                mb_subcategory = $5,
                last_synced_at = NOW()
              WHERE mindbody_site_id = $6 AND mindbody_class_description_id = $7
            `, [
              mbClass.Name,
              mbClass.Description,
              mbClass.Duration,
              mbClass.Category,
              mbClass.Subcategory,
              this.siteId,
              mbClass.Id.toString(),
            ]);
            this.stats.updated++;
          } else {
            // Try to match with existing StudioFlow class type
            let sfClassTypeId = null;
            const matchResult = await db.query(`
              SELECT id FROM class_types
              WHERE LOWER(name) = LOWER($1) OR LOWER(name) LIKE LOWER($2)
              LIMIT 1
            `, [mbClass.Name, `%${mbClass.Name}%`]);

            if (matchResult.rows.length > 0) {
              sfClassTypeId = matchResult.rows[0].id;
            }

            await db.query(`
              INSERT INTO mindbody_class_type_map (
                mindbody_site_id, mindbody_class_description_id, studioflow_class_type_id,
                mb_name, mb_description, mb_duration, mb_category, mb_subcategory
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              this.siteId,
              mbClass.Id.toString(),
              sfClassTypeId,
              mbClass.Name,
              mbClass.Description,
              mbClass.Duration,
              mbClass.Category,
              mbClass.Subcategory,
            ]);
            this.stats.created++;
          }

          this.stats.fetched++;
        } catch (error) {
          this.addError('class_type', mbClass.Id, error);
        }
      }

      console.log(`[MindBody] Class types synced: ${this.stats.fetched}`);
      return classDescriptions;
    } catch (error) {
      console.error('[MindBody] Class type sync error:', error.message);
      throw error;
    }
  }

  // ============================================
  // CLIENT SYNC
  // ============================================

  async syncClients(options = {}) {
    console.log('[MindBody] Syncing clients...');

    try {
      // Get settings for sync behavior
      const settingsResult = await db.query(
        "SELECT value FROM settings WHERE key = 'mindbody'"
      );
      const settings = settingsResult.rows[0]?.value || {};

      // Fetch clients (paginated)
      let allClients = [];
      let offset = 0;
      const limit = 200;
      let hasMore = true;

      while (hasMore) {
        const response = await this.client.getClients({
          lastModifiedDate: options.since,
          limit,
          offset,
        });

        const clients = response.Clients || [];
        allClients = allClients.concat(clients);

        if (clients.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }

        // Safety limit
        if (allClients.length > 10000) {
          console.warn('[MindBody] Client sync safety limit reached');
          break;
        }
      }

      console.log(`[MindBody] Fetched ${allClients.length} clients from MindBody`);

      for (const mbClient of allClients) {
        try {
          await this.processClient(mbClient, settings);
          this.stats.fetched++;
        } catch (error) {
          this.addError('client', mbClient.Id, error);
        }
      }

      console.log(`[MindBody] Clients synced: ${this.stats.fetched} (${this.stats.created} created, ${this.stats.updated} updated)`);
      return allClients;
    } catch (error) {
      console.error('[MindBody] Client sync error:', error.message);
      throw error;
    }
  }

  async processClient(mbClient, settings = {}) {
    // Check for existing mapping
    const existing = await db.query(`
      SELECT * FROM mindbody_client_map
      WHERE mindbody_site_id = $1 AND mindbody_client_id = $2
    `, [this.siteId, mbClient.Id.toString()]);

    if (existing.rows.length > 0) {
      // Update existing mapping
      await db.query(`
        UPDATE mindbody_client_map
        SET
          mb_first_name = $1,
          mb_last_name = $2,
          mb_email = $3,
          mb_phone = $4,
          last_synced_at = NOW(),
          sync_status = 'synced'
        WHERE mindbody_site_id = $5 AND mindbody_client_id = $6
      `, [
        mbClient.FirstName,
        mbClient.LastName,
        mbClient.Email,
        mbClient.MobilePhone || mbClient.HomePhone,
        this.siteId,
        mbClient.Id.toString(),
      ]);

      // Optionally update StudioFlow user if mapped
      if (existing.rows[0].studioflow_user_id && settings.update_existing) {
        await db.query(`
          UPDATE users
          SET
            first_name = COALESCE(NULLIF($1, ''), first_name),
            last_name = COALESCE(NULLIF($2, ''), last_name),
            phone = COALESCE(NULLIF($3, ''), phone),
            updated_at = NOW()
          WHERE id = $4
        `, [
          mbClient.FirstName,
          mbClient.LastName,
          mbClient.MobilePhone || mbClient.HomePhone,
          existing.rows[0].studioflow_user_id,
        ]);
      }

      this.stats.updated++;
    } else {
      // New client - try to find matching StudioFlow user by email
      let sfUserId = null;

      if (mbClient.Email) {
        const userMatch = await db.query(`
          SELECT id FROM users WHERE LOWER(email) = LOWER($1)
        `, [mbClient.Email]);

        if (userMatch.rows.length > 0) {
          sfUserId = userMatch.rows[0].id;
        } else if (settings.create_missing_users && mbClient.Email) {
          // Create new user in StudioFlow
          const newUser = await db.query(`
            INSERT INTO users (email, first_name, last_name, phone, role)
            VALUES ($1, $2, $3, $4, 'student')
            RETURNING id
          `, [
            mbClient.Email.toLowerCase(),
            mbClient.FirstName || 'Unknown',
            mbClient.LastName || '',
            mbClient.MobilePhone || mbClient.HomePhone,
          ]);
          sfUserId = newUser.rows[0].id;
        }
      }

      // Create mapping
      await db.query(`
        INSERT INTO mindbody_client_map (
          mindbody_site_id, mindbody_client_id, studioflow_user_id,
          mb_first_name, mb_last_name, mb_email, mb_phone
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        this.siteId,
        mbClient.Id.toString(),
        sfUserId,
        mbClient.FirstName,
        mbClient.LastName,
        mbClient.Email,
        mbClient.MobilePhone || mbClient.HomePhone,
      ]);

      this.stats.created++;
    }
  }

  // ============================================
  // CLASS SCHEDULE SYNC
  // ============================================

  async syncClasses(options = {}) {
    console.log('[MindBody] Syncing classes...');

    try {
      const settings = (await db.query("SELECT value FROM settings WHERE key = 'mindbody'")).rows[0]?.value || {};

      // Default to syncing 7 days back and 14 days ahead
      const startDate = options.startDate || new Date(Date.now() - (settings.sync_days_back || 7) * 24 * 60 * 60 * 1000);
      const endDate = options.endDate || new Date(Date.now() + (settings.sync_days_ahead || 14) * 24 * 60 * 60 * 1000);

      const response = await this.client.getClasses({
        startDateTime: startDate,
        endDateTime: endDate,
        hideCancelled: false,
      });

      const classes = response.Classes || [];
      console.log(`[MindBody] Fetched ${classes.length} classes from MindBody`);

      for (const mbClass of classes) {
        try {
          await this.processClass(mbClass, settings);
          this.stats.fetched++;
        } catch (error) {
          this.addError('class', mbClass.Id, error);
        }
      }

      console.log(`[MindBody] Classes synced: ${this.stats.fetched}`);
      return classes;
    } catch (error) {
      console.error('[MindBody] Class sync error:', error.message);
      throw error;
    }
  }

  async processClass(mbClass, settings = {}) {
    // Check for existing mapping
    const existing = await db.query(`
      SELECT * FROM mindbody_class_map
      WHERE mindbody_site_id = $1 AND mindbody_class_id = $2
    `, [this.siteId, mbClass.Id.toString()]);

    const startDateTime = new Date(mbClass.StartDateTime);
    const endDateTime = new Date(mbClass.EndDateTime);

    if (existing.rows.length > 0) {
      // Update existing
      await db.query(`
        UPDATE mindbody_class_map
        SET
          mb_start_datetime = $1,
          mb_end_datetime = $2,
          mb_staff_id = $3,
          mb_location_id = $4,
          mb_class_description_id = $5,
          mb_is_cancelled = $6,
          mb_max_capacity = $7,
          mb_total_booked = $8,
          mb_waitlist_size = $9,
          last_synced_at = NOW()
        WHERE mindbody_site_id = $10 AND mindbody_class_id = $11
      `, [
        startDateTime,
        endDateTime,
        mbClass.Staff?.Id?.toString(),
        mbClass.Location?.Id?.toString(),
        mbClass.ClassDescription?.Id?.toString(),
        mbClass.IsCanceled,
        mbClass.MaxCapacity,
        mbClass.TotalBooked,
        mbClass.TotalBookedWaitlist,
        this.siteId,
        mbClass.Id.toString(),
      ]);

      this.stats.updated++;
    } else {
      // Try to find or create matching StudioFlow class
      let sfClassId = null;

      if (settings.create_missing_classes) {
        sfClassId = await this.findOrCreateStudioFlowClass(mbClass, startDateTime, endDateTime);
      }

      // Create mapping
      await db.query(`
        INSERT INTO mindbody_class_map (
          mindbody_site_id, mindbody_class_id, mindbody_class_schedule_id,
          studioflow_class_id, mb_start_datetime, mb_end_datetime,
          mb_staff_id, mb_location_id, mb_class_description_id,
          mb_is_cancelled, mb_max_capacity, mb_total_booked, mb_waitlist_size
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        this.siteId,
        mbClass.Id.toString(),
        mbClass.ClassScheduleId?.toString(),
        sfClassId,
        startDateTime,
        endDateTime,
        mbClass.Staff?.Id?.toString(),
        mbClass.Location?.Id?.toString(),
        mbClass.ClassDescription?.Id?.toString(),
        mbClass.IsCanceled,
        mbClass.MaxCapacity,
        mbClass.TotalBooked,
        mbClass.TotalBookedWaitlist,
      ]);

      this.stats.created++;
    }
  }

  async findOrCreateStudioFlowClass(mbClass, startDateTime, endDateTime) {
    // Get mapped IDs
    const classTypeMap = await db.query(`
      SELECT studioflow_class_type_id FROM mindbody_class_type_map
      WHERE mindbody_site_id = $1 AND mindbody_class_description_id = $2
    `, [this.siteId, mbClass.ClassDescription?.Id?.toString()]);

    const teacherMap = await db.query(`
      SELECT studioflow_teacher_id FROM mindbody_staff_map
      WHERE mindbody_site_id = $1 AND mindbody_staff_id = $2
    `, [this.siteId, mbClass.Staff?.Id?.toString()]);

    const locationMap = await db.query(`
      SELECT studioflow_location_id FROM mindbody_location_map
      WHERE mindbody_site_id = $1 AND mindbody_location_id = $2
    `, [this.siteId, mbClass.Location?.Id?.toString()]);

    const classTypeId = classTypeMap.rows[0]?.studioflow_class_type_id;
    const teacherId = teacherMap.rows[0]?.studioflow_teacher_id;
    const locationId = locationMap.rows[0]?.studioflow_location_id;

    if (!classTypeId || !teacherId || !locationId) {
      return null; // Can't create class without required mappings
    }

    // Check if class already exists
    const existingClass = await db.query(`
      SELECT id FROM classes
      WHERE class_type_id = $1 AND teacher_id = $2 AND location_id = $3
        AND date = $4 AND start_time = $5
    `, [
      classTypeId,
      teacherId,
      locationId,
      startDateTime.toISOString().split('T')[0],
      startDateTime.toTimeString().split(' ')[0],
    ]);

    if (existingClass.rows.length > 0) {
      return existingClass.rows[0].id;
    }

    // Create new class
    const newClass = await db.query(`
      INSERT INTO classes (
        class_type_id, teacher_id, location_id, date, start_time, end_time,
        capacity, is_cancelled
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `, [
      classTypeId,
      teacherId,
      locationId,
      startDateTime.toISOString().split('T')[0],
      startDateTime.toTimeString().split(' ')[0],
      endDateTime.toTimeString().split(' ')[0],
      mbClass.MaxCapacity || 20,
      mbClass.IsCanceled || false,
    ]);

    return newClass.rows[0].id;
  }

  // ============================================
  // BOOKING SYNC
  // ============================================

  async syncBookings(options = {}) {
    console.log('[MindBody] Syncing bookings...');

    try {
      // Get all classes that have been synced
      const classMapResult = await db.query(`
        SELECT mindbody_class_id, studioflow_class_id
        FROM mindbody_class_map
        WHERE mindbody_site_id = $1
          AND studioflow_class_id IS NOT NULL
          AND mb_start_datetime >= NOW() - INTERVAL '7 days'
          AND mb_start_datetime <= NOW() + INTERVAL '14 days'
      `, [this.siteId]);

      const classMaps = classMapResult.rows;
      console.log(`[MindBody] Syncing bookings for ${classMaps.length} classes`);

      for (const classMap of classMaps) {
        try {
          const response = await this.client.getClassVisits(parseInt(classMap.mindbody_class_id));
          const visits = response.Visits || [];

          for (const visit of visits) {
            await this.processBooking(visit, classMap.studioflow_class_id);
          }

          this.stats.fetched += visits.length;
        } catch (error) {
          this.addError('booking_class', classMap.mindbody_class_id, error);
        }
      }

      console.log(`[MindBody] Bookings synced: ${this.stats.fetched}`);
    } catch (error) {
      console.error('[MindBody] Booking sync error:', error.message);
      throw error;
    }
  }

  async processBooking(visit, sfClassId) {
    // Check for existing mapping
    const existing = await db.query(`
      SELECT * FROM mindbody_booking_map
      WHERE mindbody_site_id = $1 AND mindbody_visit_id = $2
    `, [this.siteId, visit.Id.toString()]);

    if (existing.rows.length > 0) {
      // Update existing
      await db.query(`
        UPDATE mindbody_booking_map
        SET
          mb_signed_in = $1,
          mb_late_cancelled = $2,
          mb_last_modified = $3,
          last_synced_at = NOW()
        WHERE mindbody_site_id = $4 AND mindbody_visit_id = $5
      `, [
        visit.SignedIn,
        visit.LateCancelled,
        visit.LastModifiedDateTime ? new Date(visit.LastModifiedDateTime) : null,
        this.siteId,
        visit.Id.toString(),
      ]);
      this.stats.updated++;
    } else {
      // Get user mapping
      const clientMap = await db.query(`
        SELECT studioflow_user_id FROM mindbody_client_map
        WHERE mindbody_site_id = $1 AND mindbody_client_id = $2
      `, [this.siteId, visit.ClientId?.toString()]);

      const sfUserId = clientMap.rows[0]?.studioflow_user_id;
      let sfBookingId = null;

      // Create StudioFlow booking if user is mapped
      if (sfUserId && sfClassId && !visit.LateCancelled) {
        const existingBooking = await db.query(`
          SELECT id FROM bookings WHERE user_id = $1 AND class_id = $2
        `, [sfUserId, sfClassId]);

        if (existingBooking.rows.length > 0) {
          sfBookingId = existingBooking.rows[0].id;

          // Update status if checked in
          if (visit.SignedIn) {
            await db.query(`
              UPDATE bookings SET status = 'checked_in', checked_in_at = NOW()
              WHERE id = $1 AND status = 'booked'
            `, [sfBookingId]);
          }
        } else {
          const newBooking = await db.query(`
            INSERT INTO bookings (user_id, class_id, status, booking_source)
            VALUES ($1, $2, $3, 'mindbody')
            ON CONFLICT (user_id, class_id) DO UPDATE SET updated_at = NOW()
            RETURNING id
          `, [sfUserId, sfClassId, visit.SignedIn ? 'checked_in' : 'booked']);
          sfBookingId = newBooking.rows[0].id;
        }
      }

      // Create mapping
      await db.query(`
        INSERT INTO mindbody_booking_map (
          mindbody_site_id, mindbody_visit_id, studioflow_booking_id,
          mb_class_id, mb_client_id, mb_service_id,
          mb_signed_in, mb_late_cancelled, mb_last_modified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `, [
        this.siteId,
        visit.Id.toString(),
        sfBookingId,
        visit.ClassId?.toString(),
        visit.ClientId?.toString(),
        visit.ServiceId?.toString(),
        visit.SignedIn,
        visit.LateCancelled,
        visit.LastModifiedDateTime ? new Date(visit.LastModifiedDateTime) : null,
      ]);

      this.stats.created++;
    }
  }

  // ============================================
  // FULL SYNC
  // ============================================

  async fullSync(triggeredBy = 'manual', userId = null) {
    console.log('[MindBody] Starting full sync...');
    this.startTime = Date.now();

    await this.startSyncLog('full', triggeredBy, userId);

    try {
      // Sync in order of dependencies
      await this.syncLocations();
      await this.syncStaff();
      await this.syncClassTypes();
      await this.syncClients();
      await this.syncClasses();
      await this.syncBookings();

      // Update last full sync time
      await db.query(`
        UPDATE mindbody_config
        SET last_full_sync = NOW()
        WHERE site_id = $1
      `, [this.siteId]);

      await this.completeSyncLog('completed');

      console.log('[MindBody] Full sync completed successfully');
      return {
        success: true,
        stats: this.stats,
        errors: this.errors,
      };
    } catch (error) {
      await this.completeSyncLog('failed');
      console.error('[MindBody] Full sync failed:', error.message);
      return {
        success: false,
        stats: this.stats,
        errors: this.errors,
        error: error.message,
      };
    }
  }

  // ============================================
  // INCREMENTAL SYNC
  // ============================================

  async incrementalSync(triggeredBy = 'scheduled', userId = null) {
    console.log('[MindBody] Starting incremental sync...');
    this.startTime = Date.now();

    await this.startSyncLog('incremental', triggeredBy, userId);

    try {
      // Only sync classes and bookings for incremental
      await this.syncClasses();
      await this.syncBookings();

      await this.completeSyncLog('completed');

      console.log('[MindBody] Incremental sync completed');
      return {
        success: true,
        stats: this.stats,
      };
    } catch (error) {
      await this.completeSyncLog('failed');
      return {
        success: false,
        stats: this.stats,
        error: error.message,
      };
    }
  }
}

module.exports = { SyncService };
