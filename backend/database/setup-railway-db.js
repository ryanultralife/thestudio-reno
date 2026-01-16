// Railway Database Setup Script for Windows
// Run with: node setup-railway-db.js

const fs = require('fs');
const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:ucjBxgfmiOJlXSkjyCvLWILIuWVwVDBo@shinkansen.proxy.rlwy.net:14247/railway';

async function runSQLFile(client, filename) {
  console.log(`📝 Running ${filename}...`);
  const sql = fs.readFileSync(filename, 'utf8');

  try {
    await client.query(sql);
    console.log(`✅ ${filename} completed successfully`);
    return true;
  } catch (error) {
    console.error(`❌ Error in ${filename}:`, error.message);
    return false;
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

    // Step 1: Reset Schema
    console.log('Step 1: Resetting database schema...');
    await runSQLFile(client, '00-reset-schema.sql');
    console.log('');

    // Step 2: Run Complete Migration
    console.log('Step 2: Running complete migration (this may take a minute)...');
    await runSQLFile(client, 'complete-migration.sql');
    console.log('');

    // Step 3: Create Admin User
    console.log('Step 3: Creating admin user...');
    await runSQLFile(client, '99-create-admin.sql');
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
    process.exit(1);
  } finally {
    await client.end();
  }
}

setup();
