#!/usr/bin/env node

// ============================================
// IMPORT CLIENTS FROM MINDBODY
// Phase 1: Import all client profiles and email opt-in status
// ============================================

require('dotenv').config();
const { pool } = require('../../database/connection');
const MindbodyClient = require('./mindbody-client');
const bcrypt = require('bcryptjs');

const DRY_RUN = process.argv.includes('--dry-run');
const PHASE = 'clients';

async function importClients() {
  const client = new MindbodyClient();
  let stats = {
    total: 0,
    imported: 0,
    skipped: 0,
    failed: 0
  };

  try {
    console.log('\n' + '='.repeat(50));
    console.log('MINDBODY CLIENT IMPORT');
    console.log('='.repeat(50));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
    console.log('='.repeat(50) + '\n');

    // Update progress status
    if (!DRY_RUN) {
      await client.updateProgress(PHASE, {
        status: 'running',
        started_at: new Date()
      });
    }

    // Fetch all clients from Mindbody
    const mindbodyClients = await client.getAllClients((progress) => {
      console.log(`Progress: ${progress.processed}/${progress.total} (Page ${progress.page})`);
    });

    stats.total = mindbodyClients.length;

    if (!DRY_RUN) {
      await client.updateProgress(PHASE, {
        records_total: stats.total
      });
    }

    console.log(`\n📊 Found ${stats.total} clients to import`);
    console.log('Starting import...\n');

    // Process clients in batches
    for (let i = 0; i < mindbodyClients.length; i++) {
      const mbClient = mindbodyClients[i];

      try {
        await importClient(mbClient, DRY_RUN);
        stats.imported++;
      } catch (err) {
        stats.failed++;
        console.error(`❌ Failed to import client ${mbClient.Id}:`, err.message);
        if (!DRY_RUN) {
          await client.logError(PHASE, mbClient.Id, err);
        }
      }

      // Progress update every 100 clients
      if ((i + 1) % 100 === 0 || i === mindbodyClients.length - 1) {
        console.log(`Progress: ${i + 1}/${stats.total} (${Math.round((i + 1) / stats.total * 100)}%)`);
        if (!DRY_RUN) {
          await client.updateProgress(PHASE, {
            records_processed: stats.imported + stats.skipped,
            records_failed: stats.failed
          });
        }
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
    console.log(`Total clients: ${stats.total}`);
    console.log(`✓ Imported: ${stats.imported}`);
    console.log(`⊘ Skipped: ${stats.skipped}`);
    console.log(`✗ Failed: ${stats.failed}`);
    console.log('='.repeat(50) + '\n');

    if (DRY_RUN) {
      console.log('This was a DRY RUN - no changes were made to the database.');
      console.log('Run without --dry-run to perform the actual import.\n');
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

async function importClient(mbClient, dryRun = false) {
  // Check if client already exists
  if (!dryRun) {
    const existing = await pool.query(
      'SELECT id FROM users WHERE mindbody_id = $1 OR email = $2',
      [mbClient.Id, mbClient.Email]
    );

    if (existing.rows.length > 0) {
      console.log(`⊘ Client ${mbClient.Id} already exists, skipping`);
      return;
    }
  }

  // Map Mindbody data to our schema
  const userData = {
    mindbody_id: mbClient.Id,
    email: mbClient.Email,
    first_name: mbClient.FirstName,
    last_name: mbClient.LastName,
    phone: mbClient.MobilePhone || mbClient.HomePhone || mbClient.WorkPhone,
    date_of_birth: mbClient.BirthDate ? new Date(mbClient.BirthDate) : null,
    address_line1: mbClient.AddressLine1,
    address_line2: mbClient.AddressLine2,
    city: mbClient.City,
    state: mbClient.State,
    zip: mbClient.PostalCode,
    email_opt_in: mbClient.PromotionalEmailOptIn || false,
    notifications_enabled: mbClient.EmailOptIn !== false, // Default true if not explicitly false
    sms_opt_in: false, // Will be updated in phase 2
    imported_from_mindbody: true,
    mindbody_import_date: new Date()
  };

  if (dryRun) {
    console.log(`[DRY RUN] Would import: ${userData.first_name} ${userData.last_name} (${userData.email})`);
    return;
  }

  // Generate temporary password (will be reset on first login)
  const tempPassword = await bcrypt.hash(Math.random().toString(36), 10);

  // Insert user
  const result = await pool.query(
    `INSERT INTO users (
      mindbody_id, email, password_hash, first_name, last_name, phone,
      date_of_birth, address_line1, address_line2, city, state, zip,
      email_opt_in, notifications_enabled, sms_opt_in,
      imported_from_mindbody, mindbody_import_date,
      password_reset_required, role, is_active
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20
    ) RETURNING id`,
    [
      userData.mindbody_id,
      userData.email,
      tempPassword,
      userData.first_name,
      userData.last_name,
      userData.phone,
      userData.date_of_birth,
      userData.address_line1,
      userData.address_line2,
      userData.city,
      userData.state,
      userData.zip,
      userData.email_opt_in,
      userData.notifications_enabled,
      userData.sms_opt_in,
      userData.imported_from_mindbody,
      userData.mindbody_import_date,
      true, // password_reset_required
      'member', // role
      true // is_active
    ]
  );

  console.log(`✓ Imported: ${userData.first_name} ${userData.last_name} (ID: ${result.rows[0].id})`);
}

// Run the import
if (require.main === module) {
  importClients()
    .then(() => {
      console.log('✓ Script completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('✗ Script failed:', err);
      process.exit(1);
    });
}

module.exports = { importClients };
