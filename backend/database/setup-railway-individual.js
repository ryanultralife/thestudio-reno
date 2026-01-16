// Railway Database Setup - Individual Migration Files
// Downloads and runs each migration file separately in correct order

const { Client } = require('pg');
const https = require('https');

const DATABASE_URL = 'postgresql://postgres:ucjBxgfmiOJlXSkjyCvLWILIuWVwVDBo@shinkansen.proxy.rlwy.net:14247/railway';
const GITHUB_BASE = 'https://raw.githubusercontent.com/ryanultralife/thestudio-reno/claude/start-website-i2qmc/backend/database/';

// Migration files in correct order
const MIGRATIONS = [
  'schema.sql',
  'seed.sql',
  'retail-schema.sql',
  'rentals-schema.sql',
  'cms-schema.sql',
  'campaigns-schema.sql',
  'theme-customization-schema.sql',
  'add-communication-preferences.sql',
  'update-campaign-opt-in-logic.sql',
  'mindbody-migration-schema.sql',
  'fix-webhook-replay-vulnerability.sql'
];

async function fetchFile(filename) {
  return new Promise((resolve, reject) => {
    const url = GITHUB_BASE + filename;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode} for ${filename}`));
        }
      });
    }).on('error', reject);
  });
}

async function runMigration(client, filename) {
  console.log(`\n📝 Running ${filename}...`);

  try {
    const sql = await fetchFile(filename);
    console.log(`   Downloaded ${sql.length} bytes`);

    // Split into statements
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.match(/^--/));

    let executed = 0;
    let skipped = 0;

    for (const statement of statements) {
      if (!statement || statement.length < 5) continue;

      try {
        await client.query(statement);
        executed++;
      } catch (error) {
        // Skip "already exists" and duplicate key errors
        if (error.message.includes('already exists') ||
            error.message.includes('duplicate key')) {
          skipped++;
        } else {
          console.error(`   ❌ Error: ${error.message}`);
          console.error(`   Statement: ${statement.substring(0, 150)}...`);
          throw error;
        }
      }
    }

    console.log(`   ✅ Completed (${executed} executed, ${skipped} skipped)`);
    return true;

  } catch (error) {
    console.error(`   ❌ Failed to process ${filename}:`, error.message);
    throw error;
  }
}

async function resetDatabase(client) {
  console.log('📝 Resetting database schema...');

  const resetSQL = `
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
    GRANT ALL ON SCHEMA public TO postgres;
    GRANT ALL ON SCHEMA public TO public;
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
    CREATE EXTENSION IF NOT EXISTS "pg_trgm";
  `;

  await client.query(resetSQL);
  console.log('✅ Database reset complete');
}

async function createAdminUser(client) {
  console.log('\n📝 Creating admin user...');

  const adminSQL = `
    INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
    VALUES (
      'admin@thestudio.com',
      '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eo6hJ7EQvU2u',
      'Admin',
      'User',
      'admin',
      true
    )
    ON CONFLICT (email) DO NOTHING
    RETURNING id, email, first_name, last_name, role;
  `;

  try {
    const result = await client.query(adminSQL);
    if (result.rows.length > 0) {
      console.log('✅ Admin user created:', result.rows[0]);
    } else {
      console.log('✅ Admin user already exists');
    }
  } catch (error) {
    console.error('❌ Failed to create admin user:', error.message);
    throw error;
  }
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

    // Step 1: Reset Database
    await resetDatabase(client);

    // Step 2: Run All Migrations
    console.log('\n📦 Running migrations...');
    for (let i = 0; i < MIGRATIONS.length; i++) {
      console.log(`\n[${i + 1}/${MIGRATIONS.length}] ${MIGRATIONS[i]}`);
      await runMigration(client, MIGRATIONS[i]);
    }

    // Step 3: Create Admin User
    await createAdminUser(client);

    // Success!
    console.log('\n' + '='.repeat(60));
    console.log('🎉 DATABASE SETUP COMPLETE!');
    console.log('='.repeat(60));
    console.log('\nYou can now login at:');
    console.log('👉 https://thestudio-reno-production.up.railway.app/staff\n');
    console.log('Login credentials:');
    console.log('  📧 Email: admin@thestudio.com');
    console.log('  🔑 Password: admin123\n');
    console.log('⚠️  IMPORTANT: Change the password immediately after first login!\n');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.error('\nThe database may be in a partial state.');
    console.error('You can re-run this script - it will reset and start fresh.');
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
