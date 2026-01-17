// API endpoint to populate demo data
// Mounted at: /api/setup-demo
// Public endpoint: POST /api/setup-demo/populate (no auth, only works once)
// Admin endpoint: POST /api/setup-demo/populate-admin (with auth, can repopulate)
// Status check: GET /api/setup-demo/status

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticate, requireRole } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

// Admin-only endpoint - can repopulate even if data exists
router.post('/populate-admin', authenticate, requireRole('admin'), async (req, res, next) => {
  const client = await db.getClient();

  try {
    console.log('📝 Admin requested demo data population...');

    // Run migrations first (if not already run)
    console.log('🔧 Running migrations...');

    const coopMigrationPath = path.join(__dirname, '../../database/add-coop-classes.sql');
    const seriesMigrationPath = path.join(__dirname, '../../database/add-class-series.sql');
    const paymentMigrationPath = path.join(__dirname, '../../database/add-teacher-payment-info.sql');

    try {
      const coopMigrationSql = fs.readFileSync(coopMigrationPath, 'utf8');
      await client.query(coopMigrationSql);
      console.log('  ✓ Co-op classes migration applied');
    } catch (err) {
      console.log('  ℹ️  Co-op migration already applied or error:', err.message);
    }

    try {
      const seriesMigrationSql = fs.readFileSync(seriesMigrationPath, 'utf8');
      await client.query(seriesMigrationSql);
      console.log('  ✓ Class series migration applied');
    } catch (err) {
      console.log('  ℹ️  Series migration already applied or error:', err.message);
    }

    try {
      const paymentMigrationSql = fs.readFileSync(paymentMigrationPath, 'utf8');
      await client.query(paymentMigrationSql);
      console.log('  ✓ Teacher payment info migration applied');
    } catch (err) {
      console.log('  ℹ️  Payment info migration already applied or error:', err.message);
    }

    // Read the demo data SQL file
    const sqlPath = path.join(__dirname, '../../database/seed-demo-data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Executing demo data population...');
    await client.query(sql);

    // Get counts
    const studentCount = await client.query(
      "SELECT COUNT(*) FROM users WHERE role = 'student' AND email LIKE '%@demo.com'"
    );
    const teacherCount = await client.query(
      "SELECT COUNT(*) FROM users WHERE role = 'teacher' AND email LIKE '%@demo.com'"
    );
    const classCount = await client.query(
      "SELECT COUNT(*) FROM classes WHERE date >= CURRENT_DATE - INTERVAL '90 days'"
    );
    const bookingCount = await client.query('SELECT COUNT(*) FROM bookings');

    console.log('✅ Demo data populated successfully');

    res.json({
      success: true,
      message: 'Demo data populated successfully',
      data: {
        students: parseInt(studentCount.rows[0].count),
        teachers: parseInt(teacherCount.rows[0].count),
        classes: parseInt(classCount.rows[0].count),
        bookings: parseInt(bookingCount.rows[0].count),
      },
      credentials: {
        students: [
          'emma.wilson@demo.com',
          'michael.chen@demo.com',
          'sofia.rodriguez@demo.com',
          '...and 12 more'
        ],
        teachers: [
          'sarah.yoga@demo.com',
          'raj.mindful@demo.com',
          'lisa.power@demo.com'
        ],
        password: 'demo123'
      }
    });

  } catch (error) {
    console.error('❌ Error populating demo data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to populate demo data'
    });
  } finally {
    client.release();
  }
});

// Check demo data status (admin only)
router.get('/status', authenticate, requireRole('admin'), async (req, res, next) => {
  try {
    const studentCount = await db.query(
      "SELECT COUNT(*) FROM users WHERE role = 'student' AND email LIKE '%@demo.com'"
    );
    const teacherCount = await db.query(
      "SELECT COUNT(*) FROM users WHERE role = 'teacher' AND email LIKE '%@demo.com'"
    );
    const classCount = await db.query(
      "SELECT COUNT(*) FROM classes WHERE date >= CURRENT_DATE - INTERVAL '90 days'"
    );
    const bookingCount = await db.query('SELECT COUNT(*) FROM bookings');

    res.json({
      demo_students: parseInt(studentCount.rows[0].count),
      demo_teachers: parseInt(teacherCount.rows[0].count),
      total_classes: parseInt(classCount.rows[0].count),
      total_bookings: parseInt(bookingCount.rows[0].count),
      is_populated: parseInt(studentCount.rows[0].count) > 0
    });

  } catch (error) {
    next(error);
  }
});

// Public endpoint that only works if no demo data exists (safety check)
router.post('/populate', async (req, res, next) => {
  const client = await db.getClient();

  try {
    // Safety check - only allow if no demo data exists
    const existingCheck = await client.query(
      "SELECT COUNT(*) FROM users WHERE email LIKE '%@demo.com'"
    );

    if (parseInt(existingCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        error: 'Demo data already exists. Use authenticated endpoint to re-populate.',
        existing_demo_users: parseInt(existingCheck.rows[0].count)
      });
    }

    console.log('📝 Public demo data population requested (first-time setup)...');

    // Run migrations first (if not already run)
    console.log('🔧 Running migrations...');

    const coopMigrationPath = path.join(__dirname, '../../database/add-coop-classes.sql');
    const seriesMigrationPath = path.join(__dirname, '../../database/add-class-series.sql');
    const paymentMigrationPath = path.join(__dirname, '../../database/add-teacher-payment-info.sql');

    try {
      const coopMigrationSql = fs.readFileSync(coopMigrationPath, 'utf8');
      await client.query(coopMigrationSql);
      console.log('  ✓ Co-op classes migration applied');
    } catch (err) {
      console.log('  ℹ️  Co-op migration already applied or error:', err.message);
    }

    try {
      const seriesMigrationSql = fs.readFileSync(seriesMigrationPath, 'utf8');
      await client.query(seriesMigrationSql);
      console.log('  ✓ Class series migration applied');
    } catch (err) {
      console.log('  ℹ️  Series migration already applied or error:', err.message);
    }

    try {
      const paymentMigrationSql = fs.readFileSync(paymentMigrationPath, 'utf8');
      await client.query(paymentMigrationSql);
      console.log('  ✓ Teacher payment info migration applied');
    } catch (err) {
      console.log('  ℹ️  Payment info migration already applied or error:', err.message);
    }

    // Read the demo data SQL file
    const sqlPath = path.join(__dirname, '../../database/seed-demo-data.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    console.log('🚀 Executing demo data population...');
    await client.query(sql);

    // Get counts
    const studentCount = await client.query(
      "SELECT COUNT(*) FROM users WHERE role = 'student' AND email LIKE '%@demo.com'"
    );
    const teacherCount = await client.query(
      "SELECT COUNT(*) FROM users WHERE role = 'teacher' AND email LIKE '%@demo.com'"
    );
    const classCount = await client.query(
      "SELECT COUNT(*) FROM classes WHERE date >= CURRENT_DATE - INTERVAL '90 days'"
    );
    const bookingCount = await client.query('SELECT COUNT(*) FROM bookings');

    console.log('✅ Demo data populated successfully');

    res.json({
      success: true,
      message: 'Demo data populated successfully',
      data: {
        students: parseInt(studentCount.rows[0].count),
        teachers: parseInt(teacherCount.rows[0].count),
        classes: parseInt(classCount.rows[0].count),
        bookings: parseInt(bookingCount.rows[0].count),
      },
      credentials: {
        students: [
          'emma.wilson@demo.com',
          'michael.chen@demo.com',
          'sofia.rodriguez@demo.com',
          '...and 12 more'
        ],
        teachers: [
          'sarah.yoga@demo.com',
          'raj.mindful@demo.com',
          'lisa.power@demo.com'
        ],
        password: 'demo123'
      }
    });

  } catch (error) {
    console.error('❌ Error populating demo data:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      message: 'Failed to populate demo data'
    });
  } finally {
    client.release();
  }
});

// Check admin user status
router.get('/admin-check', async (req, res, next) => {
  try {
    const admins = await db.query(`
      SELECT id, email, role, is_active
      FROM users
      WHERE role = 'admin' OR email LIKE '%admin%'
      ORDER BY created_at
    `);

    res.json({
      admin_users: admins.rows,
      note: 'Login credentials should be one of these emails with password: admin123'
    });
  } catch (error) {
    next(error);
  }
});

// Fix admin role (public endpoint for setup)
router.post('/fix-admin', async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    // Update user to admin role
    const result = await db.query(
      `UPDATE users SET role = 'admin', is_active = true WHERE email = $1 RETURNING id, email, role`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      message: 'User updated to admin role',
      user: result.rows[0]
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
