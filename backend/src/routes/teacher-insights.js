// ============================================
// TEACHER INSIGHTS & EMPOWERMENT DASHBOARD
// Routes for teachers to view their performance, earnings, and impact
// ============================================

const express = require('express');
const router = express.Router();
const db = require('../database/connection');
const { authenticate } = require('../middleware/auth');

// All routes require authentication
router.use(authenticate);

// Middleware to verify user is a teacher
const requireTeacher = async (req, res, next) => {
  try {
    const result = await db.query(
      'SELECT id FROM teachers WHERE user_id = $1 AND is_active = true',
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Teacher access required' });
    }

    req.teacherId = result.rows[0].id;
    next();
  } catch (error) {
    next(error);
  }
};

router.use(requireTeacher);

// ============================================
// DASHBOARD OVERVIEW
// Key metrics for teacher's homepage
// ============================================

router.get('/dashboard', async (req, res, next) => {
  try {
    const teacherId = req.teacherId;

    // This week's classes
    const thisWeek = await db.query(`
      SELECT
        COUNT(*) as total_classes,
        COUNT(*) FILTER (WHERE is_cancelled = false) as active_classes,
        SUM(
          (SELECT COUNT(*) FROM bookings b
           WHERE b.class_id = c.id AND b.status IN ('booked', 'checked_in'))
        ) as total_bookings,
        SUM(
          (SELECT COUNT(*) FROM bookings b
           WHERE b.class_id = c.id AND b.status = 'checked_in')
        ) as total_attendance
      FROM classes c
      WHERE c.teacher_id = $1
        AND c.date >= DATE_TRUNC('week', CURRENT_DATE)
        AND c.date < DATE_TRUNC('week', CURRENT_DATE) + INTERVAL '7 days'
    `, [teacherId]);

    // Upcoming classes (next 7 days)
    const upcomingClasses = await db.query(`
      SELECT
        c.id,
        c.date,
        c.start_time,
        c.end_time,
        ct.name as class_name,
        ct.duration,
        l.name as location,
        c.capacity,
        c.is_coop_class,
        (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status IN ('booked', 'checked_in')) as booked_count
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      WHERE c.teacher_id = $1
        AND c.date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '7 days'
        AND c.is_cancelled = false
      ORDER BY c.date, c.start_time
      LIMIT 10
    `, [teacherId]);

    // Recent student feedback/attendance trends
    const recentTrends = await db.query(`
      SELECT
        DATE_TRUNC('week', c.date) as week,
        COUNT(DISTINCT c.id) as classes,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as attendance,
        ROUND(AVG(
          CASE WHEN c.capacity > 0
          THEN (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in')::numeric / c.capacity * 100
          END
        ), 1) as avg_fill_rate
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.date >= CURRENT_DATE - INTERVAL '4 weeks'
        AND c.is_cancelled = false
      GROUP BY DATE_TRUNC('week', c.date)
      ORDER BY week DESC
    `, [teacherId]);

    // Co-op classes performance
    const coopStats = await db.query(`
      SELECT
        COUNT(DISTINCT c.id) as total_coop_classes,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_coop_attendance,
        SUM(c.coop_price * (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in' AND drop_in_payment_required = true)) as coop_revenue_estimate
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.is_coop_class = true
        AND c.date >= CURRENT_DATE - INTERVAL '30 days'
    `, [teacherId]);

    res.json({
      this_week: thisWeek.rows[0],
      upcoming_classes: upcomingClasses.rows,
      recent_trends: recentTrends.rows,
      coop_stats: coopStats.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PERFORMANCE METRICS
// Detailed performance over time
// ============================================

router.get('/performance', async (req, res, next) => {
  try {
    const { start_date, end_date, group_by = 'week' } = req.query;
    const teacherId = req.teacherId;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const groupExpr = group_by === 'month'
      ? "DATE_TRUNC('month', c.date)::date"
      : "DATE_TRUNC('week', c.date)::date";

    const result = await db.query(`
      SELECT
        ${groupExpr} as period,
        COUNT(DISTINCT c.id) as classes_taught,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_attendance,
        ROUND(AVG(
          CASE WHEN c.capacity > 0
          THEN (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in')::numeric / c.capacity * 100
          END
        ), 1) as avg_fill_rate,
        COUNT(DISTINCT b.user_id) as unique_students,
        -- Count returning students (attended more than once)
        COUNT(DISTINCT b.user_id) FILTER (
          WHERE (SELECT COUNT(DISTINCT c2.id) FROM bookings b2
                 JOIN classes c2 ON b2.class_id = c2.id
                 WHERE b2.user_id = b.user_id
                   AND c2.teacher_id = $1
                   AND b2.status = 'checked_in') > 1
        ) as returning_students
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.date BETWEEN $2 AND $3
        AND c.is_cancelled = false
      GROUP BY ${groupExpr}
      ORDER BY period
    `, [teacherId, startDate, endDate]);

    // Summary statistics
    const summary = await db.query(`
      SELECT
        COUNT(DISTINCT c.id) as total_classes,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_attendance,
        ROUND(AVG(
          CASE WHEN c.capacity > 0
          THEN (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in')::numeric / c.capacity * 100
          END
        ), 1) as avg_fill_rate,
        COUNT(DISTINCT b.user_id) as unique_students,
        ROUND(COUNT(b.id) FILTER (WHERE b.status = 'checked_in')::numeric / NULLIF(COUNT(DISTINCT c.id), 0), 1) as avg_students_per_class
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.date BETWEEN $2 AND $3
        AND c.is_cancelled = false
    `, [teacherId, startDate, endDate]);

    res.json({
      start_date: startDate,
      end_date: endDate,
      group_by,
      summary: summary.rows[0],
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// CLASS BREAKDOWN
// Performance by class type
// ============================================

router.get('/classes/breakdown', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const teacherId = req.teacherId;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const result = await db.query(`
      SELECT
        ct.name as class_type,
        ct.category,
        c.is_coop_class,
        COUNT(DISTINCT c.id) as classes_taught,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_attendance,
        ROUND(COUNT(b.id) FILTER (WHERE b.status = 'checked_in')::numeric / NULLIF(COUNT(DISTINCT c.id), 0), 1) as avg_per_class,
        ROUND(AVG(
          CASE WHEN c.capacity > 0
          THEN (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in')::numeric / c.capacity * 100
          END
        ), 1) as avg_fill_rate,
        MAX((SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in')) as peak_attendance
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.date BETWEEN $2 AND $3
        AND c.is_cancelled = false
      GROUP BY ct.name, ct.category, c.is_coop_class
      ORDER BY total_attendance DESC
    `, [teacherId, startDate, endDate]);

    res.json({
      start_date: startDate,
      end_date: endDate,
      data: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// STUDENT ENGAGEMENT
// Your most loyal students and retention
// ============================================

router.get('/students/engagement', async (req, res, next) => {
  try {
    const { start_date, end_date, limit = 50 } = req.query;
    const teacherId = req.teacherId;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    // Top students by attendance
    const topStudents = await db.query(`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        COUNT(DISTINCT c.id) as classes_attended,
        MIN(c.date) as first_class,
        MAX(c.date) as last_class,
        ROUND(COUNT(DISTINCT c.id)::numeric /
          NULLIF(EXTRACT(EPOCH FROM (MAX(c.date) - MIN(c.date))) / 604800, 0), 1) as avg_per_week,
        array_agg(DISTINCT ct.name ORDER BY ct.name) as class_types_attended
      FROM users u
      JOIN bookings b ON b.user_id = u.id AND b.status = 'checked_in'
      JOIN classes c ON c.id = b.class_id
      JOIN class_types ct ON ct.id = c.class_type_id
      WHERE c.teacher_id = $1
        AND c.date BETWEEN $2 AND $3
      GROUP BY u.id
      HAVING COUNT(DISTINCT c.id) >= 3
      ORDER BY classes_attended DESC
      LIMIT $4
    `, [teacherId, startDate, endDate, limit]);

    // New students (first time attending your class in this period)
    const newStudents = await db.query(`
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        MIN(c.date) as first_class_date,
        ct.name as first_class_type,
        COUNT(DISTINCT c.id) as total_classes_since
      FROM users u
      JOIN bookings b ON b.user_id = u.id AND b.status = 'checked_in'
      JOIN classes c ON c.id = b.class_id
      JOIN class_types ct ON ct.id = c.class_type_id
      WHERE c.teacher_id = $1
        AND c.date BETWEEN $2 AND $3
        AND NOT EXISTS (
          SELECT 1 FROM bookings b2
          JOIN classes c2 ON c2.id = b2.class_id
          WHERE b2.user_id = u.id
            AND c2.teacher_id = $1
            AND c2.date < $2
            AND b2.status = 'checked_in'
        )
      GROUP BY u.id, ct.name
      ORDER BY first_class_date DESC
      LIMIT $4
    `, [teacherId, startDate, endDate, limit]);

    // Retention stats
    const retention = await db.query(`
      WITH student_cohorts AS (
        SELECT
          u.id,
          DATE_TRUNC('month', MIN(c.date)) as cohort_month
        FROM users u
        JOIN bookings b ON b.user_id = u.id AND b.status = 'checked_in'
        JOIN classes c ON c.id = b.class_id
        WHERE c.teacher_id = $1
        GROUP BY u.id
      )
      SELECT
        cohort_month,
        COUNT(DISTINCT sc.id) as students,
        COUNT(DISTINCT b.user_id) FILTER (
          WHERE c.date >= cohort_month + INTERVAL '1 month' AND c.date < cohort_month + INTERVAL '2 months'
        ) as retained_month_1,
        COUNT(DISTINCT b.user_id) FILTER (
          WHERE c.date >= cohort_month + INTERVAL '2 months' AND c.date < cohort_month + INTERVAL '3 months'
        ) as retained_month_2,
        COUNT(DISTINCT b.user_id) FILTER (
          WHERE c.date >= cohort_month + INTERVAL '3 months'
        ) as retained_month_3
      FROM student_cohorts sc
      LEFT JOIN bookings b ON b.user_id = sc.id AND b.status = 'checked_in'
      LEFT JOIN classes c ON c.id = b.class_id AND c.teacher_id = $1
      WHERE cohort_month >= DATE_TRUNC('month', $2::date) - INTERVAL '6 months'
        AND cohort_month <= DATE_TRUNC('month', $3::date)
      GROUP BY cohort_month
      ORDER BY cohort_month DESC
      LIMIT 6
    `, [teacherId, startDate, endDate]);

    res.json({
      start_date: startDate,
      end_date: endDate,
      top_students: topStudents.rows,
      new_students: newStudents.rows,
      retention: retention.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// EARNINGS SUMMARY
// Revenue generated from co-op classes and series
// ============================================

router.get('/earnings', async (req, res, next) => {
  try {
    const { start_date, end_date, group_by = 'month' } = req.query;
    const teacherId = req.teacherId;

    const startDate = start_date || (() => {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      return d.toISOString().split('T')[0];
    })();
    const endDate = end_date || new Date().toISOString().split('T')[0];

    const groupExpr = group_by === 'week'
      ? "DATE_TRUNC('week', c.date)::date"
      : "DATE_TRUNC('month', c.date)::date";

    // Co-op class earnings (drop-in payments)
    const coopEarnings = await db.query(`
      SELECT
        ${groupExpr} as period,
        COUNT(DISTINCT c.id) as coop_classes,
        COUNT(b.id) FILTER (WHERE b.drop_in_payment_required = true) as drop_in_bookings,
        SUM(c.coop_price) FILTER (WHERE b.drop_in_payment_required = true) as drop_in_revenue,
        COUNT(b.id) FILTER (WHERE b.credits_used > 0) as credit_bookings,
        SUM(b.credits_used) as credits_used
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id AND b.status = 'checked_in'
      WHERE c.teacher_id = $1
        AND c.is_coop_class = true
        AND c.date BETWEEN $2 AND $3
      GROUP BY ${groupExpr}
      ORDER BY period
    `, [teacherId, startDate, endDate]);

    // Series earnings
    const seriesEarnings = await db.query(`
      SELECT
        DATE_TRUNC('month', sr.registration_date)::date as period,
        COUNT(DISTINCT sr.id) as registrations,
        SUM(cs.total_price) as total_revenue,
        SUM(sr.total_paid) as collected,
        SUM(cs.total_price - sr.total_paid) as outstanding
      FROM series_registrations sr
      JOIN class_series cs ON cs.id = sr.series_id
      WHERE cs.created_by = $1
        AND sr.registration_date BETWEEN $2 AND $3
        AND sr.status IN ('confirmed', 'completed')
      GROUP BY DATE_TRUNC('month', sr.registration_date)
      ORDER BY period
    `, [req.user.id, startDate, endDate]);

    // Summary
    const summary = await db.query(`
      SELECT
        -- Co-op classes
        COUNT(DISTINCT c.id) FILTER (WHERE c.is_coop_class = true) as total_coop_classes,
        SUM(c.coop_price) FILTER (WHERE c.is_coop_class = true AND b.drop_in_payment_required = true) as total_coop_revenue,

        -- Series
        (SELECT COUNT(*) FROM class_series WHERE created_by = $3 AND start_date >= $1) as active_series,
        (SELECT COALESCE(SUM(cs.total_price), 0)
         FROM series_registrations sr
         JOIN class_series cs ON cs.id = sr.series_id
         WHERE cs.created_by = $3
           AND sr.registration_date BETWEEN $1 AND $2
           AND sr.status IN ('confirmed', 'completed')) as total_series_revenue
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id AND b.status = 'checked_in'
      WHERE c.teacher_id = $4
        AND c.date BETWEEN $1 AND $2
    `, [startDate, endDate, req.user.id, teacherId]);

    res.json({
      start_date: startDate,
      end_date: endDate,
      group_by,
      summary: summary.rows[0],
      coop_earnings: coopEarnings.rows,
      series_earnings: seriesEarnings.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MY CO-OP CLASSES
// List and manage co-op classes
// ============================================

router.get('/coop-classes', async (req, res, next) => {
  try {
    const { status = 'upcoming' } = req.query;
    const teacherId = req.teacherId;

    let dateFilter = '';
    if (status === 'upcoming') {
      dateFilter = 'AND c.date >= CURRENT_DATE';
    } else if (status === 'past') {
      dateFilter = 'AND c.date < CURRENT_DATE';
    }

    const result = await db.query(`
      SELECT
        c.id,
        c.date,
        c.start_time,
        c.end_time,
        ct.name as class_name,
        ct.duration,
        l.name as location,
        c.capacity,
        c.coop_price,
        c.coop_credits,
        c.is_cancelled,
        (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status IN ('booked', 'checked_in')) as booked_count,
        (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in') as attended_count,
        c.coop_price * (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'checked_in' AND drop_in_payment_required = true) as revenue
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      WHERE c.teacher_id = $1
        AND c.is_coop_class = true
        ${dateFilter}
      ORDER BY c.date DESC, c.start_time DESC
    `, [teacherId]);

    res.json({
      status,
      classes: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// MY SERIES PROGRAMS
// List and manage teacher training and workshop series
// ============================================

router.get('/series', async (req, res, next) => {
  try {
    const { status = 'active' } = req.query;

    let statusFilter = '';
    if (status === 'active') {
      statusFilter = 'AND cs.end_date >= CURRENT_DATE';
    } else if (status === 'completed') {
      statusFilter = 'AND cs.end_date < CURRENT_DATE';
    }

    const result = await db.query(`
      SELECT
        cs.*,
        (SELECT COUNT(*) FROM series_registrations WHERE series_id = cs.id AND status IN ('confirmed', 'completed')) as enrolled_count,
        (SELECT COUNT(*) FROM series_registrations WHERE series_id = cs.id AND status = 'waitlist') as waitlist_count,
        (SELECT COUNT(*) FROM classes WHERE series_id = cs.id) as scheduled_sessions,
        (SELECT SUM(total_paid) FROM series_registrations WHERE series_id = cs.id) as total_collected,
        cs.total_price * (SELECT COUNT(*) FROM series_registrations WHERE series_id = cs.id AND status IN ('confirmed', 'completed')) as expected_revenue
      FROM class_series cs
      WHERE cs.created_by = $1
        ${statusFilter}
      ORDER BY cs.start_date DESC
    `, [req.user.id]);

    res.json({
      status,
      series: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// IMPACT REPORT
// Community impact and reach
// ============================================

router.get('/impact', async (req, res, next) => {
  try {
    const teacherId = req.teacherId;

    // All-time statistics
    const allTime = await db.query(`
      SELECT
        COUNT(DISTINCT c.id) as total_classes_taught,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as total_students_served,
        COUNT(DISTINCT b.user_id) as unique_students,
        MIN(c.date) as teaching_since,
        ROUND(SUM(ct.duration) / 60.0, 1) as total_hours_taught
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      LEFT JOIN class_types ct ON ct.id = c.class_type_id
      WHERE c.teacher_id = $1
        AND c.is_cancelled = false
    `, [teacherId]);

    // This year
    const thisYear = await db.query(`
      SELECT
        COUNT(DISTINCT c.id) as classes,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as students,
        COUNT(DISTINCT b.user_id) as unique_students
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.date >= DATE_TRUNC('year', CURRENT_DATE)
        AND c.is_cancelled = false
    `, [teacherId]);

    // Co-op impact
    const coopImpact = await db.query(`
      SELECT
        COUNT(DISTINCT c.id) as coop_classes_created,
        COUNT(b.id) FILTER (WHERE b.status = 'checked_in') as coop_students_served,
        COUNT(DISTINCT c.series_id) FILTER (WHERE c.series_id IS NOT NULL) as series_created
      FROM classes c
      LEFT JOIN bookings b ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.is_coop_class = true
    `, [teacherId]);

    // Series impact
    const seriesImpact = await db.query(`
      SELECT
        COUNT(DISTINCT cs.id) as programs_created,
        SUM(cs.total_hours) as total_training_hours,
        COUNT(DISTINCT sr.user_id) as students_trained,
        COUNT(DISTINCT sc.id) as certificates_issued
      FROM class_series cs
      LEFT JOIN series_registrations sr ON sr.series_id = cs.id AND sr.status IN ('confirmed', 'completed')
      LEFT JOIN series_certificates sc ON sc.registration_id = sr.id
      WHERE cs.created_by = $1
    `, [req.user.id]);

    res.json({
      all_time: allTime.rows[0],
      this_year: thisYear.rows[0],
      coop_impact: coopImpact.rows[0],
      series_impact: seriesImpact.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SCHEDULE & AVAILABILITY
// View upcoming schedule and manage availability
// ============================================

router.get('/schedule', async (req, res, next) => {
  try {
    const { start_date, end_date } = req.query;
    const teacherId = req.teacherId;

    const startDate = start_date || new Date().toISOString().split('T')[0];
    const endDate = end_date || (() => {
      const d = new Date();
      d.setDate(d.getDate() + 30);
      return d.toISOString().split('T')[0];
    })();

    const result = await db.query(`
      SELECT
        c.id,
        c.date,
        c.start_time,
        c.end_time,
        ct.name as class_name,
        ct.duration,
        ct.category,
        l.name as location,
        c.capacity,
        c.is_coop_class,
        c.is_cancelled,
        c.series_id,
        (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status IN ('booked', 'checked_in')) as booked_count,
        (SELECT name FROM class_series WHERE id = c.series_id) as series_name
      FROM classes c
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      WHERE c.teacher_id = $1
        AND c.date BETWEEN $2 AND $3
      ORDER BY c.date, c.start_time
    `, [teacherId, startDate, endDate]);

    res.json({
      start_date: startDate,
      end_date: endDate,
      classes: result.rows,
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
