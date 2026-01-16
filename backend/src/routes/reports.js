// ============================================
// REPORTS ROUTES
// ============================================

const express = require('express');
const db = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// ============================================
// DASHBOARD METRICS (Front Desk+)
// ============================================

router.get('/dashboard', requirePermission('report.basic'), async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Today's classes
    const classesToday = await db.query(`
      SELECT COUNT(*) as total,
             COUNT(*) FILTER (WHERE is_cancelled = false) as active
      FROM classes WHERE date = $1
    `, [today]);

    // Today's bookings
    const bookingsToday = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE b.status = 'checked_in') as checked_in
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      WHERE c.date = $1 AND b.status IN ('booked', 'checked_in')
    `, [today]);

    // Active memberships
    const activeMemberships = await db.query(`
      SELECT COUNT(*) FROM user_memberships WHERE status = 'active'
    `);

    // New members this week
    const newThisWeek = await db.query(`
      SELECT COUNT(*) FROM users 
      WHERE role = 'student' AND created_at >= CURRENT_DATE - INTERVAL '7 days'
    `);

    // Expiring memberships (next 7 days)
    const expiringMemberships = await db.query(`
      SELECT COUNT(*) FROM user_memberships
      WHERE status = 'active' AND end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
    `);

    res.json({
      today: {
        classes: parseInt(classesToday.rows[0].active),
        bookings: parseInt(bookingsToday.rows[0].total),
        checked_in: parseInt(bookingsToday.rows[0].checked_in),
      },
      memberships: {
        active: parseInt(activeMemberships.rows[0].count),
        expiring_soon: parseInt(expiringMemberships.rows[0].count),
      },
      new_members_this_week: parseInt(newThisWeek.rows[0].count),
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// ATTENDANCE REPORT (Manager+)
// ============================================

router.get('/attendance', requirePermission('report.basic'), async (req, res, next) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const groupExpr = group_by === 'week' 
      ? "DATE_TRUNC('week', c.date)::date"
      : group_by === 'month' 
        ? "DATE_TRUNC('month', c.date)::date"
        : 'c.date';

    const result = await db.query(`
      SELECT 
        ${groupExpr} as period,
        COUNT(DISTINCT c.id) as classes_held,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_attendance,
        ROUND(AVG(
          CASE WHEN c.capacity > 0 
          THEN (COUNT(b.id) FILTER (WHERE b.status = 'checked_in'))::numeric / c.capacity * 100 
          END
        ), 1) as avg_fill_rate
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.date BETWEEN $1 AND $2 AND c.is_cancelled = false
      GROUP BY ${groupExpr}
      ORDER BY period
    `, [startDate, endDate]);

    res.json({
      start_date: startDate,
      end_date: endDate,
      group_by,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CLASS POPULARITY REPORT
// ============================================

router.get('/class-popularity', requirePermission('report.basic'), async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT 
        ct.name as class_type,
        ct.category,
        COUNT(DISTINCT c.id) as classes_held,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_attendance,
        ROUND(COUNT(b.id) FILTER (WHERE b.status = 'checked_in')::numeric / NULLIF(COUNT(DISTINCT c.id), 0), 1) as avg_per_class,
        ROUND(AVG(
          CASE WHEN c.capacity > 0 
          THEN (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in')::numeric / c.capacity * 100 
          END
        ), 1) as avg_fill_rate
      FROM class_types ct
      LEFT JOIN classes c ON c.class_type_id = ct.id AND c.date BETWEEN $1 AND $2 AND c.is_cancelled = false
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE ct.is_active = true
      GROUP BY ct.id
      ORDER BY total_attendance DESC
    `, [startDate, endDate]);

    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TEACHER STATS
// ============================================

router.get('/teachers', requirePermission('report.basic'), async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT 
        u.first_name, u.last_name,
        COUNT(DISTINCT c.id) as classes_taught,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_students,
        ROUND(COUNT(b.id) FILTER (WHERE b.status = 'checked_in')::numeric / NULLIF(COUNT(DISTINCT c.id), 0), 1) as avg_per_class
      FROM teachers t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN classes c ON c.teacher_id = t.id AND c.date BETWEEN $1 AND $2 AND c.is_cancelled = false
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE t.is_active = true
      GROUP BY t.id, u.first_name, u.last_name
      ORDER BY total_students DESC
    `, [startDate, endDate]);

    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REVENUE REPORT (Manager+ with financial permission)
// ============================================

router.get('/revenue', requirePermission('report.financial'), async (req, res, next) => {
  try {
    const { start_date, end_date, group_by = 'day' } = req.query;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const groupExpr = group_by === 'week' 
      ? "DATE_TRUNC('week', created_at)::date"
      : group_by === 'month' 
        ? "DATE_TRUNC('month', created_at)::date"
        : 'DATE(created_at)';

    const result = await db.query(`
      SELECT 
        ${groupExpr} as period,
        COUNT(*) FILTER (WHERE type = 'membership_purchase') as sales_count,
        SUM(total) FILTER (WHERE type != 'refund') as revenue,
        SUM(total) FILTER (WHERE type = 'refund') as refunds
      FROM transactions
      WHERE created_at BETWEEN $1 AND $2 AND status = 'completed'
      GROUP BY ${groupExpr}
      ORDER BY period
    `, [startDate, endDate]);

    // Summary
    const summary = await db.query(`
      SELECT 
        SUM(total) FILTER (WHERE type != 'refund') as total_revenue,
        SUM(total) FILTER (WHERE type = 'refund') as total_refunds,
        COUNT(*) FILTER (WHERE type = 'membership_purchase') as total_sales
      FROM transactions
      WHERE created_at BETWEEN $1 AND $2 AND status = 'completed'
    `, [startDate, endDate]);

    res.json({
      start_date: startDate,
      end_date: endDate,
      summary: summary.rows[0],
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// REVENUE BY PRODUCT
// ============================================

router.get('/revenue/by-product', requirePermission('report.financial'), async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT 
        mt.name as product,
        mt.type,
        mt.price as unit_price,
        COUNT(t.id) as quantity_sold,
        SUM(t.total) as total_revenue
      FROM transactions t
      JOIN membership_types mt ON t.membership_type_id = mt.id
      WHERE t.type = 'membership_purchase' 
        AND t.status = 'completed'
        AND t.created_at BETWEEN $1 AND $2
      GROUP BY mt.id
      ORDER BY total_revenue DESC
    `, [startDate, endDate]);

    res.json({ data: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// AT-RISK MEMBERS
// ============================================

router.get('/at-risk', requirePermission('report.basic'), async (req, res, next) => {
  try {
    const { inactive_days = 21 } = req.query;

    const result = await db.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone,
        mt.name as membership,
        um.end_date as expires,
        um.credits_remaining,
        MAX(c.date) as last_visit,
        CURRENT_DATE - MAX(c.date) as days_since_visit
      FROM users u
      JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
      JOIN membership_types mt ON mt.id = um.membership_type_id
      LEFT JOIN bookings b ON b.user_id = u.id AND b.status = 'checked_in'
      LEFT JOIN classes c ON b.class_id = c.id
      WHERE u.role = 'student' AND u.is_active = true
      GROUP BY u.id, mt.name, um.end_date, um.credits_remaining
      HAVING MAX(c.date) < CURRENT_DATE - $1::int OR MAX(c.date) IS NULL
      ORDER BY last_visit NULLS FIRST
    `, [inactive_days]);

    res.json({ 
      inactive_days,
      count: result.rows.length,
      members: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// EXPIRING MEMBERSHIPS
// ============================================

router.get('/expiring', requirePermission('report.basic'), async (req, res, next) => {
  try {
    const { days = 14 } = req.query;

    const result = await db.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone,
        mt.name as membership,
        um.end_date,
        um.end_date - CURRENT_DATE as days_until_expiry,
        um.credits_remaining
      FROM user_memberships um
      JOIN users u ON um.user_id = u.id
      JOIN membership_types mt ON um.membership_type_id = mt.id
      WHERE um.status = 'active'
        AND um.end_date IS NOT NULL
        AND um.end_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $1::int
      ORDER BY um.end_date
    `, [days]);

    res.json({ 
      days_ahead: days,
      count: result.rows.length,
      memberships: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// NEW MEMBERS
// ============================================

router.get('/new-members', requirePermission('report.basic'), async (req, res, next) => {
  try {
    const { days = 30 } = req.query;

    const result = await db.query(`
      SELECT 
        u.id, u.first_name, u.last_name, u.email, u.phone,
        u.created_at as joined,
        mt.name as first_membership,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as classes_attended
      FROM users u
      LEFT JOIN transactions t ON t.user_id = u.id AND t.type = 'membership_purchase'
      LEFT JOIN membership_types mt ON mt.id = t.membership_type_id
      LEFT JOIN bookings b ON b.user_id = u.id
      WHERE u.role = 'student' 
        AND u.created_at >= CURRENT_DATE - $1::int
      GROUP BY u.id, mt.name, t.created_at
      ORDER BY u.created_at DESC
    `, [days]);

    res.json({ 
      days,
      count: result.rows.length,
      members: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CUSTOM QUERY (Admin only)
// ============================================
// DISABLED FOR SECURITY: Raw SQL queries pose SQL injection risk
// TODO: Replace with safe query builder or remove entirely

/*
router.post('/query', requirePermission('report.custom'), async (req, res, next) => {
  try {
    const { query } = req.body;

    // Basic safety check - no writes
    const lowerQuery = query.toLowerCase().trim();
    if (!lowerQuery.startsWith('select')) {
      return res.status(400).json({ error: 'Only SELECT queries allowed' });
    }

    if (lowerQuery.includes('drop') || lowerQuery.includes('delete') ||
        lowerQuery.includes('update') || lowerQuery.includes('insert') ||
        lowerQuery.includes('truncate') || lowerQuery.includes('alter')) {
      return res.status(400).json({ error: 'Query contains forbidden keywords' });
    }

    const result = await db.query(query);

    res.json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map(f => f.name),
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
*/

module.exports = router;
