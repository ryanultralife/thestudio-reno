// ============================================
// WEBHOOK ROUTES
// ============================================

const express = require('express');
const db = require('../database/connection');
const notifications = require('../services/notifications');

const router = express.Router();

// ============================================
// STRIPE WEBHOOK
// ============================================

router.post('/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Stripe webhook signature failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutComplete(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleSubscriptionPayment(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object);
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Stripe webhook error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
});

async function handleCheckoutComplete(session) {
  const client = await db.getClient();
  
  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      'SELECT id, email, first_name FROM users WHERE email = $1',
      [session.customer_email]
    );

    if (userResult.rows.length === 0) {
      console.error('User not found:', session.customer_email);
      return;
    }

    const user = userResult.rows[0];
    const metadata = session.metadata || {};

    // Create transaction
    await client.query(`
      INSERT INTO transactions (user_id, type, amount, total, payment_method, stripe_payment_id, membership_type_id, status)
      VALUES ($1, 'membership_purchase', $2, $2, 'stripe', $3, $4, 'completed')
    `, [user.id, session.amount_total / 100, session.payment_intent, metadata.membership_type_id]);

    // Create membership if applicable
    if (metadata.membership_type_id) {
      const typeResult = await client.query(
        'SELECT * FROM membership_types WHERE id = $1',
        [metadata.membership_type_id]
      );

      if (typeResult.rows.length > 0) {
        const membershipType = typeResult.rows[0];
        
        let endDate = null;
        if (membershipType.duration_days) {
          endDate = new Date();
          endDate.setDate(endDate.getDate() + membershipType.duration_days);
        }

        // Deactivate existing
        await client.query(
          `UPDATE user_memberships SET status = 'expired' WHERE user_id = $1 AND status = 'active'`,
          [user.id]
        );

        // Create new
        await client.query(`
          INSERT INTO user_memberships (user_id, membership_type_id, end_date, credits_remaining, status, stripe_subscription_id)
          VALUES ($1, $2, $3, $4, 'active', $5)
        `, [user.id, metadata.membership_type_id, endDate, membershipType.credits, session.subscription]);
      }
    }

    await client.query('COMMIT');
    console.log('✅ Checkout processed:', user.email);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function handleSubscriptionPayment(invoice) {
  const result = await db.query(`
    SELECT um.*, mt.duration_days FROM user_memberships um
    JOIN membership_types mt ON um.membership_type_id = mt.id
    WHERE um.stripe_subscription_id = $1
  `, [invoice.subscription]);

  if (result.rows.length > 0) {
    const membership = result.rows[0];
    
    let newEndDate = new Date();
    if (membership.duration_days) {
      newEndDate.setDate(newEndDate.getDate() + membership.duration_days);
    }

    await db.query(
      `UPDATE user_memberships SET end_date = $1, status = 'active' WHERE id = $2`,
      [newEndDate, membership.id]
    );

    await db.query(`
      INSERT INTO transactions (user_id, type, amount, total, payment_method, stripe_payment_id, membership_type_id, status)
      VALUES ($1, 'membership_purchase', $2, $2, 'stripe', $3, $4, 'completed')
    `, [membership.user_id, invoice.amount_paid / 100, invoice.payment_intent, membership.membership_type_id]);
  }
}

async function handlePaymentFailed(invoice) {
  const result = await db.query(`
    SELECT um.user_id FROM user_memberships um WHERE um.stripe_subscription_id = $1
  `, [invoice.subscription]);

  if (result.rows.length > 0) {
    await notifications.notify(result.rows[0].user_id, 'payment_failed', {});
  }
}

async function handleSubscriptionCancelled(subscription) {
  await db.query(
    `UPDATE user_memberships SET status = 'cancelled' WHERE stripe_subscription_id = $1`,
    [subscription.id]
  );
}

// ============================================
// CRON: DAILY TASKS
// ============================================

router.post('/cron/daily', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const stats = { reminders: 0, expired: 0, no_shows: 0 };

  try {
    // 1. Send class reminders for tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const bookings = await db.query(`
      SELECT b.user_id, ct.name as class_name, c.start_time, l.name as location_name
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      WHERE c.date = $1 AND b.status = 'booked'
    `, [tomorrowStr]);

    for (const booking of bookings.rows) {
      await notifications.notifyClassReminder(booking.user_id, booking);
      stats.reminders++;
    }

    // 2. Expire memberships
    const expireResult = await db.query(`
      UPDATE user_memberships SET status = 'expired'
      WHERE status = 'active' AND end_date < CURRENT_DATE
    `);
    stats.expired = expireResult.rowCount;

    // 3. Mark no-shows from yesterday
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    const noShowResult = await db.query(`
      UPDATE bookings b SET status = 'no_show'
      FROM classes c
      WHERE b.class_id = c.id AND c.date = $1 AND b.status = 'booked'
    `, [yesterdayStr]);
    stats.no_shows = noShowResult.rowCount;

    // 4. Send membership expiring reminders (7 days out)
    const expiringDate = new Date();
    expiringDate.setDate(expiringDate.getDate() + 7);
    const expiringStr = expiringDate.toISOString().split('T')[0];

    const expiring = await db.query(`
      SELECT um.user_id, mt.name as membership_name
      FROM user_memberships um
      JOIN membership_types mt ON um.membership_type_id = mt.id
      WHERE um.status = 'active' AND um.end_date = $1
    `, [expiringStr]);

    for (const m of expiring.rows) {
      await notifications.notifyMembershipExpiring(m.user_id, { 
        membership_name: m.membership_name, 
        days_until_expiry: 7 
      });
    }

    console.log('✅ Daily cron completed:', stats);
    res.json({ message: 'Daily tasks completed', stats });
  } catch (error) {
    console.error('Cron failed:', error);
    res.status(500).json({ error: 'Cron failed' });
  }
});

// ============================================
// CRON: BIRTHDAY WISHES
// ============================================

router.post('/cron/birthdays', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const result = await db.query(`
      SELECT id, first_name, email
      FROM users
      WHERE date_of_birth IS NOT NULL
        AND EXTRACT(MONTH FROM date_of_birth) = EXTRACT(MONTH FROM CURRENT_DATE)
        AND EXTRACT(DAY FROM date_of_birth) = EXTRACT(DAY FROM CURRENT_DATE)
        AND is_active = true
    `);

    for (const user of result.rows) {
      await notifications.notify(user.id, 'birthday', {});
    }

    res.json({ message: 'Birthday wishes sent', count: result.rows.length });
  } catch (error) {
    console.error('Birthday cron failed:', error);
    res.status(500).json({ error: 'Cron failed' });
  }
});

// ============================================
// CRON: GENERATE SCHEDULE (Weekly)
// ============================================

router.post('/cron/generate-schedule', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const scheduleService = require('../services/schedule');
    const result = await scheduleService.generateWeeksAhead(2);
    
    console.log('✅ Schedule generated:', result);
    res.json({ message: 'Schedule generated', ...result });
  } catch (error) {
    console.error('Schedule generation failed:', error);
    res.status(500).json({ error: 'Schedule generation failed' });
  }
});

// ============================================
// CRON: PROCESS SCHEDULED SOCIAL POSTS
// ============================================

router.post('/cron/social-posts', async (req, res) => {
  if (req.headers['x-cron-secret'] !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const social = require('../services/social');
    const count = await social.processScheduledPosts();
    
    console.log('✅ Processed scheduled social posts:', count);
    res.json({ message: 'Social posts processed', count });
  } catch (error) {
    console.error('Social posts processing failed:', error);
    res.status(500).json({ error: 'Social posts processing failed' });
  }
});

module.exports = router;
