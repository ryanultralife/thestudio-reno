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
    console.log('🗄️  Running database migrations (safe to re-run)...');

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
    const results = [];
    for (const migration of migrations) {
      try {
        const filePath = path.join(__dirname, '../../database', migration);
        console.log(`  Running ${migration}...`);

        const sql = fs.readFileSync(filePath, 'utf8');

        // Split SQL by statement and run each separately
        // This allows us to continue past "already exists" errors
        const statements = sql.split(';').filter(s => s.trim());

        for (const statement of statements) {
          if (statement.trim()) {
            try {
              await db.query(statement);
            } catch (err) {
              // Ignore "already exists" errors, but fail on others
              if (!err.message.includes('already exists')) {
                throw err;
              }
            }
          }
        }

        console.log(`  ✅ ${migration} completed`);
        results.push({ file: migration, status: 'success' });
      } catch (error) {
        console.error(`  ❌ ${migration} failed:`, error.message);
        results.push({ file: migration, status: 'failed', error: error.message });
        throw error; // Stop on first real error
      }
    }

    // Create default admin user (skip if already exists)
    console.log('  Creating admin user...');
    try {
      await db.query(`
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
      `);
      console.log('  ✅ Admin user ready');
    } catch (err) {
      console.log('  ⚠️  Admin user already exists');
    }

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
