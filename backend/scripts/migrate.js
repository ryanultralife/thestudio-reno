#!/usr/bin/env node
// ============================================
// DATABASE MIGRATION RUNNER
// Runs SQL migration files against the database
// ============================================

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

console.log('=== Migration Runner Starting ===');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('DATABASE_URL exists:', !!process.env.DATABASE_URL);

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is not set!');
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function runMigration(filename) {
  const filePath = path.join(__dirname, '..', 'database', filename);

  if (!fs.existsSync(filePath)) {
    console.error(`Migration file not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Running migration: ${filename}`);

  const sql = fs.readFileSync(filePath, 'utf8');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log(`Migration completed: ${filename}`);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`Migration failed: ${filename}`);
    console.error(error.message);
    throw error;
  } finally {
    client.release();
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    // Run all migrations in order
    const migrations = [
      'schema.sql',
      'retail-schema.sql',
      'cms-schema.sql',
      'coop-schema.sql',
    ];

    for (const migration of migrations) {
      try {
        await runMigration(migration);
      } catch (error) {
        console.error(`Stopping due to error in ${migration}`);
        process.exit(1);
      }
    }
  } else {
    // Run specific migration(s)
    for (const filename of args) {
      try {
        await runMigration(filename);
      } catch (error) {
        process.exit(1);
      }
    }
  }

  await pool.end();
  console.log('All migrations completed successfully');
}

main().catch((error) => {
  console.error('Migration runner failed:', error);
  process.exit(1);
});
