// ============================================
// MEMBERSHIP ROUTES
// ============================================

const express = require('express');
const { body } = require('express-validator');
const db = require('../database/connection');
const { authenticate, requirePermission } = require('../middleware/auth');

const router = express.Router();

// ============================================
// GET AVAILABLE MEMBERSHIPS (Public)
// ============================================

router.get('/types', async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT id, name, description, price, type, duration_days, credits,
             is_intro_offer, sort_order
      FROM membership_types
      WHERE is_active = true
      ORDER BY sort_order, price
    `);

    res.json({ membership_types: result.rows });
  } catch (error) {
    next(error);
  }
});

// ============================================
// GET MY MEMBERSHIP
// ============================================

router.get('/mine', authenticate, async (req, res, next) => {
  try {
    const result = await db.query(`
      SELECT 
        um.id, um.start_date, um.end_date, um.credits_remaining, um.status,
        um.paused_at, um.pause_until,
        mt.name, mt.type, mt.price, mt.duration_days, mt.credits as total_credits
      FROM user_memberships um
      JOIN membership_types mt ON um.membership_type_id = mt.id
      WHERE um.user_id = $1
      ORDER BY um.status = 'active' DESC, um.created_at DESC
    `, [req.user.id]);

    // Get usage stats
    const statsResult = await db.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'checked_in') as total_classes,
        COUNT(*) FILTER (WHERE status = 'checked_in' AND DATE_TRUNC('month', booked_at) = DATE_TRUNC('month', NOW())) as this_month
      FROM bookings
      WHERE user_id = $1
    `, [req.user.id]);

    res.json({
      memberships: result.rows,
      active: result.rows.find(m => m.status === 'active'),
      stats: statsResult.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PURCHASE MEMBERSHIP (Creates Stripe checkout)
// ============================================

router.post('/purchase', authenticate, [
  body('membership_type_id').isUUID(),
], async (req, res, next) => {
  try {
    const { membership_type_id } = req.body;

    // Get membership type
    const typeResult = await db.query(
      'SELECT * FROM membership_types WHERE id = $1 AND is_active = true',
      [membership_type_id]
    );

    if (typeResult.rows.length === 0) {
      return res.status(404).json({ error: 'Membership type not found' });
    }

    const membershipType = typeResult.rows[0];

    // Check intro offer eligibility
    if (membershipType.is_intro_offer) {
      const previousIntro = await db.query(`
        SELECT COUNT(*) FROM user_memberships um
        JOIN membership_types mt ON um.membership_type_id = mt.id
        WHERE um.user_id = $1 AND mt.is_intro_offer = true
      `, [req.user.id]);

      if (parseInt(previousIntro.rows[0].count) >= (membershipType.intro_limit_per_user || 1)) {
        return res.status(400).json({ error: 'Intro offer already used' });
      }
    }

    // Create Stripe checkout session
    const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: membershipType.name,
            description: membershipType.description,
          },
          unit_amount: Math.round(membershipType.price * 100),
        },
        quantity: 1,
      }],
      mode: membershipType.requires_autopay ? 'subscription' : 'payment',
      success_url: `${process.env.FRONTEND_URL}/membership/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/membership/cancel`,
      customer_email: req.user.email,
      metadata: {
        user_id: req.user.id,
        membership_type_id: membership_type_id,
      },
    });

    res.json({ checkout_url: session.url, session_id: session.id });
  } catch (error) {
    next(error);
  }
});

// ============================================
// SELL MEMBERSHIP (Staff)
// ============================================

router.post('/sell', authenticate, requirePermission('membership.sell'), [
  body('user_id').isUUID(),
  body('membership_type_id').isUUID(),
  body('payment_method').optional().isString(),
], async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    const { user_id, membership_type_id, payment_method, notes } = req.body;

    await client.query('BEGIN');

    // Get membership type
    const typeResult = await client.query(
      'SELECT * FROM membership_types WHERE id = $1',
      [membership_type_id]
    );

    if (typeResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Membership type not found' });
    }

    const membershipType = typeResult.rows[0];

    // Calculate dates
    const startDate = new Date();
    let endDate = null;
    if (membershipType.duration_days) {
      endDate = new Date();
      endDate.setDate(endDate.getDate() + membershipType.duration_days);
    }

    // Deactivate existing active membership
    await client.query(
      `UPDATE user_memberships SET status = 'expired' WHERE user_id = $1 AND status = 'active'`,
      [user_id]
    );

    // Create membership
    const membershipResult = await client.query(`
      INSERT INTO user_memberships (user_id, membership_type_id, start_date, end_date, credits_remaining, status)
      VALUES ($1, $2, $3, $4, $5, 'active')
      RETURNING *
    `, [user_id, membership_type_id, startDate, endDate, membershipType.credits]);

    // Create transaction
    await client.query(`
      INSERT INTO transactions (user_id, type, amount, total, payment_method, membership_type_id, processed_by, notes, status)
      VALUES ($1, 'membership_purchase', $2, $2, $3, $4, $5, $6, 'completed')
    `, [user_id, membershipType.price, payment_method || 'in_person', membership_type_id, req.user.id, notes]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Membership sold',
      membership: membershipResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ============================================
// COMP MEMBERSHIP (Manager+)
// ============================================

router.post('/comp', authenticate, requirePermission('membership.comp'), [
  body('user_id').isUUID(),
  body('membership_type_id').isUUID(),
  body('reason').notEmpty(),
], async (req, res, next) => {
  const client = await db.getClient();
  
  try {
    const { user_id, membership_type_id, reason } = req.body;

    await client.query('BEGIN');

    const typeResult = await client.query(
      'SELECT * FROM membership_types WHERE id = $1',
      [membership_type_id]
    );

    const membershipType = typeResult.rows[0];

    let endDate = null;
    if (membershipType.duration_days) {
      endDate = new Date();
      endDate.setDate(endDate.getDate() + membershipType.duration_days);
    }

    // Create comp membership
    const membershipResult = await client.query(`
      INSERT INTO user_memberships (user_id, membership_type_id, end_date, credits_remaining, status)
      VALUES ($1, $2, $3, $4, 'active')
      RETURNING *
    `, [user_id, membership_type_id, endDate, membershipType.credits]);

    // Create comp transaction
    await client.query(`
      INSERT INTO transactions (user_id, type, amount, total, membership_type_id, processed_by, notes, status)
      VALUES ($1, 'comp', 0, 0, $2, $3, $4, 'completed')
    `, [user_id, membership_type_id, req.user.id, `COMP: ${reason}`]);

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Complimentary membership created',
      membership: membershipResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// ============================================
// ADD CREDITS (Staff)
// ============================================

router.post('/:id/add-credits', authenticate, requirePermission('membership.sell'), [
  body('credits').isInt({ min: 1 }),
  body('reason').optional(),
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { credits, reason } = req.body;

    const result = await db.query(`
      UPDATE user_memberships 
      SET credits_remaining = credits_remaining + $1
      WHERE id = $2
      RETURNING *
    `, [credits, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    // Log the adjustment
    await db.query(`
      INSERT INTO transactions (user_id, type, amount, total, processed_by, notes, status)
      VALUES ($1, 'adjustment', 0, 0, $2, $3, 'completed')
    `, [result.rows[0].user_id, req.user.id, `Added ${credits} credits: ${reason || 'Staff adjustment'}`]);

    res.json({
      message: `Added ${credits} credits`,
      membership: result.rows[0],
    });
  } catch (error) {
    next(error);
  }
});

// ============================================
// PAUSE MEMBERSHIP (User)
// ============================================

router.post('/:id/pause', authenticate, [
  body('until').isISO8601(),
], async (req, res, next) => {
  try {
    const { id } = req.params;
    const { until } = req.body;

    // Verify ownership
    const membership = await db.query(
      'SELECT * FROM user_memberships WHERE id = $1 AND user_id = $2 AND status = \'active\'',
      [id, req.user.id]
    );

    if (membership.rows.length === 0) {
      return res.status(404).json({ error: 'Membership not found' });
    }

    const result = await db.query(`
      UPDATE user_memberships 
      SET status = 'paused', paused_at = NOW(), pause_until = $1
      WHERE id = $2
      RETURNING *
    `, [until, id]);

    res.json({ message: 'Membership paused', membership: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// ============================================
// RESUME MEMBERSHIP (User)
// ============================================

router.post('/:id/resume', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      UPDATE user_memberships 
      SET status = 'active', paused_at = NULL, pause_until = NULL,
          end_date = CASE 
            WHEN end_date IS NOT NULL AND paused_at IS NOT NULL 
            THEN end_date + (NOW() - paused_at)
            ELSE end_date
          END
      WHERE id = $1 AND user_id = $2 AND status = 'paused'
      RETURNING *
    `, [id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Paused membership not found' });
    }

    res.json({ message: 'Membership resumed', membership: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
