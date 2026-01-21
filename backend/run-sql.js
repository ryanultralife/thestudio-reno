#!/usr/bin/env node
// ============================================
// RUN SQL FILES USING NODE.JS
// Usage: node run-sql.js <sql-file>
// Example: node run-sql.js database/coop-seed.sql
// ============================================

require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const file = process.argv[2];

if (!file) {
  console.log('Usage: node run-sql.js <sql-file>');
  console.log('Example: node run-sql.js database/coop-seed.sql');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable not set');
  console.log('Set it in .env file or run:');
  console.log('  set DATABASE_URL=postgresql://...');
  process.exit(1);
}

const filePath = path.resolve(__dirname, file);

if (!fs.existsSync(filePath)) {
  console.error(`ERROR: File not found: ${filePath}`);
  process.exit(1);
}

const sql = fs.readFileSync(filePath, 'utf8');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  console.log(`Running: ${file}`);
  console.log(`Database: ${process.env.DATABASE_URL.split('@')[1]?.split('/')[0] || 'connected'}`);
  console.log('---');

  try {
    const result = await pool.query(sql);

    // Handle multiple result sets (from multiple SELECT statements)
    if (Array.isArray(result)) {
      result.forEach((r, i) => {
        if (r.rows && r.rows.length > 0) {
          console.table(r.rows);
        } else if (r.command) {
          console.log(`${r.command}: ${r.rowCount} rows`);
        }
      });
    } else if (result.rows && result.rows.length > 0) {
      console.table(result.rows);
    } else {
      console.log(`${result.command}: ${result.rowCount} rows affected`);
    }

    console.log('---');
    console.log('Done!');
  } catch (err) {
    console.error('SQL Error:', err.message);
    if (err.position) {
      const lines = sql.substring(0, parseInt(err.position)).split('\n');
      console.error(`Near line ${lines.length}`);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
