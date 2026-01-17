// API endpoint to populate demo data
// Access via: POST /api/admin/populate-demo
// Requires admin authentication

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticate, requireRole } = require('../middleware/auth');
const fs = require('fs');
const path = require('path');

router.post('/populate-demo', authenticate, requireRole('admin'), async (req, res, next) => {
  const client = await db.getClient();

  try {
    console.log('📝 Admin requested demo data population...');

    // Read the demo data SQL file
    const sqlPath = path.join(__dirname, '../database/seed-demo-data.sql');
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

// Check demo data status
router.get('/demo-status', authenticate, requireRole('admin'), async (req, res, next) => {
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

module.exports = router;
