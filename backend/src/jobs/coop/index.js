// ============================================
// CO-OP BACKGROUND JOBS
// Scheduled tasks for co-op system maintenance
// ============================================

const { allocateMonthlyCredits, expireUnusedCredits } = require('../../services/coop/credits');
const { processPayouts } = require('../../services/coop/payouts');
const { getExpiringInsurance } = require('../../services/coop/agreements');
const notifications = require('../../services/notifications');
const db = require('../../database/connection');

// ============================================
// ALLOCATE MONTHLY CREDITS
// Run: 1st of every month at 00:01
// ============================================

async function runMonthlyCreditsAllocation() {
  console.log('[Co-op Job] Starting monthly credits allocation...');

  try {
    const result = await allocateMonthlyCredits();

    console.log(`[Co-op Job] Monthly credits allocated: ${result.allocated} members`);
    console.log(`[Co-op Job] Period: ${result.periodStart} to ${result.periodEnd}`);

    if (result.errors && result.errors.length > 0) {
      console.error('[Co-op Job] Errors during allocation:', result.errors);
    }

    return result;
  } catch (error) {
    console.error('[Co-op Job] Monthly credits allocation failed:', error);
    throw error;
  }
}

// ============================================
// EXPIRE UNUSED CREDITS
// Run: Daily at 00:05
// ============================================

async function runExpireUnusedCredits() {
  console.log('[Co-op Job] Starting credit expiration check...');

  try {
    const result = await expireUnusedCredits();

    console.log(`[Co-op Job] Expired credits for ${result.expired} allocations`);

    // Optionally notify users about expired credits
    if (result.details && result.details.length > 0) {
      for (const detail of result.details) {
        try {
          await notifications.sendNotification(detail.user_id, {
            type: 'coop_credits_expired',
            message: `${detail.expired_count} co-op credit(s) have expired.`,
            data: { expired_count: detail.expired_count },
          });
        } catch (notifyError) {
          console.error(`[Co-op Job] Failed to notify user ${detail.user_id}:`, notifyError);
        }
      }
    }

    return result;
  } catch (error) {
    console.error('[Co-op Job] Credit expiration failed:', error);
    throw error;
  }
}

// ============================================
// PROCESS WEEKLY PAYOUTS
// Run: Every Monday at 06:00
// ============================================

async function runWeeklyPayouts() {
  console.log('[Co-op Job] Starting weekly payout processing...');

  try {
    const results = await processPayouts();

    const successCount = results.filter(r => r.success).length;
    const failedCount = results.filter(r => !r.success).length;

    console.log(`[Co-op Job] Payouts processed: ${successCount} successful, ${failedCount} failed`);

    // Notify teachers about payouts
    for (const result of results) {
      if (result.success) {
        try {
          const teacher = await db.query(`
            SELECT u.id as user_id FROM teachers t
            JOIN users u ON t.user_id = u.id
            WHERE t.id = $1
          `, [result.teacherId]);

          if (teacher.rows[0]) {
            await notifications.sendNotification(teacher.rows[0].user_id, {
              type: 'coop_payout_processed',
              message: `Your payout of $${result.amount.toFixed(2)} has been processed.`,
              data: {
                amount: result.amount,
                transfer_id: result.transferId,
              },
            });
          }
        } catch (notifyError) {
          console.error(`[Co-op Job] Failed to notify teacher ${result.teacherId}:`, notifyError);
        }
      }
    }

    return results;
  } catch (error) {
    console.error('[Co-op Job] Weekly payouts failed:', error);
    throw error;
  }
}

// ============================================
// CHECK EXPIRING INSURANCE
// Run: Daily at 09:00
// ============================================

async function runExpiringInsuranceCheck() {
  console.log('[Co-op Job] Checking for expiring insurance...');

  try {
    // Check for insurance expiring in next 30 days
    const expiringAgreements = await getExpiringInsurance(30);

    console.log(`[Co-op Job] Found ${expiringAgreements.length} agreements with expiring insurance`);

    for (const agreement of expiringAgreements) {
      const daysUntilExpiry = Math.ceil(
        (new Date(agreement.insurance_expiry) - new Date()) / (1000 * 60 * 60 * 24)
      );

      // Only notify at specific intervals: 30, 14, 7, 3, 1 days
      if ([30, 14, 7, 3, 1].includes(daysUntilExpiry)) {
        try {
          const teacher = await db.query(`
            SELECT u.id as user_id FROM teachers t
            JOIN users u ON t.user_id = u.id
            WHERE t.id = $1
          `, [agreement.teacher_id]);

          if (teacher.rows[0]) {
            await notifications.sendNotification(teacher.rows[0].user_id, {
              type: 'insurance_expiring',
              message: `Your insurance expires in ${daysUntilExpiry} day(s). Please renew to continue teaching co-op classes.`,
              data: {
                expiry_date: agreement.insurance_expiry,
                days_until_expiry: daysUntilExpiry,
              },
            });
          }
        } catch (notifyError) {
          console.error(`[Co-op Job] Failed to notify teacher ${agreement.teacher_id}:`, notifyError);
        }
      }
    }

    return expiringAgreements;
  } catch (error) {
    console.error('[Co-op Job] Insurance check failed:', error);
    throw error;
  }
}

// ============================================
// FINALIZE COMPLETED CLASSES
// Run: Every hour
// ============================================

async function runFinalizeCompletedClasses() {
  console.log('[Co-op Job] Finalizing completed classes...');

  try {
    // Find classes that ended more than 2 hours ago but aren't finalized
    const completedClasses = await db.query(`
      SELECT c.id FROM classes c
      WHERE c.is_coop = true
        AND c.coop_status = 'scheduled'
        AND c.is_cancelled = false
        AND (c.date < CURRENT_DATE OR
             (c.date = CURRENT_DATE AND c.end_time < (NOW() - INTERVAL '2 hours')::time))
    `);

    console.log(`[Co-op Job] Found ${completedClasses.rows.length} classes to finalize`);

    const { finalizeCoopClass } = require('../../services/coop/classes');

    let finalized = 0;
    let errors = 0;

    for (const cls of completedClasses.rows) {
      try {
        await finalizeCoopClass(cls.id);
        finalized++;
      } catch (error) {
        console.error(`[Co-op Job] Failed to finalize class ${cls.id}:`, error);
        errors++;
      }
    }

    console.log(`[Co-op Job] Finalized ${finalized} classes, ${errors} errors`);

    return { finalized, errors };
  } catch (error) {
    console.error('[Co-op Job] Class finalization failed:', error);
    throw error;
  }
}

// ============================================
// SEND CLASS REMINDERS
// Run: Daily at 18:00
// ============================================

async function runCoopClassReminders() {
  console.log('[Co-op Job] Sending co-op class reminders...');

  try {
    // Get classes happening tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const upcomingBookings = await db.query(`
      SELECT b.id as booking_id, b.user_id,
             c.date, c.start_time,
             ct.name as class_name,
             l.name as location_name, l.address,
             tu.first_name as teacher_first_name, tu.last_name as teacher_last_name
      FROM bookings b
      JOIN classes c ON b.class_id = c.id
      JOIN class_types ct ON c.class_type_id = ct.id
      JOIN locations l ON c.location_id = l.id
      JOIN teachers t ON c.teacher_id = t.id
      JOIN users tu ON t.user_id = tu.id
      WHERE c.date = $1
        AND c.is_coop = true
        AND c.is_cancelled = false
        AND b.status IN ('booked', 'confirmed')
    `, [tomorrowStr]);

    console.log(`[Co-op Job] Sending ${upcomingBookings.rows.length} class reminders`);

    let sent = 0;
    for (const booking of upcomingBookings.rows) {
      try {
        await notifications.sendNotification(booking.user_id, {
          type: 'coop_class_reminder',
          message: `Reminder: ${booking.class_name} with ${booking.teacher_first_name} tomorrow at ${booking.start_time}`,
          data: {
            class_name: booking.class_name,
            date: booking.date,
            start_time: booking.start_time,
            location_name: booking.location_name,
            teacher_name: `${booking.teacher_first_name} ${booking.teacher_last_name}`,
          },
        });
        sent++;
      } catch (notifyError) {
        console.error(`[Co-op Job] Failed to send reminder for booking ${booking.booking_id}:`, notifyError);
      }
    }

    console.log(`[Co-op Job] Sent ${sent} reminders`);

    return { sent, total: upcomingBookings.rows.length };
  } catch (error) {
    console.error('[Co-op Job] Class reminders failed:', error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  runMonthlyCreditsAllocation,
  runExpireUnusedCredits,
  runWeeklyPayouts,
  runExpiringInsuranceCheck,
  runFinalizeCompletedClasses,
  runCoopClassReminders,
};
