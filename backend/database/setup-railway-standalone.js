// Railway Database Setup - Standalone Script
// This script contains all SQL inline, no external files needed
// Just run: node setup-railway-standalone.js

const { Client } = require('pg');

const DATABASE_URL = 'postgresql://postgres:ucjBxgfmiOJlXSkjyCvLWILIuWVwVDBo@shinkansen.proxy.rlwy.net:14247/railway';

// SQL Scripts embedded inline
const RESET_SQL = `
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON SCHEMA public TO public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
`;

const ADMIN_USER_SQL = `
INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
VALUES (
  'admin@thestudio.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eo6hJ7EQvU2u',
  'Admin',
  'User',
  'admin',
  true
)
ON CONFLICT (email) DO NOTHING;

SELECT id, email, first_name, last_name, role, is_active
FROM users
WHERE email = 'admin@thestudio.com';
`;

async function runSQL(client, sql, description) {
  console.log(`📝 ${description}...`);
  try {
    await client.query(sql);
    console.log(`✅ ${description} completed`);
    return true;
  } catch (error) {
    console.error(`❌ Error in ${description}:`, error.message);
    throw error;
  }
}

async function fetchCompleteMigration() {
  console.log('📥 Fetching complete migration SQL from GitHub...');
  const https = require('https');

  return new Promise((resolve, reject) => {
    const url = 'https://raw.githubusercontent.com/ryanultralife/thestudio-reno/claude/start-website-i2qmc/backend/database/complete-migration.sql';

    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ Migration SQL downloaded');
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    }).on('error', reject);
  });
}

async function setup() {
  console.log('🗄️  Railway Database Setup Starting...\n');

  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔌 Connecting to Railway PostgreSQL...');
    await client.connect();
    console.log('✅ Connected\n');

    // Step 1: Reset Schema
    console.log('Step 1: Resetting database schema...');
    await runSQL(client, RESET_SQL, 'Schema reset');
    console.log('');

    // Step 2: Run Complete Migration
    console.log('Step 2: Running complete migration (downloading from GitHub)...');
    const migrationSQL = await fetchCompleteMigration();
    await runSQL(client, migrationSQL, 'Complete migration');
    console.log('');

    // Step 3: Create Admin User
    console.log('Step 3: Creating admin user...');
    await runSQL(client, ADMIN_USER_SQL, 'Admin user creation');
    console.log('');

    console.log('🎉 Database setup complete!\n');
    console.log('You can now login at:');
    console.log('https://thestudio-reno-production.up.railway.app/staff\n');
    console.log('Login credentials:');
    console.log('  Email: admin@thestudio.com');
    console.log('  Password: admin123\n');
    console.log('⚠️  CHANGE THE PASSWORD IMMEDIATELY AFTER FIRST LOGIN');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
