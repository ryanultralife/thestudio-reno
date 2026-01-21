// ============================================
// CO-OP CREDITS SERVICE
// Monthly credit allocations for members
// ============================================

const db = require('../../database/connection');
const { getCoopSettings } = require('./settings');

// ============================================
// ALLOCATE CREDITS
// ============================================

/**
 * Allocate monthly co-op credits for all eligible members
 * Called on 1st of each month via cron job
 * @param {Date|string} periodStart - First day of the period (optional)
 * @returns {Promise<Object>} Allocation results
 */
async function allocateMonthlyCredits(periodStart = null) {
  // Calculate period dates
  let start;
  if (periodStart) {
    start = new Date(periodStart);
  } else {
    start = new Date();
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);

  const periodEnd = new Date(start);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setDate(0); // Last day of current month

  const periodStartStr = start.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];

  // Find all active memberships with co-op credits
  const eligibleMembers = await db.query(`
    SELECT
      um.id as membership_id,
      um.user_id,
      mt.coop_credits_per_month
    FROM user_memberships um
    JOIN membership_types mt ON um.membership_type_id = mt.id
    WHERE um.status = 'active'
      AND mt.coop_credits_per_month > 0
      AND NOT EXISTS (
        SELECT 1 FROM member_coop_credits mcc
        WHERE mcc.user_id = um.user_id
          AND mcc.period_start = $1
      )
  `, [periodStartStr]);

  let allocated = 0;
  const errors = [];

  for (const member of eligibleMembers.rows) {
    try {
      await db.query(`
        INSERT INTO member_coop_credits (
          user_id, membership_id,
          period_start, period_end, credits_allocated,
          expires_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
      `, [
        member.user_id,
        member.membership_id,
        periodStartStr,
        periodEndStr,
        member.coop_credits_per_month,
        new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000), // Expire day after period end
      ]);
      allocated++;
    } catch (error) {
      errors.push({ userId: member.user_id, error: error.message });
    }
  }

  return {
    allocated,
    periodStart: periodStartStr,
    periodEnd: periodEndStr,
    errors: errors.length > 0 ? errors : null,
  };
}

/**
 * Manually allocate credits to a specific user
 * @param {string} userId - User UUID
 * @param {number} credits - Number of credits to allocate
 * @param {string} periodStart - Period start date (optional)
 * @returns {Promise<Object>} Credit allocation
 */
async function allocateCreditsToUser(userId, credits, periodStart = null) {
  // Get user's active membership
  const membership = await db.query(`
    SELECT um.id FROM user_memberships um
    WHERE um.user_id = $1 AND um.status = 'active'
    ORDER BY um.created_at DESC
    LIMIT 1
  `, [userId]);

  if (membership.rows.length === 0) {
    throw new Error('User does not have an active membership');
  }

  // Calculate period dates
  let start;
  if (periodStart) {
    start = new Date(periodStart);
  } else {
    start = new Date();
    start.setDate(1);
  }
  start.setHours(0, 0, 0, 0);

  const periodEnd = new Date(start);
  periodEnd.setMonth(periodEnd.getMonth() + 1);
  periodEnd.setDate(0);

  const periodStartStr = start.toISOString().split('T')[0];
  const periodEndStr = periodEnd.toISOString().split('T')[0];

  // Check if already allocated
  const existing = await db.query(`
    SELECT id, credits_allocated, credits_used FROM member_coop_credits
    WHERE user_id = $1 AND period_start = $2
  `, [userId, periodStartStr]);

  if (existing.rows.length > 0) {
    // Update existing allocation
    const result = await db.query(`
      UPDATE member_coop_credits
      SET credits_allocated = credits_allocated + $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [credits, existing.rows[0].id]);
    return result.rows[0];
  }

  // Create new allocation
  const result = await db.query(`
    INSERT INTO member_coop_credits (
      user_id, membership_id,
      period_start, period_end, credits_allocated,
      expires_at
    ) VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING *
  `, [
    userId,
    membership.rows[0].id,
    periodStartStr,
    periodEndStr,
    credits,
    new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000),
  ]);

  return result.rows[0];
}

// ============================================
// GET CREDITS
// ============================================

/**
 * Get available co-op credits for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Object|null>} Current credit allocation or null
 */
async function getAvailableCoopCredits(userId) {
  const result = await db.query(`
    SELECT *,
           credits_allocated - credits_used as credits_remaining
    FROM member_coop_credits
    WHERE user_id = $1
      AND period_end >= CURRENT_DATE
      AND credits_used < credits_allocated
    ORDER BY period_end ASC
    LIMIT 1
  `, [userId]);

  if (result.rows.length === 0) return null;

  const credit = result.rows[0];
  return {
    ...credit,
    credits_remaining: credit.credits_allocated - credit.credits_used,
  };
}

/**
 * Get all credit allocations for a user
 * @param {string} userId - User UUID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Credit allocations
 */
async function getUserCreditHistory(userId, options = {}) {
  const { limit = 12, offset = 0 } = options;

  const result = await db.query(`
    SELECT mcc.*,
           mcc.credits_allocated - mcc.credits_used - mcc.credits_expired as credits_remaining
    FROM member_coop_credits mcc
    WHERE mcc.user_id = $1
    ORDER BY mcc.period_start DESC
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);

  return result.rows;
}

/**
 * Get credit summary for a user
 * @param {string} userId - User UUID
 * @returns {Promise<Object>} Credit summary
 */
async function getUserCreditSummary(userId) {
  const result = await db.query(`
    SELECT
      COALESCE(SUM(credits_allocated), 0) as total_allocated,
      COALESCE(SUM(credits_used), 0) as total_used,
      COALESCE(SUM(credits_expired), 0) as total_expired,
      (
        SELECT credits_allocated - credits_used
        FROM member_coop_credits
        WHERE user_id = $1 AND period_end >= CURRENT_DATE
        ORDER BY period_end ASC
        LIMIT 1
      ) as current_available,
      (
        SELECT period_end
        FROM member_coop_credits
        WHERE user_id = $1 AND period_end >= CURRENT_DATE
        ORDER BY period_end ASC
        LIMIT 1
      ) as current_period_end
    FROM member_coop_credits
    WHERE user_id = $1
  `, [userId]);

  const summary = result.rows[0];
  return {
    totalAllocated: parseInt(summary.total_allocated) || 0,
    totalUsed: parseInt(summary.total_used) || 0,
    totalExpired: parseInt(summary.total_expired) || 0,
    currentAvailable: parseInt(summary.current_available) || 0,
    currentPeriodEnd: summary.current_period_end,
  };
}

// ============================================
// USE CREDITS
// ============================================

/**
 * Use a co-op credit for a booking
 * @param {string} creditAllocationId - Credit allocation UUID
 * @param {string} bookingId - Booking UUID
 * @param {string} classId - Class UUID
 * @param {string} userId - User UUID
 * @param {string} teacherId - Teacher UUID
 * @returns {Promise<Object>} Usage record
 */
async function useCoopCredit(creditAllocationId, bookingId, classId, userId, teacherId) {
  // Verify credit is available
  const credit = await db.query(`
    SELECT * FROM member_coop_credits
    WHERE id = $1
      AND credits_used < credits_allocated
      AND period_end >= CURRENT_DATE
  `, [creditAllocationId]);

  if (credit.rows.length === 0) {
    throw new Error('Credit allocation not found or no credits available');
  }

  // Update credit count
  await db.query(`
    UPDATE member_coop_credits
    SET credits_used = credits_used + 1, updated_at = NOW()
    WHERE id = $1
  `, [creditAllocationId]);

  // Get reimbursement rate from agreement
  const agreement = await db.query(`
    SELECT credit_reimbursement_rate FROM teacher_rental_agreements
    WHERE teacher_id = $1 AND status = 'active'
    LIMIT 1
  `, [teacherId]);

  const reimbursementRate = parseFloat(agreement.rows[0]?.credit_reimbursement_rate || 5.00);

  // Log usage
  const usage = await db.query(`
    INSERT INTO coop_credit_usage (
      credit_allocation_id, booking_id, class_id, user_id, teacher_id,
      credits_used, reimbursement_amount
    ) VALUES ($1, $2, $3, $4, $5, 1, $6)
    RETURNING *
  `, [creditAllocationId, bookingId, classId, userId, teacherId, reimbursementRate]);

  return {
    usage: usage.rows[0],
    reimbursementRate,
  };
}

/**
 * Return a credit (when booking is cancelled)
 * @param {string} bookingId - Booking UUID
 * @returns {Promise<boolean>} Success
 */
async function returnCoopCredit(bookingId) {
  // Find the credit usage
  const usage = await db.query(`
    SELECT * FROM coop_credit_usage WHERE booking_id = $1
  `, [bookingId]);

  if (usage.rows.length === 0) {
    return false;
  }

  const creditUsage = usage.rows[0];

  // Decrement the used count
  await db.query(`
    UPDATE member_coop_credits
    SET credits_used = credits_used - 1, updated_at = NOW()
    WHERE id = $1 AND credits_used > 0
  `, [creditUsage.credit_allocation_id]);

  // Delete the usage record
  await db.query(`
    DELETE FROM coop_credit_usage WHERE id = $1
  `, [creditUsage.id]);

  return true;
}

// ============================================
// EXPIRE CREDITS
// ============================================

/**
 * Expire unused credits at end of period
 * Called daily via cron job
 * @returns {Promise<Object>} Expiration results
 */
async function expireUnusedCredits() {
  const result = await db.query(`
    UPDATE member_coop_credits
    SET credits_expired = credits_allocated - credits_used,
        updated_at = NOW()
    WHERE period_end < CURRENT_DATE
      AND credits_expired = 0
      AND credits_used < credits_allocated
    RETURNING id, user_id, credits_allocated - credits_used as expired_count
  `);

  return {
    expired: result.rows.length,
    details: result.rows,
  };
}

// ============================================
// CREDIT USAGE REPORTS
// ============================================

/**
 * Get credit usage by teacher
 * @param {string} teacherId - Teacher UUID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Usage records
 */
async function getCreditUsageByTeacher(teacherId, options = {}) {
  const { startDate, endDate, limit = 100 } = options;

  let whereClause = 'ccu.teacher_id = $1';
  const params = [teacherId];
  let paramIndex = 2;

  if (startDate) {
    whereClause += ` AND ccu.used_at >= $${paramIndex++}`;
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ` AND ccu.used_at <= $${paramIndex++}`;
    params.push(endDate);
  }

  params.push(limit);

  const result = await db.query(`
    SELECT ccu.*,
           u.first_name, u.last_name,
           c.date as class_date, c.start_time,
           ct.name as class_type_name
    FROM coop_credit_usage ccu
    JOIN users u ON ccu.user_id = u.id
    JOIN classes c ON ccu.class_id = c.id
    JOIN class_types ct ON c.class_type_id = ct.id
    WHERE ${whereClause}
    ORDER BY ccu.used_at DESC
    LIMIT $${paramIndex}
  `, params);

  return result.rows;
}

/**
 * Get credit usage summary by class
 * @param {string} classId - Class UUID
 * @returns {Promise<Object>} Usage summary
 */
async function getCreditUsageByClass(classId) {
  const result = await db.query(`
    SELECT
      COUNT(*) as credit_users,
      COALESCE(SUM(reimbursement_amount), 0) as total_reimbursement
    FROM coop_credit_usage
    WHERE class_id = $1
  `, [classId]);

  return {
    creditUsers: parseInt(result.rows[0].credit_users),
    totalReimbursement: parseFloat(result.rows[0].total_reimbursement),
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Allocate
  allocateMonthlyCredits,
  allocateCreditsToUser,

  // Get
  getAvailableCoopCredits,
  getUserCreditHistory,
  getUserCreditSummary,

  // Use
  useCoopCredit,
  returnCoopCredit,

  // Expire
  expireUnusedCredits,

  // Reports
  getCreditUsageByTeacher,
  getCreditUsageByClass,
};
