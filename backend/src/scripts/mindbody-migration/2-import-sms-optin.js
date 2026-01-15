#!/usr/bin/env node

// ============================================
// IMPORT SMS OPT-IN STATUS FROM CSV
// Phase 2: Import SMS opt-in status from Mindbody export
// ============================================

require('dotenv').config();
const fs = require('fs');
const { pool } = require('../../database/connection');
const { parse } = require('csv-parse/sync');

const DRY_RUN = process.argv.includes('--dry-run');
const PHASE = 'sms_optin';

// Get CSV file path from command line
const csvArg = process.argv.find(arg => arg.startsWith('--csv='));
const CSV_FILE = csvArg ? csvArg.split('=')[1] : null;

async function importSmsOptIn() {
  let stats = {
    total: 0,
    updated: 0,
    notFound: 0,
    failed: 0
  };

  try {
    console.log('\n' + '='.repeat(50));
    console.log('MINDBODY SMS OPT-IN IMPORT');
    console.log('='.repeat(50));
    console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
    console.log(`CSV File: ${CSV_FILE || 'NOT PROVIDED'}`);
    console.log('='.repeat(50) + '\n');

    if (!CSV_FILE) {
      throw new Error('CSV file path required. Use: --csv=/path/to/file.csv');
    }

    if (!fs.existsSync(CSV_FILE)) {
      throw new Error(`CSV file not found: ${CSV_FILE}`);
    }

    if (!DRY_RUN) {
      await pool.query(
        `UPDATE mindbody_migration_progress
         SET status = 'running', started_at = NOW()
         WHERE phase = $1`,
        [PHASE]
      );
    }

    // Read and parse CSV
    console.log('Reading CSV file...');
    const fileContent = fs.readFileSync(CSV_FILE, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    stats.total = records.length;
    console.log(`📊 Found ${stats.total} records in CSV\n`);

    if (!DRY_RUN) {
      await pool.query(
        `UPDATE mindbody_migration_progress
         SET records_total = $1
         WHERE phase = $2`,
        [stats.total, PHASE]
      );
    }

    // Expected CSV columns (adjust based on actual Mindbody export):
    // ClientId, Email, FirstName, LastName, SMSOptIn, MobilePhone
    // OR: Id, Email, FirstName, LastName, TextOptIn, Phone

    for (let i = 0; i < records.length; i++) {
      const record = records[i];

      try {
        // Extract relevant fields (column names may vary)
        const mindbodyId = record.ClientId || record.Id || record.client_id;
        const email = record.Email || record.email;
        const smsOptIn = parseSmsOptIn(record);

        if (!mindbodyId && !email) {
          console.warn(`⚠️  Row ${i + 1}: No identifier found, skipping`);
          stats.failed++;
          continue;
        }

        if (dryRun) {
          console.log(`[DRY RUN] Would update SMS opt-in for ${email || mindbodyId}: ${smsOptIn}`);
          stats.updated++;
          continue;
        }

        // Update user record
        const result = await pool.query(
          `UPDATE users
           SET sms_opt_in = $1
           WHERE (mindbody_id = $2 OR email = $3)
           AND imported_from_mindbody = true
           RETURNING id`,
          [smsOptIn, mindbodyId, email]
        );

        if (result.rowCount > 0) {
          stats.updated++;
          if (stats.updated % 100 === 0) {
            console.log(`Progress: ${stats.updated}/${stats.total}`);
          }
        } else {
          stats.notFound++;
          if (stats.notFound <= 10) { // Only log first 10
            console.warn(`⚠️  Not found: ${email || mindbodyId}`);
          }
        }

      } catch (err) {
        stats.failed++;
        console.error(`❌ Failed to process row ${i + 1}:`, err.message);
      }

      // Update progress every 100 records
      if (!DRY_RUN && (i + 1) % 100 === 0) {
        await pool.query(
          `UPDATE mindbody_migration_progress
           SET records_processed = $1, records_failed = $2
           WHERE phase = $3`,
          [stats.updated + stats.notFound, stats.failed, PHASE]
        );
      }
    }

    // Final status
    if (!DRY_RUN) {
      await pool.query(
        `UPDATE mindbody_migration_progress
         SET status = 'completed', completed_at = NOW(),
             records_processed = $1, records_failed = $2
         WHERE phase = $3`,
        [stats.updated + stats.notFound, stats.failed, PHASE]
      );
    }

    console.log('\n' + '='.repeat(50));
    console.log('IMPORT COMPLETE');
    console.log('='.repeat(50));
    console.log(`Total records: ${stats.total}`);
    console.log(`✓ Updated: ${stats.updated}`);
    console.log(`⊘ Not found: ${stats.notFound}`);
    console.log(`✗ Failed: ${stats.failed}`);
    console.log('='.repeat(50) + '\n');

    if (DRY_RUN) {
      console.log('This was a DRY RUN - no changes were made to the database.\n');
    }

    if (stats.notFound > 0) {
      console.log(`⚠️  ${stats.notFound} records could not be matched to existing users.`);
      console.log('   Make sure to run 1-import-clients.js first!\n');
    }

  } catch (err) {
    console.error('\n❌ Import failed:', err.message);
    if (!DRY_RUN) {
      await pool.query(
        `UPDATE mindbody_migration_progress
         SET status = 'failed', error_message = $1
         WHERE phase = $2`,
        [err.message, PHASE]
      );
    }
    throw err;
  } finally {
    await pool.end();
  }
}

// Parse SMS opt-in value from various possible column names/formats
function parseSmsOptIn(record) {
  // Try different possible column names
  const value = record.SMSOptIn
    || record.TextOptIn
    || record.sms_opt_in
    || record.text_opt_in
    || record['SMS Opt-In']
    || record['Text Opt-In'];

  if (value === undefined || value === null) {
    return false;
  }

  // Handle various truthy values
  const str = String(value).toLowerCase().trim();
  return str === 'true'
    || str === 'yes'
    || str === 'y'
    || str === '1'
    || str === 'opted in';
}

// Run the import
if (require.main === module) {
  importSmsOptIn()
    .then(() => {
      console.log('✓ Script completed successfully');
      process.exit(0);
    })
    .catch((err) => {
      console.error('✗ Script failed:', err);
      process.exit(1);
    });
}

module.exports = { importSmsOptIn };
