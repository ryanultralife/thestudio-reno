// ============================================
// CO-OP BOOKING SERVICE
// Handle booking co-op classes with payments/credits
// ============================================

const db = require('../../database/connection');
const { getCoopSettings, calculateMemberPrice } = require('./settings');
const { getAvailableCoopCredits, useCoopCredit, returnCoopCredit } = require('./credits');
const { getTeacherActiveAgreement } = require('./agreements');

// ============================================
// BOOK CO-OP CLASS
// ============================================

/**
 * Book a co-op class
 *
 * Three payment scenarios:
 * 1. Non-member: Pay full coop_price
 * 2. Member with credit: Use credit (no payment)
 * 3. Member without credit: Pay discounted coop_member_price
 *
 * @param {Object} data - Booking data
 * @returns {Promise<Object>} Booking result
 */
async function bookCoopClass(data) {
  const {
    userId,
    classId,
    paymentMethod,
    paymentIntentId: stripePaymentIntentId,
    creditAllocationId: forceCreditAllocationId,
    referralCode,
  } = data;

  const useCredit = paymentMethod === 'credit';

  // Get class details
  const coopClass = await db.query(`
    SELECT c.*, t.stripe_connect_account_id as teacher_stripe_account
    FROM classes c
    JOIN teachers t ON c.teacher_id = t.id
    WHERE c.id = $1 AND c.is_coop = true
  `, [classId]);

  if (!coopClass.rows[0]) {
    throw new Error('Co-op class not found');
  }

  const cls = coopClass.rows[0];

  // Check if class is in the future
  const classStart = new Date(`${cls.date}T${cls.start_time}`);
  if (classStart <= new Date()) {
    throw new Error('Cannot book past classes');
  }

  // Check if class is cancelled
  if (cls.coop_status === 'cancelled' || cls.is_cancelled) {
    throw new Error('Class has been cancelled');
  }

  // Check capacity
  const bookingCount = await db.query(
    "SELECT COUNT(*) as count FROM bookings WHERE class_id = $1 AND status IN ('booked', 'confirmed')",
    [classId]
  );
  if (parseInt(bookingCount.rows[0].count) >= cls.capacity) {
    throw new Error('Class is full');
  }

  // Check for duplicate booking
  const existing = await db.query(
    "SELECT id FROM bookings WHERE class_id = $1 AND user_id = $2 AND status NOT IN ('cancelled')",
    [classId, userId]
  );
  if (existing.rows.length > 0) {
    throw new Error('Already booked for this class');
  }

  // Get user and membership info
  const user = await db.query(`
    SELECT u.*,
           um.id as membership_id,
           mt.coop_discount_percent
    FROM users u
    LEFT JOIN user_memberships um ON u.id = um.user_id
      AND um.status = 'active'
    LEFT JOIN membership_types mt ON um.membership_type_id = mt.id
    WHERE u.id = $1
    ORDER BY um.created_at DESC
    LIMIT 1
  `, [userId]);

  const customer = user.rows[0];
  if (!customer) {
    throw new Error('User not found');
  }

  const isMember = !!customer.membership_id;
  const settings = await getCoopSettings();

  let bookingType;
  let amountPaid = 0;
  let creditAllocationId = null;
  let stripePaymentIntentId = null;

  // Determine payment scenario
  if (isMember && useCredit) {
    // Check for available co-op credits
    const credits = await getAvailableCoopCredits(userId);

    if (credits && credits.credits_remaining > 0) {
      // Use credit - no payment needed
      bookingType = 'coop_credit';
      creditAllocationId = credits.id;
    } else {
      // Member but no credits - pay discounted price
      bookingType = 'coop_paid';
      amountPaid = parseFloat(cls.coop_member_price);
    }
  } else if (isMember) {
    // Member chose not to use credit
    bookingType = 'coop_paid';
    amountPaid = parseFloat(cls.coop_member_price);
  } else {
    // Non-member - pay full price
    bookingType = 'coop_paid';
    amountPaid = parseFloat(cls.coop_price);
  }

  // Process payment if needed
  if (amountPaid > 0) {
    // Payment processing would happen here with Stripe
    // For now, we'll record the intent to pay
    // In production, you'd integrate with Stripe Connect

    if (cls.teacher_stripe_account) {
      // Stripe Connect payment flow
      // stripePaymentIntentId = await processStripeConnectPayment(...)
    }
  }

  // Create booking
  const booking = await db.query(`
    INSERT INTO bookings (
      class_id, user_id, status,
      booking_type, coop_amount_paid, coop_credit_used,
      coop_credit_allocation_id, membership_id
    ) VALUES ($1, $2, 'confirmed', $3, $4, $5, $6, $7)
    RETURNING *
  `, [
    classId, userId, bookingType,
    amountPaid, bookingType === 'coop_credit', creditAllocationId,
    customer.membership_id
  ]);

  const newBooking = booking.rows[0];

  // If using credit, record usage and create reimbursement
  if (bookingType === 'coop_credit') {
    const creditResult = await useCoopCredit(
      creditAllocationId,
      newBooking.id,
      classId,
      userId,
      cls.teacher_id
    );

    // Create reimbursement transaction for teacher
    await createCreditReimbursement(cls, newBooking.id, creditResult.reimbursementRate);
  }

  // If paid, create revenue transaction for teacher
  if (amountPaid > 0) {
    await createRevenueTransaction(cls, newBooking.id, amountPaid, stripePaymentIntentId);
  }

  // Track referral if new user from co-op
  await trackCoopReferral(cls.teacher_id, userId, newBooking.id);

  return {
    booking: newBooking,
    bookingType,
    amountPaid,
    creditUsed: bookingType === 'coop_credit',
    memberPrice: isMember ? parseFloat(cls.coop_member_price) : null,
    fullPrice: parseFloat(cls.coop_price),
  };
}

/**
 * Create revenue transaction when student pays teacher
 */
async function createRevenueTransaction(coopClass, bookingId, amount, stripePaymentIntentId = null) {
  await db.query(`
    INSERT INTO rental_transactions (
      teacher_id, agreement_id, class_id, booking_id,
      transaction_type, amount, status, stripe_payment_intent_id,
      transaction_date, description
    ) VALUES ($1, $2, $3, $4, 'class_revenue', $5, 'completed', $6, CURRENT_DATE, 'Student payment')
  `, [
    coopClass.teacher_id, coopClass.coop_agreement_id,
    coopClass.id, bookingId, amount, stripePaymentIntentId
  ]);
}

/**
 * Create credit reimbursement transaction
 */
async function createCreditReimbursement(coopClass, bookingId, reimbursementRate) {
  await db.query(`
    INSERT INTO rental_transactions (
      teacher_id, agreement_id, class_id, booking_id,
      transaction_type, amount, status, transaction_date, description
    ) VALUES ($1, $2, $3, $4, 'credit_reimbursement', $5, 'pending', CURRENT_DATE, 'Member credit reimbursement')
  `, [
    coopClass.teacher_id, coopClass.coop_agreement_id,
    coopClass.id, bookingId, reimbursementRate
  ]);
}

/**
 * Track when a new user books through a co-op teacher
 */
async function trackCoopReferral(teacherId, userId, bookingId) {
  // Check if this is the user's first co-op booking
  const previousBookings = await db.query(`
    SELECT b.id FROM bookings b
    JOIN classes c ON b.class_id = c.id
    WHERE b.user_id = $1 AND c.is_coop = true AND b.id != $2
    LIMIT 1
  `, [userId, bookingId]);

  if (previousBookings.rows.length > 0) {
    return; // Not their first co-op booking
  }

  // Check if referral already exists
  const existingReferral = await db.query(`
    SELECT id FROM teacher_referrals
    WHERE teacher_id = $1 AND user_id = $2
  `, [teacherId, userId]);

  if (existingReferral.rows.length > 0) {
    return; // Referral already tracked
  }

  // Get settings for bonus amount
  const settings = await getCoopSettings();

  // Create referral record
  await db.query(`
    INSERT INTO teacher_referrals (
      teacher_id, user_id, first_booking_id,
      referral_source, first_coop_booking_at,
      bonus_type, bonus_amount
    ) VALUES ($1, $2, $3, 'coop_class', NOW(), $4, $5)
  `, [
    teacherId, userId, bookingId,
    settings.referral_bonus_type, settings.referral_bonus_amount
  ]);
}

// ============================================
// CANCEL BOOKING
// ============================================

/**
 * Cancel a co-op booking
 * @param {string} bookingId - Booking UUID
 * @param {string} cancelledById - User ID who cancelled
 * @returns {Promise<Object>} Cancellation result
 */
async function cancelCoopBooking(bookingId, cancelledById) {
  const booking = await db.query(`
    SELECT b.*, c.start_time, c.date, c.teacher_id, c.coop_price,
           t.stripe_connect_account_id as teacher_stripe_account
    FROM bookings b
    JOIN classes c ON b.class_id = c.id
    JOIN teachers t ON c.teacher_id = t.id
    WHERE b.id = $1
  `, [bookingId]);

  if (!booking.rows[0]) {
    throw new Error('Booking not found');
  }

  const bk = booking.rows[0];

  if (bk.status === 'cancelled') {
    throw new Error('Booking is already cancelled');
  }

  let refunded = false;
  let creditReturned = false;

  // Refund if payment was made
  if (bk.coop_amount_paid && bk.coop_amount_paid > 0) {
    // In production, process Stripe refund here
    // await stripe.refunds.create({...})

    // Create refund transaction
    await db.query(`
      INSERT INTO rental_transactions (
        teacher_id, class_id, booking_id,
        transaction_type, amount, status, description
      ) VALUES ($1, $2, $3, 'refund', $4, 'completed', 'Booking cancellation refund')
    `, [bk.teacher_id, bk.class_id, bookingId, -bk.coop_amount_paid]);

    refunded = true;
  }

  // Return credit if used
  if (bk.coop_credit_used && bk.coop_credit_allocation_id) {
    await returnCoopCredit(bookingId);

    // Cancel reimbursement transaction
    await db.query(`
      UPDATE rental_transactions
      SET status = 'cancelled', updated_at = NOW()
      WHERE booking_id = $1 AND transaction_type = 'credit_reimbursement'
    `, [bookingId]);

    creditReturned = true;
  }

  // Update booking status
  await db.query(`
    UPDATE bookings
    SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW()
    WHERE id = $1
  `, [bookingId]);

  return {
    bookingId,
    refunded,
    refundAmount: refunded ? bk.coop_amount_paid : 0,
    creditReturned,
  };
}

// ============================================
// CHECK IN
// ============================================

/**
 * Check in a student to a co-op class
 * @param {string} bookingId - Booking UUID
 * @param {string} checkedInById - User/Teacher who checked them in
 * @returns {Promise<Object>} Updated booking
 */
async function checkInCoopBooking(bookingId, checkedInById) {
  const result = await db.query(`
    UPDATE bookings
    SET status = 'checked_in',
        checked_in_at = NOW(),
        checked_in_by = $1,
        updated_at = NOW()
    WHERE id = $2
      AND status IN ('booked', 'confirmed')
    RETURNING *
  `, [checkedInById, bookingId]);

  if (result.rows.length === 0) {
    throw new Error('Booking not found or already checked in');
  }

  return result.rows[0];
}

/**
 * Undo check-in
 * @param {string} bookingId - Booking UUID
 * @returns {Promise<Object>} Updated booking
 */
async function undoCheckIn(bookingId) {
  const result = await db.query(`
    UPDATE bookings
    SET status = 'confirmed',
        checked_in_at = NULL,
        checked_in_by = NULL,
        updated_at = NOW()
    WHERE id = $1
      AND status = 'checked_in'
    RETURNING *
  `, [bookingId]);

  if (result.rows.length === 0) {
    throw new Error('Booking not found or not checked in');
  }

  return result.rows[0];
}

// ============================================
// GET BOOKINGS
// ============================================

/**
 * Get user's co-op bookings
 * @param {string} userId - User UUID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Bookings
 */
async function getUserCoopBookings(userId, options = {}) {
  const { upcoming = true, limit = 50, offset = 0 } = options;

  const result = await db.query(`
    SELECT b.*,
           c.date, c.start_time, c.end_time,
           c.coop_price, c.coop_member_price,
           ct.name as class_type_name,
           r.name as room_name,
           l.name as location_name,
           u.first_name as teacher_first_name,
           u.last_name as teacher_last_name,
           t.photo_url as teacher_photo
    FROM bookings b
    JOIN classes c ON b.class_id = c.id
    JOIN class_types ct ON c.class_type_id = ct.id
    JOIN rooms r ON c.room_id = r.id
    JOIN locations l ON c.location_id = l.id
    JOIN teachers t ON c.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE b.user_id = $1
      AND c.is_coop = true
      ${upcoming ? "AND c.date >= CURRENT_DATE AND b.status NOT IN ('cancelled')" : ''}
    ORDER BY c.date ${upcoming ? 'ASC' : 'DESC'}, c.start_time ${upcoming ? 'ASC' : 'DESC'}
    LIMIT $2 OFFSET $3
  `, [userId, limit, offset]);

  return result.rows;
}

/**
 * Get booking by ID
 * @param {string} bookingId - Booking UUID
 * @returns {Promise<Object|null>} Booking
 */
async function getCoopBookingById(bookingId) {
  const result = await db.query(`
    SELECT b.*,
           c.date, c.start_time, c.end_time,
           c.coop_price, c.coop_member_price, c.teacher_id,
           ct.name as class_type_name,
           r.name as room_name,
           l.name as location_name,
           u.first_name as teacher_first_name,
           u.last_name as teacher_last_name
    FROM bookings b
    JOIN classes c ON b.class_id = c.id
    JOIN class_types ct ON c.class_type_id = ct.id
    JOIN rooms r ON c.room_id = r.id
    JOIN locations l ON c.location_id = l.id
    JOIN teachers t ON c.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE b.id = $1 AND c.is_coop = true
  `, [bookingId]);

  return result.rows[0] || null;
}

/**
 * Get all co-op bookings with filters (admin)
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Bookings
 */
async function getCoopBookings(options = {}) {
  const {
    classId,
    teacherId,
    userId,
    status,
    bookingType,
    startDate,
    endDate,
    limit = 50,
    offset = 0,
  } = options;

  let whereClause = 'c.is_coop = true';
  const params = [];
  let paramIndex = 1;

  if (classId) {
    whereClause += ` AND b.class_id = $${paramIndex++}`;
    params.push(classId);
  }
  if (teacherId) {
    whereClause += ` AND c.teacher_id = $${paramIndex++}`;
    params.push(teacherId);
  }
  if (userId) {
    whereClause += ` AND b.user_id = $${paramIndex++}`;
    params.push(userId);
  }
  if (status) {
    whereClause += ` AND b.status = $${paramIndex++}`;
    params.push(status);
  }
  if (bookingType) {
    whereClause += ` AND b.booking_type = $${paramIndex++}`;
    params.push(bookingType);
  }
  if (startDate) {
    whereClause += ` AND c.date >= $${paramIndex++}`;
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ` AND c.date <= $${paramIndex++}`;
    params.push(endDate);
  }

  params.push(limit, offset);

  const result = await db.query(`
    SELECT b.*,
           c.date, c.start_time, c.end_time,
           c.coop_price, c.coop_member_price,
           ct.name as class_type_name,
           r.name as room_name,
           l.name as location_name,
           cu.first_name as customer_first_name,
           cu.last_name as customer_last_name,
           tu.first_name as teacher_first_name,
           tu.last_name as teacher_last_name
    FROM bookings b
    JOIN classes c ON b.class_id = c.id
    JOIN class_types ct ON c.class_type_id = ct.id
    JOIN rooms r ON c.room_id = r.id
    JOIN locations l ON c.location_id = l.id
    JOIN users cu ON b.user_id = cu.id
    JOIN teachers t ON c.teacher_id = t.id
    JOIN users tu ON t.user_id = tu.id
    WHERE ${whereClause}
    ORDER BY c.date DESC, c.start_time DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `, params);

  return result.rows;
}

/**
 * Get booking summary for a class
 * @param {string} classId - Class UUID
 * @returns {Promise<Object>} Booking summary
 */
async function getClassBookingSummary(classId) {
  const result = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status IN ('booked', 'confirmed')) as total_booked,
      COUNT(*) FILTER (WHERE status = 'checked_in') as checked_in,
      COUNT(*) FILTER (WHERE status = 'attended') as attended,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
      COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
      COUNT(*) FILTER (WHERE booking_type = 'coop_credit') as credit_users,
      COUNT(*) FILTER (WHERE booking_type = 'coop_paid') as paid_users,
      COALESCE(SUM(coop_amount_paid), 0) as total_revenue
    FROM bookings
    WHERE class_id = $1
  `, [classId]);

  return result.rows[0];
}

// ============================================
// BOOKING RULES
// ============================================

/**
 * Check if a user can book a co-op class
 * @param {string} userId - User UUID
 * @param {string} classId - Class UUID
 * @returns {Promise<Object>} Booking eligibility
 */
async function canBookCoopClass(userId, classId) {
  const errors = [];

  // Get class
  const cls = await db.query(`
    SELECT c.*, r.name as room_name
    FROM classes c
    JOIN rooms r ON c.room_id = r.id
    WHERE c.id = $1
  `, [classId]);

  if (!cls.rows[0]) {
    return { canBook: false, errors: ['Class not found'] };
  }

  const classData = cls.rows[0];

  // Check if co-op class
  if (!classData.is_coop) {
    errors.push('This is not a co-op class');
  }

  // Check if cancelled
  if (classData.is_cancelled || classData.coop_status === 'cancelled') {
    errors.push('Class has been cancelled');
  }

  // Check if in future
  const classStart = new Date(`${classData.date}T${classData.start_time}`);
  if (classStart <= new Date()) {
    errors.push('Cannot book past classes');
  }

  // Check capacity
  const bookingCount = await db.query(
    "SELECT COUNT(*) as count FROM bookings WHERE class_id = $1 AND status IN ('booked', 'confirmed')",
    [classId]
  );
  if (parseInt(bookingCount.rows[0].count) >= classData.capacity) {
    errors.push('Class is full');
  }

  // Check for duplicate booking
  const existing = await db.query(
    "SELECT id FROM bookings WHERE class_id = $1 AND user_id = $2 AND status NOT IN ('cancelled')",
    [classId, userId]
  );
  if (existing.rows.length > 0) {
    errors.push('Already booked for this class');
  }

  // Get user membership status
  const user = await db.query(`
    SELECT um.id as membership_id, mt.coop_access_enabled
    FROM users u
    LEFT JOIN user_memberships um ON u.id = um.user_id AND um.status = 'active'
    LEFT JOIN membership_types mt ON um.membership_type_id = mt.id
    WHERE u.id = $1
    LIMIT 1
  `, [userId]);

  const isMember = !!user.rows[0]?.membership_id;
  let hasCredits = false;

  if (isMember) {
    const credits = await getAvailableCoopCredits(userId);
    hasCredits = credits && credits.credits_remaining > 0;
  }

  return {
    canBook: errors.length === 0,
    errors,
    classData: {
      id: classData.id,
      fullPrice: parseFloat(classData.coop_price),
      memberPrice: parseFloat(classData.coop_member_price),
      spotsLeft: classData.capacity - parseInt(bookingCount.rows[0].count),
    },
    userStatus: {
      isMember,
      hasCredits,
      creditsAvailable: hasCredits,
    },
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Book
  bookCoopClass,
  canBookCoopClass,

  // Cancel
  cancelCoopBooking,

  // Check in
  checkInCoopBooking,
  undoCheckIn,

  // Get
  getUserCoopBookings,
  getCoopBookingById,
  getCoopBookings,
  getClassBookingSummary,

  // Internal
  createRevenueTransaction,
  createCreditReimbursement,
  trackCoopReferral,
};
