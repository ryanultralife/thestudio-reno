// ============================================
// PAYOUT SERVICE WITH STRIPE CONNECT
// Process teacher payouts
// ============================================

const db = require('../../database/connection');
const { getCoopSettings } = require('./settings');

// Note: In production, you'd import Stripe:
// const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ============================================
// STRIPE CONNECT ACCOUNT MANAGEMENT
// ============================================

/**
 * Create Stripe Connect Express account for teacher
 * @param {string} teacherId - Teacher UUID
 * @returns {Promise<Object>} Stripe account details
 */
async function createTeacherConnectAccount(teacherId) {
  // Get teacher details
  const teacher = await db.query(`
    SELECT t.*, u.email, u.first_name, u.last_name
    FROM teachers t
    JOIN users u ON t.user_id = u.id
    WHERE t.id = $1
  `, [teacherId]);

  if (!teacher.rows[0]) {
    throw new Error('Teacher not found');
  }

  const t = teacher.rows[0];

  // Check if already has account
  if (t.stripe_connect_account_id) {
    throw new Error('Teacher already has a Stripe Connect account');
  }

  // In production, create Stripe Express account:
  /*
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'US',
    email: t.email,
    capabilities: {
      transfers: { requested: true },
    },
    business_type: 'individual',
    individual: {
      email: t.email,
      first_name: t.first_name,
      last_name: t.last_name,
    },
    metadata: {
      teacher_id: teacherId,
      platform: 'thestudioreno',
    },
  });
  */

  // For development, simulate account creation
  const mockAccountId = `acct_mock_${teacherId.slice(0, 8)}`;

  // Save account ID
  await db.query(`
    UPDATE teachers
    SET stripe_connect_account_id = $1, updated_at = NOW()
    WHERE id = $2
  `, [mockAccountId, teacherId]);

  return {
    accountId: mockAccountId,
    message: 'Stripe Connect account created (mock)',
  };
}

/**
 * Create Stripe Connect onboarding link
 * @param {string} teacherId - Teacher UUID
 * @param {string} refreshUrl - URL to redirect if link expires
 * @param {string} returnUrl - URL to redirect after onboarding
 * @returns {Promise<Object>} Onboarding link
 */
async function createOnboardingLink(teacherId, refreshUrl, returnUrl) {
  const teacher = await db.query(
    'SELECT stripe_connect_account_id FROM teachers WHERE id = $1',
    [teacherId]
  );

  if (!teacher.rows[0]?.stripe_connect_account_id) {
    throw new Error('Teacher does not have a Stripe account');
  }

  // In production, create onboarding link:
  /*
  const accountLink = await stripe.accountLinks.create({
    account: teacher.rows[0].stripe_connect_account_id,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
  return accountLink;
  */

  // For development, return mock link
  return {
    url: `${returnUrl}?stripe_onboarding=success`,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
  };
}

/**
 * Check and update teacher's Stripe account status
 * @param {string} teacherId - Teacher UUID
 * @returns {Promise<Object>} Account status
 */
async function getTeacherAccountStatus(teacherId) {
  const teacher = await db.query(
    'SELECT * FROM teachers WHERE id = $1',
    [teacherId]
  );

  if (!teacher.rows[0]) {
    throw new Error('Teacher not found');
  }

  const t = teacher.rows[0];

  if (!t.stripe_connect_account_id) {
    return {
      status: 'not_created',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    };
  }

  // In production, retrieve account from Stripe:
  /*
  const account = await stripe.accounts.retrieve(t.stripe_connect_account_id);

  // Update our records
  await db.query(`
    UPDATE teachers
    SET stripe_connect_onboarding_complete = $1,
        stripe_connect_charges_enabled = $2,
        stripe_connect_payouts_enabled = $3,
        updated_at = NOW()
    WHERE id = $4
  `, [account.details_submitted, account.charges_enabled, account.payouts_enabled, teacherId]);

  return {
    accountId: account.id,
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: account.requirements,
  };
  */

  // For development, return current status from DB
  return {
    status: t.stripe_connect_onboarding_complete ? 'active' : 'pending',
    accountId: t.stripe_connect_account_id,
    chargesEnabled: t.stripe_connect_charges_enabled,
    payoutsEnabled: t.stripe_connect_payouts_enabled,
    detailsSubmitted: t.stripe_connect_onboarding_complete,
  };
}

/**
 * Update teacher's Stripe Connect status (called by webhook or manually)
 * @param {string} stripeAccountId - Stripe account ID
 * @param {Object} status - Status updates
 * @returns {Promise<Object>} Updated teacher record
 */
async function updateAccountStatus(stripeAccountId, status) {
  const result = await db.query(`
    UPDATE teachers
    SET stripe_connect_onboarding_complete = COALESCE($1, stripe_connect_onboarding_complete),
        stripe_connect_charges_enabled = COALESCE($2, stripe_connect_charges_enabled),
        stripe_connect_payouts_enabled = COALESCE($3, stripe_connect_payouts_enabled),
        updated_at = NOW()
    WHERE stripe_connect_account_id = $4
    RETURNING *
  `, [
    status.detailsSubmitted,
    status.chargesEnabled,
    status.payoutsEnabled,
    stripeAccountId
  ]);

  return result.rows[0];
}

/**
 * Create Stripe dashboard login link for teacher
 * @param {string} teacherId - Teacher UUID
 * @returns {Promise<Object>} Dashboard link
 */
async function createDashboardLink(teacherId) {
  const teacher = await db.query(
    'SELECT stripe_connect_account_id FROM teachers WHERE id = $1',
    [teacherId]
  );

  if (!teacher.rows[0]?.stripe_connect_account_id) {
    throw new Error('Teacher does not have a Stripe account');
  }

  // In production:
  /*
  const loginLink = await stripe.accounts.createLoginLink(
    teacher.rows[0].stripe_connect_account_id
  );
  return loginLink;
  */

  // For development
  return {
    url: 'https://dashboard.stripe.com/express/mock',
    created: Math.floor(Date.now() / 1000),
  };
}

// ============================================
// PAYOUT PROCESSING
// ============================================

/**
 * Process payouts for all eligible teachers
 * @returns {Promise<Array>} Payout results
 */
async function processPayouts() {
  const settings = await getCoopSettings();
  const minimumPayout = settings.minimum_payout_amount || 25.00;

  // Get teachers with pending balances above minimum
  const pendingPayouts = await db.query(`
    SELECT
      t.id as teacher_id,
      t.stripe_connect_account_id,
      u.email,
      SUM(rt.amount) as balance
    FROM rental_transactions rt
    JOIN teachers t ON rt.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE rt.status = 'pending'
      AND t.stripe_connect_payouts_enabled = true
    GROUP BY t.id, t.stripe_connect_account_id, u.email
    HAVING SUM(rt.amount) >= $1
  `, [minimumPayout]);

  const results = [];

  for (const payout of pendingPayouts.rows) {
    try {
      const result = await processTeacherPayout(
        payout.teacher_id,
        payout.balance,
        payout.stripe_connect_account_id
      );
      results.push({ teacherId: payout.teacher_id, success: true, ...result });
    } catch (error) {
      results.push({ teacherId: payout.teacher_id, success: false, error: error.message });
    }
  }

  return results;
}

/**
 * Process payout for a single teacher
 * @param {string} teacherId - Teacher UUID
 * @param {number} amount - Amount to pay out
 * @param {string} stripeAccountId - Teacher's Stripe Connect account
 * @returns {Promise<Object>} Payout result
 */
async function processTeacherPayout(teacherId, amount, stripeAccountId) {
  if (amount <= 0) {
    throw new Error('Payout amount must be positive');
  }

  // Create settlement batch
  const batch = await db.query(`
    INSERT INTO settlement_batches (
      period_start, period_end, status
    ) VALUES (CURRENT_DATE - 7, CURRENT_DATE, 'processing')
    RETURNING id
  `);

  const batchId = batch.rows[0].id;

  try {
    // Mark transactions as processing
    await db.query(`
      UPDATE rental_transactions
      SET settlement_batch_id = $1, status = 'processing', updated_at = NOW()
      WHERE teacher_id = $2 AND status = 'pending'
    `, [batchId, teacherId]);

    // In production, create Stripe transfer:
    /*
    const transfer = await stripe.transfers.create({
      amount: Math.round(amount * 100), // cents
      currency: 'usd',
      destination: stripeAccountId,
      description: `The Studio Reno payout - ${new Date().toISOString().split('T')[0]}`,
      metadata: {
        teacher_id: teacherId,
        batch_id: batchId,
      },
    });
    const transferId = transfer.id;
    */

    // For development, simulate transfer
    const transferId = `tr_mock_${Date.now()}`;

    // Record payout transaction
    await db.query(`
      INSERT INTO rental_transactions (
        teacher_id, transaction_type, amount, status,
        stripe_transfer_id, settlement_batch_id, transaction_date, description
      ) VALUES ($1, 'payout', $2, 'completed', $3, $4, CURRENT_DATE, 'Weekly payout')
    `, [teacherId, -amount, transferId, batchId]);

    // Mark settled transactions as completed
    await db.query(`
      UPDATE rental_transactions
      SET status = 'completed', settled_at = NOW(), updated_at = NOW()
      WHERE settlement_batch_id = $1 AND teacher_id = $2 AND status = 'processing'
    `, [batchId, teacherId]);

    // Update batch with totals
    const totals = await db.query(`
      SELECT
        SUM(ABS(amount)) FILTER (WHERE transaction_type = 'rental_fee') as rental_fees,
        SUM(amount) FILTER (WHERE transaction_type = 'class_revenue') as revenue,
        SUM(amount) FILTER (WHERE transaction_type = 'credit_reimbursement') as reimbursements
      FROM rental_transactions
      WHERE settlement_batch_id = $1 AND transaction_type != 'payout'
    `, [batchId]);

    await db.query(`
      UPDATE settlement_batches
      SET status = 'completed',
          processed_at = NOW(),
          total_rental_fees = $1,
          total_class_revenue = $2,
          total_credit_reimbursements = $3,
          net_teacher_earnings = $4
      WHERE id = $5
    `, [
      totals.rows[0].rental_fees || 0,
      totals.rows[0].revenue || 0,
      totals.rows[0].reimbursements || 0,
      amount,
      batchId
    ]);

    return {
      transferId,
      amount,
      batchId,
    };

  } catch (error) {
    // Rollback on failure
    await db.query(`
      UPDATE rental_transactions
      SET status = 'pending', settlement_batch_id = NULL, updated_at = NOW()
      WHERE settlement_batch_id = $1
    `, [batchId]);

    await db.query(`
      UPDATE settlement_batches
      SET status = 'failed', error_message = $1
      WHERE id = $2
    `, [error.message, batchId]);

    throw error;
  }
}

/**
 * Process payout for a single teacher by ID (admin triggered)
 * @param {string} teacherId - Teacher UUID
 * @returns {Promise<Object>} Payout result
 */
async function processPayoutForTeacher(teacherId) {
  // Get teacher's pending balance
  const balance = await db.query(`
    SELECT SUM(amount) as balance, t.stripe_connect_account_id
    FROM rental_transactions rt
    JOIN teachers t ON rt.teacher_id = t.id
    WHERE rt.teacher_id = $1 AND rt.status = 'pending'
    GROUP BY t.stripe_connect_account_id
  `, [teacherId]);

  if (balance.rows.length === 0 || parseFloat(balance.rows[0].balance) <= 0) {
    throw new Error('No pending balance for payout');
  }

  const row = balance.rows[0];

  if (!row.stripe_connect_account_id) {
    throw new Error('Teacher does not have a Stripe Connect account');
  }

  return processTeacherPayout(
    teacherId,
    parseFloat(row.balance),
    row.stripe_connect_account_id
  );
}

// ============================================
// SETTLEMENT BATCHES
// ============================================

/**
 * Get settlement batches
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Settlement batches
 */
async function getSettlementBatches(options = {}) {
  const { status, limit = 50, offset = 0 } = options;

  let whereClause = '1=1';
  const params = [];

  if (status) {
    params.push(status);
    whereClause += ` AND status = $${params.length}`;
  }

  params.push(limit, offset);

  const result = await db.query(`
    SELECT * FROM settlement_batches
    WHERE ${whereClause}
    ORDER BY created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `, params);

  return result.rows;
}

/**
 * Get settlement batch by ID
 * @param {string} batchId - Batch UUID
 * @returns {Promise<Object>} Batch with transactions
 */
async function getSettlementBatchById(batchId) {
  const batch = await db.query(
    'SELECT * FROM settlement_batches WHERE id = $1',
    [batchId]
  );

  if (batch.rows.length === 0) {
    throw new Error('Settlement batch not found');
  }

  const transactions = await db.query(`
    SELECT rt.*,
           u.first_name || ' ' || u.last_name as teacher_name
    FROM rental_transactions rt
    JOIN teachers t ON rt.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE rt.settlement_batch_id = $1
    ORDER BY rt.created_at
  `, [batchId]);

  return {
    batch: batch.rows[0],
    transactions: transactions.rows,
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Stripe Connect
  createTeacherConnectAccount,
  createOnboardingLink,
  getTeacherAccountStatus,
  updateAccountStatus,
  createDashboardLink,

  // Payouts
  processPayouts,
  processTeacherPayout,
  processPayoutForTeacher,

  // Settlement
  getSettlementBatches,
  getSettlementBatchById,
};
