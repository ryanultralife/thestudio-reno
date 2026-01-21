// ============================================
// TEACHER AGREEMENTS SERVICE
// Contracts between studio and co-op teachers
// ============================================

const db = require('../../database/connection');
const { getCoopSettings } = require('./settings');

// ============================================
// CREATE AGREEMENT
// ============================================

/**
 * Create a new teacher rental agreement
 * @param {Object} data - Agreement data
 * @returns {Promise<Object>} Created agreement
 */
async function createAgreement(data) {
  const {
    teacherId,
    agreementType = 'per_class',   // 'per_class', 'monthly', 'weekly'
    roomId,                         // Required for monthly/weekly
    recurringSchedule,              // For monthly/weekly: [{day: 1, start: "18:00", end: "19:30"}]
    fixedRate,                      // For monthly/weekly
    creditReimbursementRate = 5.00,
    commissionPercent = 0,
    startDate,
    endDate,
    insuranceRequired = true,
    notes,
  } = data;

  // Validate teacher exists
  const teacher = await db.query(`
    SELECT t.*, u.first_name, u.last_name, u.email
    FROM teachers t
    JOIN users u ON t.user_id = u.id
    WHERE t.id = $1
  `, [teacherId]);

  if (teacher.rows.length === 0) {
    throw new Error('Teacher not found');
  }

  // Check for existing active agreement
  const existing = await db.query(`
    SELECT id FROM teacher_rental_agreements
    WHERE teacher_id = $1 AND status IN ('pending', 'active')
  `, [teacherId]);

  if (existing.rows.length > 0) {
    throw new Error('Teacher already has an active or pending agreement');
  }

  // Validate dates
  const start = new Date(startDate);
  if (isNaN(start.getTime())) {
    throw new Error('Invalid start date');
  }

  if (endDate) {
    const end = new Date(endDate);
    if (isNaN(end.getTime()) || end <= start) {
      throw new Error('End date must be after start date');
    }
  }

  // Validate agreement type specific fields
  if (agreementType !== 'per_class') {
    if (!roomId) {
      throw new Error('Room ID is required for monthly/weekly agreements');
    }
    if (!fixedRate || fixedRate <= 0) {
      throw new Error('Fixed rate is required for monthly/weekly agreements');
    }
  }

  // Create the agreement
  const result = await db.query(`
    INSERT INTO teacher_rental_agreements (
      teacher_id, agreement_type, room_id, recurring_schedule,
      fixed_rate, credit_reimbursement_rate, commission_percent,
      start_date, end_date, insurance_required, notes, submitted_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
    RETURNING *
  `, [
    teacherId, agreementType, roomId,
    recurringSchedule ? JSON.stringify(recurringSchedule) : null,
    fixedRate, creditReimbursementRate, commissionPercent,
    startDate, endDate, insuranceRequired, notes
  ]);

  const agreement = result.rows[0];

  // Get settings to check auto-approval
  const settings = await getCoopSettings();

  if (settings.auto_approve_agreements && !insuranceRequired) {
    // Auto-approve
    return approveAgreement(agreement.id, null);
  }

  return agreement;
}

// ============================================
// AGREEMENT STATUS CHANGES
// ============================================

/**
 * Approve a teacher agreement
 * @param {string} agreementId - Agreement UUID
 * @param {string|null} approvedById - User ID who approved (null for auto)
 * @returns {Promise<Object>} Updated agreement
 */
async function approveAgreement(agreementId, approvedById) {
  // Verify agreement exists and is pending
  const existing = await db.query(
    'SELECT * FROM teacher_rental_agreements WHERE id = $1',
    [agreementId]
  );

  if (existing.rows.length === 0) {
    throw new Error('Agreement not found');
  }

  if (existing.rows[0].status !== 'pending') {
    throw new Error('Agreement is not in pending status');
  }

  const result = await db.query(`
    UPDATE teacher_rental_agreements
    SET status = 'active',
        approved_at = NOW(),
        approved_by = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [approvedById, agreementId]);

  return result.rows[0];
}

/**
 * Suspend a teacher agreement
 * @param {string} agreementId - Agreement UUID
 * @param {string} reason - Suspension reason
 * @returns {Promise<Object>} Updated agreement
 */
async function suspendAgreement(agreementId, reason) {
  const result = await db.query(`
    UPDATE teacher_rental_agreements
    SET status = 'suspended',
        notes = COALESCE(notes, '') || E'\n[' || NOW() || '] Suspended: ' || $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [reason, agreementId]);

  if (result.rows.length === 0) {
    throw new Error('Agreement not found');
  }

  return result.rows[0];
}

/**
 * Reactivate a suspended agreement
 * @param {string} agreementId - Agreement UUID
 * @returns {Promise<Object>} Updated agreement
 */
async function reactivateAgreement(agreementId) {
  const result = await db.query(`
    UPDATE teacher_rental_agreements
    SET status = 'active',
        notes = COALESCE(notes, '') || E'\n[' || NOW() || '] Reactivated',
        updated_at = NOW()
    WHERE id = $1 AND status = 'suspended'
    RETURNING *
  `, [agreementId]);

  if (result.rows.length === 0) {
    throw new Error('Agreement not found or not suspended');
  }

  return result.rows[0];
}

/**
 * Terminate a teacher agreement
 * @param {string} agreementId - Agreement UUID
 * @param {string} terminatedById - User ID who terminated
 * @param {string} reason - Termination reason
 * @returns {Promise<Object>} Updated agreement
 */
async function terminateAgreement(agreementId, terminatedById, reason) {
  // Get agreement details
  const agreement = await db.query(
    'SELECT * FROM teacher_rental_agreements WHERE id = $1',
    [agreementId]
  );

  if (agreement.rows.length === 0) {
    throw new Error('Agreement not found');
  }

  // Cancel any future co-op classes
  const cancelled = await db.query(`
    UPDATE classes
    SET is_cancelled = true,
        coop_status = 'cancelled',
        cancellation_reason = 'Agreement terminated',
        cancelled_at = NOW(),
        cancelled_by = $1,
        updated_at = NOW()
    WHERE coop_agreement_id = $2
      AND date > CURRENT_DATE
      AND is_cancelled = false
    RETURNING id
  `, [terminatedById, agreementId]);

  // Update the agreement
  const result = await db.query(`
    UPDATE teacher_rental_agreements
    SET status = 'terminated',
        terminated_at = NOW(),
        terminated_by = $1,
        termination_reason = $2,
        updated_at = NOW()
    WHERE id = $3
    RETURNING *
  `, [terminatedById, reason, agreementId]);

  return {
    ...result.rows[0],
    cancelledClasses: cancelled.rows.length,
  };
}

// ============================================
// GET AGREEMENTS
// ============================================

/**
 * Get active agreement for a teacher
 * @param {string} teacherId - Teacher UUID
 * @returns {Promise<Object|null>} Active agreement or null
 */
async function getTeacherActiveAgreement(teacherId) {
  const result = await db.query(`
    SELECT a.*, r.name as room_name
    FROM teacher_rental_agreements a
    LEFT JOIN rooms r ON a.room_id = r.id
    WHERE a.teacher_id = $1 AND a.status = 'active'
    LIMIT 1
  `, [teacherId]);

  return result.rows[0] || null;
}

/**
 * Get agreement by ID
 * @param {string} agreementId - Agreement UUID
 * @returns {Promise<Object|null>} Agreement
 */
async function getAgreementById(agreementId) {
  const result = await db.query(`
    SELECT a.*,
           r.name as room_name,
           u.first_name as teacher_first_name,
           u.last_name as teacher_last_name,
           u.email as teacher_email
    FROM teacher_rental_agreements a
    LEFT JOIN rooms r ON a.room_id = r.id
    JOIN teachers t ON a.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE a.id = $1
  `, [agreementId]);

  return result.rows[0] || null;
}

/**
 * Get all agreements
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Agreements
 */
async function getAgreements(options = {}) {
  const { status, teacherId, limit = 50, offset = 0 } = options;

  let whereClause = '1=1';
  const params = [];
  let paramIndex = 1;

  if (status) {
    whereClause += ` AND a.status = $${paramIndex++}`;
    params.push(status);
  }

  if (teacherId) {
    whereClause += ` AND a.teacher_id = $${paramIndex++}`;
    params.push(teacherId);
  }

  params.push(limit, offset);

  const result = await db.query(`
    SELECT a.*,
           r.name as room_name,
           u.first_name as teacher_first_name,
           u.last_name as teacher_last_name,
           u.email as teacher_email,
           t.photo_url as teacher_photo
    FROM teacher_rental_agreements a
    LEFT JOIN rooms r ON a.room_id = r.id
    JOIN teachers t ON a.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE ${whereClause}
    ORDER BY a.created_at DESC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `, params);

  return result.rows;
}

/**
 * Get pending agreements count
 * @returns {Promise<number>} Count of pending agreements
 */
async function getPendingAgreementsCount() {
  const result = await db.query(`
    SELECT COUNT(*) as count FROM teacher_rental_agreements
    WHERE status = 'pending'
  `);
  return parseInt(result.rows[0].count);
}

// ============================================
// INSURANCE
// ============================================

/**
 * Verify teacher insurance
 * @param {string} agreementId - Agreement UUID
 * @param {boolean} verified - Whether insurance is verified
 * @param {string} verifiedBy - User ID who verified
 * @param {string} expiryDate - Insurance expiry date (optional)
 * @returns {Promise<Object>} Updated agreement
 */
async function verifyInsurance(agreementId, verified, verifiedBy, expiryDate = null) {
  const result = await db.query(`
    UPDATE teacher_rental_agreements
    SET insurance_verified = $1,
        insurance_expiry = COALESCE($2, insurance_expiry),
        insurance_verified_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
        insurance_verified_by = CASE WHEN $1 THEN $3 ELSE NULL END,
        updated_at = NOW()
    WHERE id = $4
    RETURNING *
  `, [verified, expiryDate, verifiedBy, agreementId]);

  if (result.rows.length === 0) {
    throw new Error('Agreement not found');
  }

  return result.rows[0];
}

/**
 * Get agreements with expiring insurance
 * @param {number} daysAhead - Days ahead to check
 * @returns {Promise<Array>} Agreements with expiring insurance
 */
async function getExpiringInsurance(daysAhead = 30) {
  const result = await db.query(`
    SELECT a.*,
           t.id as teacher_id,
           u.email as teacher_email,
           u.first_name as teacher_first_name,
           u.last_name as teacher_last_name
    FROM teacher_rental_agreements a
    JOIN teachers t ON a.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE a.status = 'active'
      AND a.insurance_required = true
      AND a.insurance_expiry IS NOT NULL
      AND a.insurance_expiry <= CURRENT_DATE + $1
    ORDER BY a.insurance_expiry
  `, [daysAhead]);

  return result.rows;
}

// ============================================
// CONTRACT
// ============================================

/**
 * Update agreement details
 * @param {string} agreementId - Agreement UUID
 * @param {Object} data - Data to update
 * @returns {Promise<Object>} Updated agreement
 */
async function updateAgreement(agreementId, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = {
    rental_rate_override: 'rental_rate_override',
    monthly_fee: 'fixed_rate',
    credit_reimbursement_rate: 'credit_reimbursement_rate',
    minimum_classes_per_month: 'minimum_classes_per_month',
    max_weekly_hours: 'max_weekly_hours',
    end_date: 'end_date',
    terms: 'notes',
  };

  for (const [key, column] of Object.entries(allowedFields)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = $${paramIndex++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) {
    return getAgreementById(agreementId);
  }

  fields.push('updated_at = NOW()');
  values.push(agreementId);

  const result = await db.query(`
    UPDATE teacher_rental_agreements
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  if (result.rows.length === 0) {
    throw new Error('Agreement not found');
  }

  return result.rows[0];
}

/**
 * Record contract signature
 * @param {string} agreementId - Agreement UUID
 * @param {string} contractUrl - URL to signed contract
 * @returns {Promise<Object>} Updated agreement
 */
async function recordContractSignature(agreementId, contractUrl) {
  const result = await db.query(`
    UPDATE teacher_rental_agreements
    SET contract_url = $1,
        contract_signed_at = NOW(),
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [contractUrl, agreementId]);

  if (result.rows.length === 0) {
    throw new Error('Agreement not found');
  }

  return result.rows[0];
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Create & Update
  createAgreement,
  updateAgreement,

  // Status changes
  approveAgreement,
  suspendAgreement,
  reactivateAgreement,
  terminateAgreement,

  // Get
  getTeacherActiveAgreement,
  getAgreementById,
  getAgreements,
  getPendingAgreementsCount,

  // Insurance
  verifyInsurance,
  getExpiringInsurance,

  // Contract
  recordContractSignature,
};
