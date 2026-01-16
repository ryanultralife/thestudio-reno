// ============================================
// ONE-TIME SETUP ROUTE
// Run migrations and create admin user
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const fs = require('fs');
const path = require('path');

// GET version for browser access
router.get('/initialize', async (req, res) => {
  await runSetup(req, res);
});

// POST version for API calls
router.post('/initialize', async (req, res) => {
  await runSetup(req, res);
});

// Actual setup logic
async function runSetup(req, res) {
  try {
    // Check if already initialized
    const check = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name = 'users'
      );
    `);

    if (check.rows[0].exists) {
      return res.status(400).json({
        error: 'Database already initialized',
        message: 'Tables already exist. If you need to reset, do it manually in Railway.'
      });
    }

    console.log('🗄️  Starting database initialization...');

    // List of migration files in order
    const migrations = [
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

    // Run each migration file
    for (const migration of migrations) {
      const filePath = path.join(__dirname, '../../database', migration);
      console.log(`  Running ${migration}...`);

      const sql = fs.readFileSync(filePath, 'utf8');
      await db.query(sql);

      console.log(`  ✅ ${migration} completed`);
    }

    // Create default admin user
    console.log('  Creating admin user...');
    await db.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, role, is_active)
      VALUES (
        'admin@thestudio.com',
        '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5eo6hJ7EQvU2u',
        'Admin',
        'User',
        'admin',
        true
      );
    `);

    console.log('✅ Database initialization complete!');

    res.json({
      success: true,
      message: 'Database initialized successfully',
      next_steps: [
        'Login at /staff with admin@thestudio.com / admin123',
        'CHANGE THE ADMIN PASSWORD IMMEDIATELY',
        'Start adding classes and memberships'
      ]
    });

  } catch (error) {
    console.error('❌ Setup failed:', error);
    res.status(500).json({
      error: 'Setup failed',
      message: error.message,
      details: 'Check Railway logs for full error'
    });
  }
}

module.exports = router;
