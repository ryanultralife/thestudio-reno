#!/usr/bin/env node

// Demo Data Population Script Runner
// Populates the database with realistic demo accounts for testing

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('❌ ERROR: DATABASE_URL environment variable not set');
  console.error('Usage: DATABASE_URL=your_database_url node populate-demo.js');
  process.exit(1);
}

async function populateDemoData() {
  const client = new Client({ connectionString: DATABASE_URL });

  try {
    console.log('🔌 Connecting to database...');
    await client.connect();
    console.log('✅ Connected');

    console.log('📝 Reading demo data SQL file...');
    const sqlPath = path.join(__dirname, 'seed-demo-data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('✅ File loaded');

    console.log('🚀 Executing demo data population...');
    console.log('   (This may take 30-60 seconds...)');
    await client.query(sql);

    console.log('');
    console.log('✅ Demo data populated successfully!');
    console.log('');
    console.log('🎉 You can now test with these accounts:');
    console.log('');
    console.log('📧 Demo Logins:');
    console.log('   Students:');
    console.log('   - emma.wilson@demo.com');
    console.log('   - michael.chen@demo.com');
    console.log('   - sofia.rodriguez@demo.com');
    console.log('   - james.patel@demo.com');
    console.log('   - olivia.taylor@demo.com');
    console.log('   - (10 more students available)');
    console.log('');
    console.log('   Teachers:');
    console.log('   - sarah.yoga@demo.com');
    console.log('   - raj.mindful@demo.com');
    console.log('   - lisa.power@demo.com');
    console.log('');
    console.log('   Password for all: demo123');
    console.log('');
    console.log('📊 Data Created:');
    console.log('   - 15 demo students with various memberships');
    console.log('   - 3 demo teachers');
    console.log('   - ~360 classes (90 days past + 30 days future)');
    console.log('   - Hundreds of bookings with realistic attendance');
    console.log('   - Co-op classes and transactions');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('❌ Error populating demo data:');
    console.error(error.message);
    if (error.stack) {
      console.error('');
      console.error('Stack trace:');
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await client.end();
    console.log('🔌 Database connection closed');
  }
}

// Run the population
populateDemoData();
