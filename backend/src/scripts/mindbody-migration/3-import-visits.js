#!/usr/bin/env node

// ============================================
// IMPORT VISIT HISTORY FROM MINDBODY
// Phase 3: Import class attendance history for engagement metrics
// ============================================

require('dotenv').config();
const { pool } = require('../../database/connection');
const MindbodyClient = require('./mindbody-client');

const DRY_RUN = process.argv.includes('--dry-run');
const PHASE = 'visits';
const START_DATE = process.env.IMPORT_START_DATE || '2020-01-01'; // How far back to import

async function importVisits() {
  const client = new MindbodyClient();
  let stats = {
    clientsProcessed: 0,
    visitsImported: 0,
    visitsFailed: 0
  };

  try {
    console.log('\n' + '='.repeat(50));
    console.log('MINDBODY VISIT HISTORY IMPORT');
    console.log('='.repeat(50));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
    console.log(`Start Date: ${START_DATE}`);
    console.log('='.repeat(50) + '\n');

    if (!DRY_RUN) {
      await client.updateProgress(PHASE, {
        status: 'running',
        started_at: new Date()
      });
    }

    // Get all imported clients
    const clientsResult = await pool.query(
      `SELECT id, mindbody_id, first_name, last_name
       FROM users
       WHERE imported_from_mindbody = true
       AND mindbody_id IS NOT NULL
       ORDER BY id`
    );

    const clients = clientsResult.rows;
    console.log(`📊 Found ${clients.length} clients to process`);

    if (!DRY_RUN) {
      await client.updateProgress(PHASE, {
        records_total: clients.length
      });
    }

    // Process clients in batches
    const batchSize = 10; // Process 10 clients concurrently
    for (let i = 0; i < clients.length; i += batchSize) {
      const batch = clients.slice(i, Math.min(i + batchSize, clients.length));

      await Promise.all(
        batch.map(async (user) => {
          try {
            const visitCount = await importClientVisits(client, user, DRY_RUN);
            stats.visitsImported += visitCount;
            stats.clientsProcessed++;
          } catch (err) {
            console.error(`❌ Failed to import visits for client ${user.mindbody_id}:`, err.message);
            if (!DRY_RUN) {
              await client.logError(PHASE, user.mindbody_id, err);
            }
          }
        })
      );

      // Progress update
      console.log(`Progress: ${Math.min(i + batchSize, clients.length)}/${clients.length} clients (${stats.visitsImported} visits)`);

      if (!DRY_RUN) {
        await client.updateProgress(PHASE, {
          records_processed: stats.clientsProcessed
        });
      }
    }

    // Final status
    if (!DRY_RUN) {
      await client.updateProgress(PHASE, {
        status: 'completed',
        completed_at: new Date()
      });
    }

    console.log('\n' + '='.repeat(50));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(50));
    console.log(`Clients processed: ${stats.clientsProcessed}`);
    console.log(`✓ Visits imported: ${stats.visitsImported}`);
    console.log(`✗ Visits failed: ${stats.visitsFailed}`);
    console.log('='.repeat(50) + '\n');

    if (DRY_RUN) {
      console.log('This was a DRY RUN - no changes were made to the database.\n');
    }

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    if (!DRY_RUN) {
      await client.updateProgress(PHASE, {
        status: 'failed',
        error_message: err.message
      });
    }
    throw err;
  } finally {
    await pool.end();
  }
}

async function importClientVisits(client, user, dryRun = false) {
  // Fetch visits from Mindbody
  const visits = await client.getClientVisits(user.mindbody_id, START_DATE);

  if (visits.length === 0) {
    console.log(`  ${user.first_name} ${user.last_name}: No visits found`);
    return 0;
  }

  let imported = 0;

  for (const visit of visits) {
    try {
      if (dryRun) {
        console.log(`[DRY RUN] Would import visit for ${user.first_name} ${user.last_name} on ${visit.StartDateTime}`);
        imported++;
        continue;
      }

      // Check if visit already exists
      const existing = await pool.query(
        'SELECT id FROM class_bookings WHERE mindbody_visit_id = $1',
        [visit.Id]
      );

      if (existing.rows.length > 0) {
        continue; // Skip existing visits
      }

      // Find or create the class
      let classId = await findOrCreateClass(visit);

      // Insert booking/visit record
      await pool.query(
        `INSERT INTO class_bookings (
          user_id, class_id, mindbody_visit_id, status, booked_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          user.id,
          classId,
          visit.Id,
          visit.LateCancelled ? 'cancelled' : 'confirmed',
          new Date(visit.StartDateTime),
          new Date(visit.StartDateTime)
        ]
      );

      imported++;
    } catch (err) {
      console.error(`  ❌ Failed to import visit ${visit.Id}:`, err.message);
    }
  }

  if (imported > 0) {
    console.log(`  ✓ ${user.first_name} ${user.last_name}: Imported ${imported} visits`);
  }

  return imported;
}

async function findOrCreateClass(visit) {
  // Try to find existing class by Mindbody ID
  if (visit.ClassId) {
    const existing = await pool.query(
      'SELECT id FROM classes WHERE mindbody_class_id = $1',
      [visit.ClassId]
    );

    if (existing.rows.length > 0) {
      return existing.rows[0].id;
    }
  }

  // Create a placeholder class record
  // (In reality, you'd want to fetch full class details from Mindbody)
  const result = await pool.query(
    `INSERT INTO classes (
      name, description, date, start_time, end_time,
      mindbody_class_id, capacity, is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8
    ) RETURNING id`,
    [
      visit.Name || 'Imported Class',
      `Imported from Mindbody (${visit.Id})`,
      new Date(visit.StartDateTime),
      new Date(visit.StartDateTime).toTimeString().slice(0, 8),
      new Date(visit.EndDateTime).toTimeString().slice(0, 8),
      visit.ClassId,
      20, // Default capacity
      false // Mark as inactive since it's historical
    ]
  );

  return result.rows[0].id;
}

// Run the import
if (require.main === module) {
  importVisits()
    .then(() => {
      console.log('✓ Script completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('✗ Script failed:', err);
      process.exit(1);
    });
}

module.exports = { importVisits };
