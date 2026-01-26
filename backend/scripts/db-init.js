#!/usr/bin/env node
/**
 * Database initialization script for Railway deployment
 * Uses Node.js pg library instead of psql CLI tool
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const schemaFiles = [
  'schema.sql',
  'retail-schema.sql',
  'cms-schema.sql',
  'coop-schema.sql',
  'seed.sql'
];

async function initDatabase() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'false'
      ? { rejectUnauthorized: false }
      : undefined
  });

  console.log('Starting database initialization...');

  try {
    for (const file of schemaFiles) {
      const filePath = path.join(__dirname, '..', 'database', file);

      if (!fs.existsSync(filePath)) {
        console.log(`Skipping ${file} (not found)`);
        continue;
      }

      console.log(`Executing ${file}...`);
      const sql = fs.readFileSync(filePath, 'utf8');

      await pool.query(sql);
      console.log(`  ✓ ${file} completed`);
    }

    console.log('\nDatabase initialization completed successfully!');
  } catch (error) {
    console.error('Database initialization failed:', error.message);
    // Don't exit with error - let the app try to start anyway
    // The tables might already exist from a previous run
    if (error.message.includes('already exists')) {
      console.log('Tables already exist - continuing...');
    } else {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

initDatabase();
