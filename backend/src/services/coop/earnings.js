// ============================================
// TEACHER EARNINGS SERVICE
// Track and calculate teacher earnings
// ============================================

const db = require('../../database/connection');

// ============================================
// GET TEACHER EARNINGS
// ============================================

/**
 * Get teacher earnings summary
 * @param {string} teacherId - Teacher UUID
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Earnings summary
 */
async function getTeacherEarnings(teacherId, options = {}) {
  const {
    startDate = null,
    endDate = null,
    includeDetails = false
  } = options;

  let dateFilter = '';
  const params = [teacherId];

  if (startDate) {
    params.push(startDate);
    dateFilter += ` AND transaction_date >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    dateFilter += ` AND transaction_date <= $${params.length}`;
  }

  // Summary query
  const summary = await db.query(`
    SELECT
      COALESCE(SUM(CASE WHEN transaction_type = 'class_revenue' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_revenue,
      COALESCE(SUM(CASE WHEN transaction_type = 'credit_reimbursement' AND status IN ('completed', 'pending') THEN amount ELSE 0 END), 0) as total_reimbursements,
      COALESCE(SUM(CASE WHEN transaction_type = 'rental_fee' AND status IN ('completed', 'pending') THEN amount ELSE 0 END), 0) as total_rental_fees,
      COALESCE(SUM(CASE WHEN transaction_type = 'commission' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_commissions,
      COALESCE(SUM(CASE WHEN transaction_type = 'adjustment' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_adjustments,
      COALESCE(SUM(CASE WHEN transaction_type = 'payout' AND status = 'completed' THEN amount ELSE 0 END), 0) as total_paid_out,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending_balance
    FROM rental_transactions
    WHERE teacher_id = $1 ${dateFilter}
  `, params);

  const s = summary.rows[0];

  // Calculate net earnings
  const totalRevenue = parseFloat(s.total_revenue || 0);
  const totalReimbursements = parseFloat(s.total_reimbursements || 0);
  const totalRentalFees = parseFloat(s.total_rental_fees || 0); // Already negative
  const totalCommissions = parseFloat(s.total_commissions || 0); // Already negative
  const totalAdjustments = parseFloat(s.total_adjustments || 0);
  const totalPaidOut = parseFloat(s.total_paid_out || 0); // Already negative

  const netEarnings = totalRevenue + totalReimbursements + totalRentalFees + totalCommissions + totalAdjustments;
  const availableBalance = netEarnings + totalPaidOut; // totalPaidOut is negative

  const result = {
    summary: {
      totalRevenue,
      totalReimbursements,
      totalRentalFees: Math.abs(totalRentalFees),
      totalCommissions: Math.abs(totalCommissions),
      totalAdjustments,
      netEarnings,
      totalPaidOut: Math.abs(totalPaidOut),
      availableBalance,
      pendingBalance: parseFloat(s.pending_balance || 0),
    },
  };

  if (includeDetails) {
    const transactions = await db.query(`
      SELECT rt.*,
             c.date as class_date,
             c.start_time as class_start_time,
             ct.name as class_type_name
      FROM rental_transactions rt
      LEFT JOIN classes c ON rt.class_id = c.id
      LEFT JOIN class_types ct ON c.class_type_id = ct.id
      WHERE rt.teacher_id = $1 ${dateFilter}
      ORDER BY rt.transaction_date DESC, rt.created_at DESC
      LIMIT 100
    `, params);

    result.transactions = transactions.rows;
  }

  return result;
}

/**
 * Get earnings breakdown by class
 * @param {string} teacherId - Teacher UUID
 * @param {string} classId - Class UUID
 * @returns {Promise<Object>} Class earnings
 */
async function getEarningsByClass(teacherId, classId) {
  // Verify teacher owns the class
  const cls = await db.query(`
    SELECT c.*, ct.name as class_type_name
    FROM classes c
    JOIN class_types ct ON c.class_type_id = ct.id
    WHERE c.id = $1 AND c.teacher_id = $2 AND c.is_coop = true
  `, [classId, teacherId]);

  if (cls.rows.length === 0) {
    throw new Error('Class not found or not authorized');
  }

  // Get all transactions for this class
  const result = await db.query(`
    SELECT
      rt.*,
      b.user_id,
      u.first_name || ' ' || u.last_name as customer_name,
      b.booking_type
    FROM rental_transactions rt
    LEFT JOIN bookings b ON rt.booking_id = b.id
    LEFT JOIN users u ON b.user_id = u.id
    WHERE rt.teacher_id = $1 AND rt.class_id = $2
    ORDER BY rt.created_at
  `, [teacherId, classId]);

  const transactions = result.rows;

  // Calculate summary
  const summary = {
    rentalFee: 0,
    paidStudents: 0,
    paidRevenue: 0,
    creditStudents: 0,
    creditReimbursement: 0,
    refunds: 0,
    netEarnings: 0,
  };

  for (const t of transactions) {
    const amount = parseFloat(t.amount);
    switch (t.transaction_type) {
      case 'rental_fee':
        summary.rentalFee = Math.abs(amount);
        break;
      case 'class_revenue':
        if (t.status !== 'cancelled') {
          summary.paidStudents++;
          summary.paidRevenue += amount;
        }
        break;
      case 'credit_reimbursement':
        if (t.status !== 'cancelled') {
          summary.creditStudents++;
          summary.creditReimbursement += amount;
        }
        break;
      case 'refund':
        summary.refunds += Math.abs(amount);
        break;
    }
  }

  summary.netEarnings = summary.paidRevenue + summary.creditReimbursement - summary.rentalFee - summary.refunds;

  return {
    class: cls.rows[0],
    transactions,
    summary,
  };
}

/**
 * Get pending payouts for all teachers
 * @returns {Promise<Array>} Teachers with pending balances
 */
async function getPendingPayouts() {
  const result = await db.query(`
    SELECT
      t.id as teacher_id,
      u.first_name,
      u.last_name,
      u.email,
      t.stripe_connect_account_id,
      t.stripe_connect_payouts_enabled,
      SUM(rt.amount) as pending_balance,
      COUNT(DISTINCT rt.class_id) as classes_count,
      MIN(rt.transaction_date) as earliest_transaction,
      MAX(rt.transaction_date) as latest_transaction
    FROM rental_transactions rt
    JOIN teachers t ON rt.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE rt.status = 'pending'
    GROUP BY t.id, u.first_name, u.last_name, u.email,
             t.stripe_connect_account_id, t.stripe_connect_payouts_enabled
    HAVING SUM(rt.amount) != 0
    ORDER BY SUM(rt.amount) DESC
  `);

  return result.rows;
}

/**
 * Get teacher's payout history
 * @param {string} teacherId - Teacher UUID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Payout records
 */
async function getPayoutHistory(teacherId, options = {}) {
  const { limit = 50, offset = 0 } = options;

  const result = await db.query(`
    SELECT rt.*,
           sb.period_start,
           sb.period_end,
           sb.total_rental_fees as batch_rental_fees,
           sb.total_class_revenue as batch_revenue,
           sb.net_teacher_earnings as batch_net
    FROM rental_transactions rt
    LEFT JOIN settlement_batches sb ON rt.settlement_batch_id = sb.id
    WHERE rt.teacher_id = $1
      AND rt.transaction_type = 'payout'
    ORDER BY rt.created_at DESC
    LIMIT $2 OFFSET $3
  `, [teacherId, limit, offset]);

  return result.rows;
}

// ============================================
// REVENUE BY TIME PERIOD
// ============================================

/**
 * Get revenue trend over time
 * @param {string} teacherId - Teacher UUID
 * @param {Object} options - Period options
 * @returns {Promise<Array>} Revenue by period
 */
async function getRevenueTrend(teacherId, options = {}) {
  const { period = 'week', count = 12 } = options;

  const truncFunc = period === 'month' ? 'month' : 'week';
  const interval = period === 'month' ? '1 month' : '1 week';

  const result = await db.query(`
    WITH periods AS (
      SELECT generate_series(
        DATE_TRUNC($2, NOW()) - ($3 - 1) * INTERVAL '${interval}',
        DATE_TRUNC($2, NOW()),
        INTERVAL '${interval}'
      )::date as period_start
    )
    SELECT
      p.period_start,
      COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type = 'class_revenue'), 0) as revenue,
      COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type = 'credit_reimbursement'), 0) as reimbursements,
      COALESCE(SUM(ABS(rt.amount)) FILTER (WHERE rt.transaction_type = 'rental_fee'), 0) as rental_fees,
      COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type IN ('class_revenue', 'credit_reimbursement')), 0) -
        COALESCE(SUM(ABS(rt.amount)) FILTER (WHERE rt.transaction_type = 'rental_fee'), 0) as net_earnings,
      COUNT(DISTINCT rt.class_id) as classes_count
    FROM periods p
    LEFT JOIN rental_transactions rt ON
      DATE_TRUNC($2, rt.transaction_date) = p.period_start
      AND rt.teacher_id = $1
      AND rt.status IN ('completed', 'pending')
    GROUP BY p.period_start
    ORDER BY p.period_start
  `, [teacherId, truncFunc, count]);

  return result.rows;
}

/**
 * Get earnings by class type
 * @param {string} teacherId - Teacher UUID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Earnings by class type
 */
async function getEarningsByClassType(teacherId, options = {}) {
  const { startDate, endDate } = options;

  let dateFilter = '';
  const params = [teacherId];

  if (startDate) {
    params.push(startDate);
    dateFilter += ` AND c.date >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    dateFilter += ` AND c.date <= $${params.length}`;
  }

  const result = await db.query(`
    SELECT
      ct.id as class_type_id,
      ct.name as class_type_name,
      COUNT(DISTINCT c.id) as classes_count,
      COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type = 'class_revenue'), 0) as revenue,
      COALESCE(SUM(rt.amount) FILTER (WHERE rt.transaction_type = 'credit_reimbursement'), 0) as reimbursements,
      COALESCE(SUM(ABS(rt.amount)) FILTER (WHERE rt.transaction_type = 'rental_fee'), 0) as rental_fees,
      (SELECT COUNT(*) FROM bookings b WHERE b.class_id = ANY(array_agg(c.id)) AND b.status IN ('confirmed', 'checked_in', 'attended')) as total_students
    FROM classes c
    JOIN class_types ct ON c.class_type_id = ct.id
    LEFT JOIN rental_transactions rt ON c.id = rt.class_id
    WHERE c.teacher_id = $1
      AND c.is_coop = true
      AND c.coop_status = 'completed'
      ${dateFilter}
    GROUP BY ct.id, ct.name
    ORDER BY SUM(rt.amount) DESC NULLS LAST
  `, params);

  return result.rows.map(row => ({
    ...row,
    netEarnings: parseFloat(row.revenue) + parseFloat(row.reimbursements) - parseFloat(row.rental_fees),
  }));
}

// ============================================
// DAILY SUMMARY
// ============================================

/**
 * Get daily earnings summary for a teacher
 * @param {string} teacherId - Teacher UUID
 * @param {string} date - Date string YYYY-MM-DD
 * @returns {Promise<Object>} Daily summary
 */
async function getDailySummary(teacherId, date) {
  const result = await db.query(`
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'class_revenue'), 0) as revenue,
      COALESCE(SUM(amount) FILTER (WHERE transaction_type = 'credit_reimbursement'), 0) as reimbursements,
      COALESCE(SUM(ABS(amount)) FILTER (WHERE transaction_type = 'rental_fee'), 0) as rental_fees,
      COUNT(DISTINCT class_id) as classes_count
    FROM rental_transactions
    WHERE teacher_id = $1
      AND transaction_date = $2
  `, [teacherId, date]);

  const day = result.rows[0];

  return {
    date,
    revenue: parseFloat(day.revenue),
    reimbursements: parseFloat(day.reimbursements),
    rentalFees: parseFloat(day.rental_fees),
    netEarnings: parseFloat(day.revenue) + parseFloat(day.reimbursements) - parseFloat(day.rental_fees),
    classesCount: parseInt(day.classes_count),
  };
}

// ============================================
// STUDENT ANALYTICS
// ============================================

/**
 * Get student breakdown for teacher
 * @param {string} teacherId - Teacher UUID
 * @param {Object} options - Filter options
 * @returns {Promise<Object>} Student analytics
 */
async function getStudentAnalytics(teacherId, options = {}) {
  const { startDate, endDate } = options;

  let dateFilter = '';
  const params = [teacherId];

  if (startDate) {
    params.push(startDate);
    dateFilter += ` AND c.date >= $${params.length}`;
  }
  if (endDate) {
    params.push(endDate);
    dateFilter += ` AND c.date <= $${params.length}`;
  }

  // Payment type breakdown
  const paymentBreakdown = await db.query(`
    SELECT
      b.booking_type,
      COUNT(*) as count,
      COALESCE(SUM(b.coop_amount_paid), 0) as total_paid
    FROM bookings b
    JOIN classes c ON b.class_id = c.id
    WHERE c.teacher_id = $1
      AND c.is_coop = true
      AND b.status IN ('confirmed', 'checked_in', 'attended')
      ${dateFilter}
    GROUP BY b.booking_type
  `, params);

  // Unique students
  const uniqueStudents = await db.query(`
    SELECT COUNT(DISTINCT b.user_id) as count
    FROM bookings b
    JOIN classes c ON b.class_id = c.id
    WHERE c.teacher_id = $1
      AND c.is_coop = true
      AND b.status IN ('confirmed', 'checked_in', 'attended')
      ${dateFilter}
  `, params);

  // Repeat students (2+ bookings)
  const repeatStudents = await db.query(`
    SELECT COUNT(*) as count
    FROM (
      SELECT b.user_id
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      WHERE c.teacher_id = $1
        AND c.is_coop = true
        AND b.status IN ('confirmed', 'checked_in', 'attended')
        ${dateFilter}
      GROUP BY b.user_id
      HAVING COUNT(*) >= 2
    ) repeat
  `, params);

  // Member vs non-member
  const memberBreakdown = await db.query(`
    SELECT
      CASE WHEN b.membership_id IS NOT NULL THEN 'member' ELSE 'non_member' END as type,
      COUNT(*) as count
    FROM bookings b
    JOIN classes c ON b.class_id = c.id
    WHERE c.teacher_id = $1
      AND c.is_coop = true
      AND b.status IN ('confirmed', 'checked_in', 'attended')
      ${dateFilter}
    GROUP BY CASE WHEN b.membership_id IS NOT NULL THEN 'member' ELSE 'non_member' END
  `, params);

  return {
    totalBookings: paymentBreakdown.rows.reduce((sum, r) => sum + parseInt(r.count), 0),
    paymentBreakdown: paymentBreakdown.rows,
    uniqueStudents: parseInt(uniqueStudents.rows[0].count),
    repeatStudents: parseInt(repeatStudents.rows[0].count),
    memberBreakdown: memberBreakdown.rows,
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Main
  getTeacherEarnings,
  getEarningsByClass,

  // Payouts
  getPendingPayouts,
  getPayoutHistory,

  // Analytics
  getRevenueTrend,
  getEarningsByClassType,
  getDailySummary,
  getStudentAnalytics,
};
