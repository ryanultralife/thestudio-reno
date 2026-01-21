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
// MY STATS (Teacher self-service)
// ============================================

router.get('/my-stats', authenticate, async (req, res, next) => {
  try {
    // Find teacher record for current user
    const teacherResult = await db.query(
      'SELECT id, is_coop_teacher, coop_tier FROM teachers WHERE user_id = $1',
      [req.user.id]
    );

    if (teacherResult.rows.length === 0) {
      return res.status(403).json({ error: 'Teacher profile not found' });
    }

    const teacher = teacherResult.rows[0];
    const { start_date, end_date } = req.query;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    // Get class stats
    const classStats = await db.query(`
      SELECT
        COUNT(DISTINCT c.id) as classes_taught,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_students,
        ROUND(COUNT(b.id) FILTER (WHERE b.status = 'checked_in')::numeric / NULLIF(COUNT(DISTINCT c.id), 0), 1) as avg_per_class,
        COUNT(DISTINCT c.id) FILTER (WHERE c.class_model IN ('coop_rental', 'monthly_tenant')) as coop_classes,
        COUNT(DISTINCT c.id) FILTER (WHERE c.class_model = 'traditional' OR c.class_model IS NULL) as traditional_classes
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.date BETWEEN $2 AND $3
        AND c.is_cancelled = false
    `, [teacher.id, startDate, endDate]);

    // Get upcoming classes
    const upcomingClasses = await db.query(`
      SELECT
        c.id, c.date, c.start_time, c.end_time, c.class_model,
        c.coop_drop_in_price, c.coop_member_price,
        ct.name as class_name,
        l.name as location,
        c.capacity,
        COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as booked
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.date >= CURRENT_DATE
        AND c.is_cancelled = false
      GROUP BY c.id, ct.id, l.id
      ORDER BY c.date, c.start_time
      LIMIT 10
    `, [teacher.id]);

    // Get co-op revenue (if co-op teacher)
    let coopRevenue = null;
    if (teacher.is_coop_teacher || teacher.coop_tier) {
      const revenueResult = await db.query(`
        SELECT
          SUM(cb.final_price) FILTER (WHERE cb.payment_status = 'paid') as total_revenue,
          COUNT(cb.id) as total_bookings,
          COUNT(cb.id) FILTER (WHERE cb.used_coop_credit = true) as credit_bookings
        FROM coop_bookings cb
        JOIN classes c ON cb.class_id = c.id
        WHERE c.teacher_id = $1
          AND c.date BETWEEN $2 AND $3
      `, [teacher.id, startDate, endDate]);
      coopRevenue = revenueResult.rows[0];
    }

    // Get class breakdown by type
    const byClassType = await db.query(`
      SELECT
        ct.name as class_type,
        COUNT(DISTINCT c.id) as classes,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as students
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.date BETWEEN $2 AND $3
        AND c.is_cancelled = false
      GROUP BY ct.id
      ORDER BY classes DESC
    `, [teacher.id, startDate, endDate]);

    res.json({
      period: { start_date: startDate, end_date: endDate },
      is_coop_teacher: teacher.is_coop_teacher || !!teacher.coop_tier,
      coop_tier: teacher.coop_tier,
      summary: classStats.rows[0],
      upcoming_classes: upcomingClasses.rows,
      by_class_type: byClassType.rows,
      coop_revenue: coopRevenue,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// TEACHER STATS (Staff view)
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
// CUSTOM QUERY (Admin only) - DISABLED FOR SECURITY
// Use predefined report queries instead
// ============================================

// Predefined safe report queries
const ALLOWED_REPORTS = {
  'active_members': `
    SELECT u.id, u.email, u.first_name, u.last_name, u.role, u.created_at,
           m.name as membership_name, um.start_date, um.end_date
    FROM users u
    LEFT JOIN user_memberships um ON um.user_id = u.id AND um.status = 'active'
    LEFT JOIN membership_types m ON m.id = um.membership_type_id
    WHERE u.is_active = true
    ORDER BY u.last_name, u.first_name
  `,
  'revenue_by_month': `
    SELECT DATE_TRUNC('month', created_at) as month,
           SUM(total) as total_revenue,
           COUNT(*) as transaction_count
    FROM transactions
    WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '12 months'
    GROUP BY DATE_TRUNC('month', created_at)
    ORDER BY month DESC
  `,
  'class_popularity': `
    SELECT ct.name as class_type, ct.category, ct.color,
           COUNT(b.id) as bookings,
           COUNT(DISTINCT c.id) as classes_offered,
           ROUND(COUNT(b.id)::numeric / NULLIF(COUNT(DISTINCT c.id), 0), 1) as avg_per_class,
           COUNT(DISTINCT c.id) FILTER (WHERE c.class_model IN ('coop_rental', 'monthly_tenant')) as coop_classes,
           COUNT(DISTINCT c.id) FILTER (WHERE c.class_model = 'traditional' OR c.class_model IS NULL) as traditional_classes
    FROM class_types ct
    LEFT JOIN classes c ON c.class_type_id = ct.id AND c.date >= NOW() - INTERVAL '30 days'
    LEFT JOIN bookings b ON b.class_id = c.id AND b.status IN ('booked', 'checked_in')
    WHERE ct.is_active = true
    GROUP BY ct.id, ct.name, ct.category, ct.color
    ORDER BY bookings DESC
  `,
  'teacher_stats': `
    SELECT t.id, u.first_name, u.last_name, t.title,
           COALESCE(t.is_coop_teacher, false) as is_coop_teacher,
           t.coop_tier,
           COUNT(DISTINCT c.id) as classes_taught,
           COUNT(DISTINCT c.id) FILTER (WHERE c.class_model IN ('coop_rental', 'monthly_tenant')) as coop_classes,
           COUNT(DISTINCT c.id) FILTER (WHERE c.class_model = 'traditional' OR c.class_model IS NULL) as traditional_classes,
           COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_students,
           ROUND(COUNT(b.id)::numeric / NULLIF(COUNT(DISTINCT c.id), 0), 1) as avg_per_class
    FROM teachers t
    JOIN users u ON u.id = t.user_id
    LEFT JOIN classes c ON c.teacher_id = t.id AND c.date >= NOW() - INTERVAL '30 days' AND c.is_cancelled = false
    LEFT JOIN bookings b ON b.class_id = c.id
    WHERE t.is_active = true
    GROUP BY t.id, u.first_name, u.last_name, t.title, t.is_coop_teacher, t.coop_tier
    ORDER BY classes_taught DESC
  `,
  'peak_hours': `
    SELECT
      EXTRACT(HOUR FROM c.start_time) as hour,
      TO_CHAR(c.start_time, 'HH12:MI AM') as time_label,
      COUNT(DISTINCT c.id) as classes,
      COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_attendance,
      ROUND(AVG(
        CASE WHEN c.capacity > 0
        THEN (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in')::numeric / c.capacity * 100
        END
      ), 1) as avg_fill_rate
    FROM classes c
    LEFT JOIN bookings b ON b.class_id = c.id
    WHERE c.date >= NOW() - INTERVAL '30 days' AND c.is_cancelled = false
    GROUP BY EXTRACT(HOUR FROM c.start_time), TO_CHAR(c.start_time, 'HH12:MI AM')
    ORDER BY hour
  `,
  'day_of_week_analysis': `
    SELECT
      EXTRACT(DOW FROM c.date) as day_num,
      TO_CHAR(c.date, 'Day') as day_name,
      COUNT(DISTINCT c.id) as classes,
      COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_attendance,
      ROUND(AVG(
        CASE WHEN c.capacity > 0
        THEN (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in')::numeric / c.capacity * 100
        END
      ), 1) as avg_fill_rate
    FROM classes c
    LEFT JOIN bookings b ON b.class_id = c.id
    WHERE c.date >= NOW() - INTERVAL '30 days' AND c.is_cancelled = false
    GROUP BY EXTRACT(DOW FROM c.date), TO_CHAR(c.date, 'Day')
    ORDER BY day_num
  `,
  'membership_distribution': `
    SELECT
      mt.name as membership_type,
      mt.type as membership_category,
      mt.price,
      COUNT(um.id) as active_count,
      SUM(um.credits_remaining) as total_credits_remaining
    FROM membership_types mt
    LEFT JOIN user_memberships um ON um.membership_type_id = mt.id AND um.status = 'active'
    WHERE mt.is_active = true
    GROUP BY mt.id, mt.name, mt.type, mt.price
    ORDER BY active_count DESC
  `,
  'revenue_by_payment_method': `
    SELECT
      payment_method,
      COUNT(*) as transactions,
      SUM(total) as total_revenue,
      ROUND(AVG(total), 2) as avg_transaction
    FROM transactions
    WHERE status = 'completed' AND created_at >= NOW() - INTERVAL '30 days'
    GROUP BY payment_method
    ORDER BY total_revenue DESC
  `,
  'first_timers': `
    SELECT
      u.id, u.first_name, u.last_name, u.email, u.phone,
      u.created_at as joined,
      MIN(c.date) as first_class_date,
      ct.name as first_class_type,
      COUNT(DISTINCT b.id) as total_classes_booked
    FROM users u
    JOIN bookings b ON b.user_id = u.id
    JOIN classes c ON b.class_id = c.id
    JOIN class_types ct ON c.class_type_id = ct.id
    WHERE u.role = 'student'
      AND u.created_at >= NOW() - INTERVAL '30 days'
      AND b.status IN ('booked', 'checked_in')
    GROUP BY u.id, u.first_name, u.last_name, u.email, u.phone, u.created_at, ct.name
    ORDER BY u.created_at DESC
  `,
  'no_shows': `
    SELECT
      u.id, u.first_name, u.last_name, u.email,
      COUNT(*) as no_show_count,
      MAX(c.date) as last_no_show_date
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    JOIN classes c ON b.class_id = c.id
    WHERE b.status = 'no_show' AND c.date >= NOW() - INTERVAL '30 days'
    GROUP BY u.id, u.first_name, u.last_name, u.email
    HAVING COUNT(*) >= 2
    ORDER BY no_show_count DESC
  `,
  'credits_low': `
    SELECT
      u.id, u.first_name, u.last_name, u.email, u.phone,
      mt.name as membership,
      um.credits_remaining,
      um.end_date
    FROM user_memberships um
    JOIN users u ON um.user_id = u.id
    JOIN membership_types mt ON um.membership_type_id = mt.id
    WHERE um.status = 'active'
      AND mt.type = 'credits'
      AND um.credits_remaining <= 3
      AND um.credits_remaining > 0
    ORDER BY um.credits_remaining, u.last_name
  `,
  // Co-op specific reports
  'coop_classes': `
    SELECT
      c.id, c.date, c.start_time, c.end_time, c.class_model,
      c.coop_drop_in_price, c.coop_member_price,
      ct.name as class_name, ct.category,
      u.first_name as teacher_first, u.last_name as teacher_last, t.title as teacher_title,
      l.name as location, r.name as room,
      c.capacity,
      COUNT(b.id) FILTER (WHERE b.status IN ('booked', 'checked_in')) as booked,
      COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as attended
    FROM classes c
    JOIN class_types ct ON c.class_type_id = ct.id
    JOIN teachers t ON c.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    JOIN locations l ON c.location_id = l.id
    LEFT JOIN rooms r ON c.room_id = r.id
    LEFT JOIN bookings b ON b.class_id = c.id
    WHERE c.class_model IN ('coop_rental', 'monthly_tenant')
      AND c.date >= NOW() - INTERVAL '30 days'
    GROUP BY c.id, ct.id, t.id, u.id, l.id, r.id
    ORDER BY c.date DESC, c.start_time
  `,
  'coop_teacher_stats': `
    SELECT
      t.id as teacher_id,
      u.first_name, u.last_name, t.title,
      t.coop_tier,
      COUNT(DISTINCT c.id) as classes_taught,
      COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_students,
      ROUND(COUNT(b.id)::numeric / NULLIF(COUNT(DISTINCT c.id), 0), 1) as avg_per_class,
      SUM(c.coop_drop_in_price * (SELECT COUNT(*) FROM coop_bookings cb WHERE cb.class_id = c.id AND cb.payment_status = 'paid')) as estimated_revenue
    FROM teachers t
    JOIN users u ON t.user_id = u.id
    LEFT JOIN classes c ON c.teacher_id = t.id
      AND c.class_model IN ('coop_rental', 'monthly_tenant')
      AND c.date >= NOW() - INTERVAL '30 days'
      AND c.is_cancelled = false
    LEFT JOIN bookings b ON b.class_id = c.id
    WHERE t.is_coop_teacher = true OR t.coop_tier IS NOT NULL
    GROUP BY t.id, u.first_name, u.last_name, t.title, t.coop_tier
    ORDER BY classes_taught DESC
  `,
  'coop_revenue': `
    SELECT
      DATE_TRUNC('week', t.created_at)::date as week,
      COUNT(DISTINCT cb.class_id) as classes,
      COUNT(cb.id) as bookings,
      SUM(cb.final_price) FILTER (WHERE cb.payment_status = 'paid') as student_revenue,
      SUM(rb.rental_price) FILTER (WHERE rb.payment_status = 'paid') as rental_revenue
    FROM coop_bookings cb
    LEFT JOIN transactions t ON t.coop_booking_id = cb.id
    LEFT JOIN classes c ON cb.class_id = c.id
    LEFT JOIN room_bookings rb ON c.room_booking_id = rb.id
    WHERE t.created_at >= NOW() - INTERVAL '12 weeks'
    GROUP BY DATE_TRUNC('week', t.created_at)
    ORDER BY week DESC
  `,
  'coop_room_utilization': `
    SELECT
      r.id as room_id,
      r.name as room_name,
      l.name as location,
      r.room_type,
      COUNT(DISTINCT rb.id) as total_bookings,
      COUNT(DISTINCT rb.id) FILTER (WHERE rb.status = 'completed') as completed,
      SUM(rb.rental_price) FILTER (WHERE rb.payment_status = 'paid') as total_revenue,
      mrc.tenant_name as current_tenant
    FROM rooms r
    JOIN locations l ON r.location_id = l.id
    LEFT JOIN room_bookings rb ON rb.room_id = r.id AND rb.date >= NOW() - INTERVAL '30 days'
    LEFT JOIN monthly_rental_contracts mrc ON mrc.room_id = r.id AND mrc.status = 'active'
    WHERE r.available_for_rental = true
    GROUP BY r.id, r.name, l.name, r.room_type, mrc.tenant_name
    ORDER BY total_bookings DESC
  `
};

// Report metadata for frontend display
const REPORT_METADATA = {
  'active_members': { name: 'Active Members', description: 'All members with active memberships', category: 'members' },
  'revenue_by_month': { name: 'Revenue by Month', description: 'Monthly revenue for the past 12 months', category: 'financial' },
  'class_popularity': { name: 'Class Popularity', description: 'Most popular class types by attendance', category: 'classes' },
  'teacher_stats': { name: 'Teacher Statistics', description: 'Classes taught and student counts by teacher', category: 'classes' },
  'peak_hours': { name: 'Peak Hours', description: 'Busiest hours by attendance and fill rate', category: 'classes' },
  'day_of_week_analysis': { name: 'Day of Week Analysis', description: 'Attendance patterns by day of week', category: 'classes' },
  'membership_distribution': { name: 'Membership Distribution', description: 'Active memberships by type', category: 'members' },
  'revenue_by_payment_method': { name: 'Revenue by Payment Method', description: 'Sales breakdown by payment type', category: 'financial' },
  'first_timers': { name: 'First-Time Members', description: 'New members from the past 30 days', category: 'members' },
  'no_shows': { name: 'No-Show Report', description: 'Members with 2+ no-shows in past 30 days', category: 'members' },
  'credits_low': { name: 'Low Credits Alert', description: 'Members with 3 or fewer credits remaining', category: 'members' },
  // Co-op reports
  'coop_classes': { name: 'Co-op Classes', description: 'All co-op rental and monthly tenant classes', category: 'coop' },
  'coop_teacher_stats': { name: 'Co-op Teacher Stats', description: 'Performance metrics for co-op teachers', category: 'coop' },
  'coop_revenue': { name: 'Co-op Revenue', description: 'Weekly co-op class and rental revenue', category: 'coop' },
  'coop_room_utilization': { name: 'Room Utilization', description: 'Co-op room booking and revenue stats', category: 'coop' },
};

// List all available reports
router.get('/available', requirePermission('report.basic'), (req, res) => {
  const reports = Object.entries(REPORT_METADATA).map(([id, meta]) => ({
    id,
    ...meta,
  }));

  // Group by category
  const byCategory = reports.reduce((acc, r) => {
    if (!acc[r.category]) acc[r.category] = [];
    acc[r.category].push(r);
    return acc;
  }, {});

  res.json({ reports, by_category: byCategory });
});

// Run a specific report by ID
router.get('/run/:report_id', requirePermission('report.basic'), async (req, res, next) => {
  try {
    const { report_id } = req.params;

    if (!ALLOWED_REPORTS[report_id]) {
      return res.status(400).json({
        error: 'Invalid report',
        available_reports: Object.keys(ALLOWED_REPORTS)
      });
    }

    // Check category-specific permissions
    const meta = REPORT_METADATA[report_id];

    // Financial reports require report.financial permission or manager+ role
    if (meta?.category === 'financial') {
      const hasFinancial = req.user.permissions?.includes('report.financial') ||
        ['manager', 'owner', 'admin'].includes(req.user.role);
      if (!hasFinancial) {
        return res.status(403).json({ error: 'Financial report permission required' });
      }
    }

    // Co-op reports require coop.manage permission or manager+ role
    if (meta?.category === 'coop') {
      const hasCoop = req.user.permissions?.includes('coop.manage') ||
        ['manager', 'owner', 'admin'].includes(req.user.role);
      if (!hasCoop) {
        return res.status(403).json({ error: 'Co-op management permission required' });
      }
    }

    const result = await db.query(ALLOWED_REPORTS[report_id]);

    res.json({
      report: report_id,
      name: meta?.name || report_id,
      description: meta?.description,
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map(f => f.name),
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Report error:', error);
    next(error);
  }
});

router.post('/query', requirePermission('report.custom'), async (req, res, next) => {
  try {
    const { report_name } = req.body;

    // SECURITY: Only allow predefined report queries
    if (!report_name || !ALLOWED_REPORTS[report_name]) {
      return res.status(400).json({
        error: 'Invalid report. Use one of the predefined reports.',
        available_reports: Object.keys(ALLOWED_REPORTS)
      });
    }

    const result = await db.query(ALLOWED_REPORTS[report_name]);

    res.json({
      report: report_name,
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map(f => f.name),
    });
  } catch (error) {
    console.error('Report query error:', error);
    res.status(500).json({ error: 'Report generation failed' });
  }
});

module.exports = router;
