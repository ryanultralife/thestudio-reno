// ============================================
// TRANSACTION ROUTES
// ============================================

const express = require('express');
const db = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// ============================================
// GET MY TRANSACTIONS
// ============================================

router.get('/mine', async (req, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    const result = await db.query(`
      SELECT 
        t.id, t.type, t.amount, t.total, t.payment_method, t.status, t.notes, t.created_at,
        mt.name as membership_name
      FROM transactions t
      LEFT JOIN membership_types mt ON t.membership_type_id = mt.id
      WHERE t.user_id = $1
      ORDER BY t.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);

    res.json({ transactions: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET ALL TRANSACTIONS (Staff)
// ============================================

router.get('/', requirePermission('transaction.view_all'), async (req, res, next) => {
  try {
    const { limit = 50, offset = 0, type, start_date, end_date, user_id } = req.query;

    let query = `
      SELECT 
        t.id, t.type, t.amount, t.total, t.payment_method, t.status, t.notes, t.created_at,
        mt.name as membership_name,
        u.first_name, u.last_name, u.email,
        staff.first_name as processed_by_first, staff.last_name as processed_by_last
      FROM transactions t
      LEFT JOIN membership_types mt ON t.membership_type_id = mt.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users staff ON t.processed_by = staff.id
      WHERE 1=1
    `;

    const params = [];
    let idx = 1;

    if (type) {
      query += ` AND t.type = $${idx}`;
      params.push(type);
      idx++;
    }

    if (start_date) {
      query += ` AND t.created_at >= $${idx}`;
      params.push(start_date);
      idx++;
    }

    if (end_date) {
      query += ` AND t.created_at <= $${idx}`;
      params.push(end_date);
      idx++;
    }

    if (user_id) {
      query += ` AND t.user_id = $${idx}`;
      params.push(user_id);
      idx++;
    }

    query += ` ORDER BY t.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    // Get totals for date range
    let totalsQuery = `
      SELECT 
        SUM(total) FILTER (WHERE type != 'refund') as revenue,
        SUM(total) FILTER (WHERE type = 'refund') as refunds,
        COUNT(*) as count
      FROM transactions
      WHERE status = 'completed'
    `;

    if (start_date && end_date) {
      totalsQuery += ` AND created_at BETWEEN $1 AND $2`;
      const totals = await db.query(totalsQuery, [start_date, end_date]);
      res.json({ transactions: result.rows, totals: totals.rows[0] });
    } else {
      res.json({ transactions: result.rows });
    }
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET TRANSACTION DETAILS
// ============================================

router.get('/:id', requirePermission('transaction.view_all'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT 
        t.*,
        mt.name as membership_name, mt.type as membership_type,
        u.first_name, u.last_name, u.email, u.phone,
        staff.first_name as processed_by_first, staff.last_name as processed_by_last
      FROM transactions t
      LEFT JOIN membership_types mt ON t.membership_type_id = mt.id
      LEFT JOIN users u ON t.user_id = u.id
      LEFT JOIN users staff ON t.processed_by = staff.id
      WHERE t.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({ transaction: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PROCESS REFUND (Manager+)
// ============================================

router.post('/:id/refund', requirePermission('transaction.refund'), async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await client.query('BEGIN');

    // Get original transaction
    const original = await client.query(
      'SELECT * FROM transactions WHERE id = $1 AND status = $2',
      [id, 'completed']
    );

    if (original.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Transaction not found or already refunded' });
    }

    const txn = original.rows[0];

    // SECURITY FIX: Process Stripe refund FIRST before marking in database
    // This ensures database only shows "refunded" if money was actually returned
    let stripeRefund = null;
    if (txn.stripe_payment_id && process.env.STRIPE_SECRET_KEY) {
      try {
        const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
        stripeRefund = await stripe.refunds.create({
          payment_intent: txn.stripe_payment_id,
          reason: 'requested_by_customer',
        });

        console.log(`✅ Stripe refund created: ${stripeRefund.id}`);
      } catch (stripeError) {
        await client.query('ROLLBACK');
        console.error('Stripe refund failed:', stripeError);

        // Return error to user - don't proceed with database changes
        return res.status(500).json({
          error: 'Stripe refund failed',
          message: stripeError.message,
          details: 'The refund could not be processed through Stripe. Please contact support or process manually.',
        });
      }
    }

    // Only mark as refunded in database AFTER Stripe confirms
    // Create refund transaction
    await client.query(`
      INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, processed_by, notes, stripe_payment_id, status)
      VALUES ($1, 'refund', $2, $3, $4, $5, $6, $7, $8, 'completed')
    `, [
      txn.user_id,
      -txn.amount,
      -txn.total,
      txn.payment_method,
      txn.membership_type_id,
      req.user.id,
      `Refund for txn ${id}: ${reason}`,
      stripeRefund ? stripeRefund.id : null, // Store Stripe refund ID
    ]);

    // Mark original as refunded
    await client.query(
      'UPDATE transactions SET status = $1 WHERE id = $2',
      ['refunded', id]
    );

    // If membership purchase, cancel the membership
    if (txn.membership_type_id) {
      await client.query(`
        UPDATE user_memberships
        SET status = 'cancelled'
        WHERE user_id = $1 AND membership_type_id = $2 AND status = 'active'
      `, [txn.user_id, txn.membership_type_id]);
    }

    await client.query('COMMIT');

    res.json({
      message: 'Refund processed successfully',
      amount: txn.total,
      stripe_refund_id: stripeRefund ? stripeRefund.id : null,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
