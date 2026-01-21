// ============================================
// CO-OP SETTINGS SERVICE
// Configuration management for co-op feature
// ============================================

const db = require('../../database/connection');

// ============================================
// DEFAULT SETTINGS
// ============================================

const DEFAULT_COOP_SETTINGS = {
  // Feature toggle
  enabled: false,

  // Member benefits
  default_member_discount_percent: 25,      // Members get 25% off co-op classes
  default_credit_reimbursement_rate: 5.00,  // Studio pays teacher $5 per credit used

  // Teacher referrals
  referral_bonus_type: 'room_credit',       // 'room_credit', 'cash', 'none'
  referral_bonus_amount: 25.00,             // $25 credit toward room rental
  referral_conversion_window_days: 90,      // Days to convert referral to member

  // Payouts
  payout_schedule: 'weekly',                // 'weekly', 'biweekly', 'monthly'
  payout_day: 1,                            // Day of week (1=Monday) or month
  minimum_payout_amount: 25.00,             // Don't payout below this

  // Agreements
  auto_approve_agreements: false,           // Require manual approval
  require_insurance: true,                  // Teachers must have liability insurance

  // Pricing
  allow_teacher_set_prices: true,           // Teachers set their own prices
  price_approval_required: false,           // Studio must approve prices
  enforce_price_minimums: false,            // Enforce rental tier minimums
  enforce_price_maximums: false,            // Enforce rental tier maximums

  // Booking rules
  advance_booking_days: 30,                 // How far ahead teachers can book
  cancellation_hours: 48,                   // Hours before class to cancel
  cancellation_fee_percent: 50,             // Fee for late cancellation

  // Display
  show_coop_classes_on_public_schedule: true,
  show_teacher_earnings_to_teachers: true,
  allow_private_coop_classes: true,         // Teachers can have invite-only classes
};

const DEFAULT_COOP_DISPLAY_SETTINGS = {
  badge_text: 'CO-OP',
  badge_color: '#8B5CF6',
  class_color: '#8B5CF6',
  class_bg_color: '#EDE9FE',
  border_style: 'dashed',
  show_teacher_photo: true,
  show_price_on_schedule: true,
  show_member_savings: true,
};

// ============================================
// GET SETTINGS
// ============================================

/**
 * Get co-op settings with defaults merged
 * @returns {Promise<Object>} Co-op settings
 */
async function getCoopSettings() {
  try {
    const result = await db.query(
      "SELECT value FROM settings WHERE key = 'coop'"
    );

    if (result.rows.length === 0) {
      return { ...DEFAULT_COOP_SETTINGS };
    }

    return {
      ...DEFAULT_COOP_SETTINGS,
      ...result.rows[0].value,
    };
  } catch (error) {
    console.error('Error getting co-op settings:', error);
    return { ...DEFAULT_COOP_SETTINGS };
  }
}

/**
 * Get co-op display settings
 * @returns {Promise<Object>} Display settings
 */
async function getCoopDisplaySettings() {
  try {
    const result = await db.query(
      "SELECT value FROM settings WHERE key = 'coop_display'"
    );

    if (result.rows.length === 0) {
      return { ...DEFAULT_COOP_DISPLAY_SETTINGS };
    }

    return {
      ...DEFAULT_COOP_DISPLAY_SETTINGS,
      ...result.rows[0].value,
    };
  } catch (error) {
    console.error('Error getting co-op display settings:', error);
    return { ...DEFAULT_COOP_DISPLAY_SETTINGS };
  }
}

// ============================================
// UPDATE SETTINGS
// ============================================

/**
 * Update co-op settings
 * @param {Object} settings - Settings to update (partial)
 * @returns {Promise<Object>} Updated settings
 */
async function updateCoopSettings(settings) {
  const current = await getCoopSettings();
  const updated = { ...current, ...settings };

  // Validate settings
  if (typeof updated.default_member_discount_percent !== 'number' ||
      updated.default_member_discount_percent < 0 ||
      updated.default_member_discount_percent > 100) {
    throw new Error('Invalid member discount percent');
  }

  if (typeof updated.default_credit_reimbursement_rate !== 'number' ||
      updated.default_credit_reimbursement_rate < 0) {
    throw new Error('Invalid credit reimbursement rate');
  }

  if (!['weekly', 'biweekly', 'monthly'].includes(updated.payout_schedule)) {
    throw new Error('Invalid payout schedule');
  }

  await db.query(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('coop', $1, NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = $1, updated_at = NOW()
  `, [JSON.stringify(updated)]);

  return updated;
}

/**
 * Update co-op display settings
 * @param {Object} settings - Display settings to update (partial)
 * @returns {Promise<Object>} Updated display settings
 */
async function updateCoopDisplaySettings(settings) {
  const current = await getCoopDisplaySettings();
  const updated = { ...current, ...settings };

  await db.query(`
    INSERT INTO settings (key, value, updated_at)
    VALUES ('coop_display', $1, NOW())
    ON CONFLICT (key) DO UPDATE
    SET value = $1, updated_at = NOW()
  `, [JSON.stringify(updated)]);

  return updated;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Check if co-op is enabled
 * @returns {Promise<boolean>} Whether co-op is enabled
 */
async function isCoopEnabled() {
  const settings = await getCoopSettings();
  return settings.enabled === true;
}

/**
 * Get member discount percent
 * @returns {Promise<number>} Discount percent
 */
async function getMemberDiscountPercent() {
  const settings = await getCoopSettings();
  return settings.default_member_discount_percent;
}

/**
 * Get credit reimbursement rate
 * @returns {Promise<number>} Reimbursement rate in dollars
 */
async function getCreditReimbursementRate() {
  const settings = await getCoopSettings();
  return settings.default_credit_reimbursement_rate;
}

/**
 * Calculate member price from full price
 * @param {number} fullPrice - Full non-member price
 * @returns {Promise<number>} Discounted member price
 */
async function calculateMemberPrice(fullPrice) {
  const discountPercent = await getMemberDiscountPercent();
  return parseFloat((fullPrice * (1 - discountPercent / 100)).toFixed(2));
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Constants
  DEFAULT_COOP_SETTINGS,
  DEFAULT_COOP_DISPLAY_SETTINGS,

  // Get settings
  getCoopSettings,
  getCoopDisplaySettings,

  // Update settings
  updateCoopSettings,
  updateCoopDisplaySettings,

  // Helpers
  isCoopEnabled,
  getMemberDiscountPercent,
  getCreditReimbursementRate,
  calculateMemberPrice,
};
