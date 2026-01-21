// ============================================
// RENTAL TIERS SERVICE
// Time-based pricing for room rentals
// ============================================

const db = require('../../database/connection');

// ============================================
// TIER TEMPLATES
// ============================================

const TIER_TEMPLATES = {
  offPeak: {
    name: 'Off-Peak',
    slug: 'off-peak',
    durationMinutes: 90,
    price: 75.00,
    suggestedClassPrice: 25.00,
    schedule: [
      { startTime: '06:00', endTime: '09:00', days: [1, 2, 3, 4, 5] }, // Weekday early
      { startTime: '19:00', endTime: '21:00', days: [0, 1, 2, 3, 4, 5, 6] }, // Evenings
      { startTime: '06:00', endTime: '09:00', days: [0, 6] }, // Weekend early
    ],
  },
  standard: {
    name: 'Standard',
    slug: 'standard',
    durationMinutes: 90,
    price: 110.00,
    suggestedClassPrice: 30.00,
    schedule: [
      { startTime: '09:00', endTime: '16:00', days: [1, 2, 3, 4, 5] }, // Weekday mid
      { startTime: '09:00', endTime: '16:00', days: [0, 6] }, // Weekend mid
    ],
  },
  prime: {
    name: 'Prime',
    slug: 'prime',
    durationMinutes: 90,
    price: 140.00,
    suggestedClassPrice: 35.00,
    schedule: [
      { startTime: '16:00', endTime: '19:00', days: [1, 2, 3, 4, 5] }, // Weekday evening
      { startTime: '16:00', endTime: '19:00', days: [0, 6] }, // Weekend afternoon
    ],
  },
};

// ============================================
// CREATE & UPDATE TIERS
// ============================================

/**
 * Create a new rental tier
 * @param {Object} data - Tier data
 * @returns {Promise<Object>} Created tier
 */
async function createRentalTier(data) {
  const {
    roomId,
    name,
    slug,
    durationMinutes = 90,
    price,
    startTime,
    endTime,
    daysOfWeek = [0, 1, 2, 3, 4, 5, 6],
    suggestedClassPrice,
    minClassPrice,
    maxClassPrice,
    description,
  } = data;

  // Validate inputs
  if (!roomId || !name || !slug || !price || !startTime || !endTime) {
    throw new Error('Missing required tier fields');
  }

  if (price < 0) {
    throw new Error('Price must be positive');
  }

  const result = await db.query(`
    INSERT INTO rental_tiers (
      room_id, name, slug, duration_minutes, price,
      start_time, end_time, days_of_week, suggested_class_price,
      min_class_price, max_class_price, description
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `, [
    roomId, name, slug, durationMinutes, price,
    startTime, endTime, daysOfWeek, suggestedClassPrice,
    minClassPrice, maxClassPrice, description
  ]);

  return result.rows[0];
}

/**
 * Update a rental tier
 * @param {string} tierId - Tier UUID
 * @param {Object} data - Tier data to update
 * @returns {Promise<Object>} Updated tier
 */
async function updateRentalTier(tierId, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const allowedFields = {
    name: 'name',
    slug: 'slug',
    durationMinutes: 'duration_minutes',
    price: 'price',
    startTime: 'start_time',
    endTime: 'end_time',
    daysOfWeek: 'days_of_week',
    suggestedClassPrice: 'suggested_class_price',
    minClassPrice: 'min_class_price',
    maxClassPrice: 'max_class_price',
    description: 'description',
    isActive: 'is_active',
    sortOrder: 'sort_order',
  };

  for (const [key, column] of Object.entries(allowedFields)) {
    if (data[key] !== undefined) {
      fields.push(`${column} = $${paramIndex++}`);
      values.push(data[key]);
    }
  }

  if (fields.length === 0) {
    const existing = await db.query('SELECT * FROM rental_tiers WHERE id = $1', [tierId]);
    return existing.rows[0];
  }

  fields.push('updated_at = NOW()');
  values.push(tierId);

  const result = await db.query(`
    UPDATE rental_tiers
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  return result.rows[0];
}

/**
 * Delete a rental tier
 * @param {string} tierId - Tier UUID
 * @returns {Promise<boolean>} Success
 */
async function deleteRentalTier(tierId) {
  // Check if tier is used by any classes
  const usage = await db.query(`
    SELECT COUNT(*) as count FROM classes
    WHERE coop_rental_tier_id = $1
  `, [tierId]);

  if (parseInt(usage.rows[0].count) > 0) {
    // Soft delete - mark as inactive
    await db.query(`
      UPDATE rental_tiers SET is_active = false, updated_at = NOW()
      WHERE id = $1
    `, [tierId]);
  } else {
    // Hard delete
    await db.query('DELETE FROM rental_tiers WHERE id = $1', [tierId]);
  }

  return true;
}

// ============================================
// GET TIERS
// ============================================

/**
 * Get rental tiers for a room
 * @param {string} roomId - Room UUID
 * @param {boolean} activeOnly - Only return active tiers
 * @returns {Promise<Array>} Tiers
 */
async function getRentalTiersForRoom(roomId, activeOnly = true) {
  const result = await db.query(`
    SELECT * FROM rental_tiers
    WHERE room_id = $1
      ${activeOnly ? 'AND is_active = true' : ''}
    ORDER BY sort_order, start_time
  `, [roomId]);

  return result.rows;
}

/**
 * Get rental tiers with filtering options
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Tiers
 */
async function getRentalTiers(options = {}) {
  const { roomId, includeInactive = false } = options;

  let whereClause = '1=1';
  const params = [];

  if (roomId) {
    params.push(roomId);
    whereClause += ` AND room_id = $${params.length}`;
  }

  if (!includeInactive) {
    whereClause += ' AND is_active = true';
  }

  const result = await db.query(`
    SELECT rt.*, r.name as room_name
    FROM rental_tiers rt
    JOIN rooms r ON rt.room_id = r.id
    WHERE ${whereClause}
    ORDER BY r.name, rt.sort_order, rt.start_time
  `, params);

  return result.rows;
}

/**
 * Get a tier by ID
 * @param {string} tierId - Tier UUID
 * @returns {Promise<Object|null>} Tier
 */
async function getRentalTierById(tierId) {
  const result = await db.query(
    'SELECT * FROM rental_tiers WHERE id = $1',
    [tierId]
  );
  return result.rows[0] || null;
}

/**
 * Find applicable rental tier for a given time
 * @param {string} roomId - Room UUID
 * @param {number|Date|string} dayOfWeekOrStartTime - Day of week (0-6) or full start time
 * @param {string} startTimeStr - Start time string "HH:MM" (optional if full datetime passed)
 * @returns {Promise<Object|null>} Applicable tier or null
 */
async function findApplicableTier(roomId, dayOfWeekOrStartTime, startTimeStr = null) {
  let timeStr, dayOfWeek;

  if (startTimeStr !== null) {
    // Called with dayOfWeek and time string
    dayOfWeek = dayOfWeekOrStartTime;
    timeStr = startTimeStr.length === 5 ? startTimeStr + ':00' : startTimeStr;
  } else {
    // Called with full datetime
    const date = new Date(dayOfWeekOrStartTime);
    timeStr = date.toTimeString().slice(0, 8); // "HH:MM:SS"
    dayOfWeek = date.getDay(); // 0-6 (Sunday = 0)
  }

  const result = await db.query(`
    SELECT * FROM rental_tiers
    WHERE room_id = $1
      AND is_active = true
      AND $2::time >= start_time
      AND $2::time < end_time
      AND $3 = ANY(days_of_week)
    ORDER BY price DESC
    LIMIT 1
  `, [roomId, timeStr, dayOfWeek]);

  return result.rows[0] || null;
}

// ============================================
// CALCULATE RENTAL FEE
// ============================================

/**
 * Calculate rental fee for a class
 * @param {string} roomId - Room UUID
 * @param {number|Date|string} dayOfWeekOrStartTime - Day of week or start time
 * @param {string|Date} startTimeOrEndTime - Start time string or end time
 * @param {number} durationMinutes - Duration in minutes (optional)
 * @returns {Promise<Object>} Rental calculation details
 */
async function calculateRentalFee(roomId, dayOfWeekOrStartTime, startTimeOrEndTime, durationMinutes = null) {
  let tier, actualDuration;

  if (durationMinutes !== null) {
    // Called with dayOfWeek, startTime string, and duration
    tier = await findApplicableTier(roomId, dayOfWeekOrStartTime, startTimeOrEndTime);
    actualDuration = durationMinutes;
  } else {
    // Called with startTime and endTime as Date objects
    tier = await findApplicableTier(roomId, dayOfWeekOrStartTime);
    const start = new Date(dayOfWeekOrStartTime);
    const end = new Date(startTimeOrEndTime);
    actualDuration = (end - start) / (1000 * 60);
  }

  if (!tier) {
    throw new Error('No rental tier found for this time slot');
  }

  if (actualDuration <= 0) {
    throw new Error('Invalid class duration');
  }

  // Calculate fee (pro-rated if different from tier duration)
  const blocks = Math.ceil(actualDuration / tier.duration_minutes);
  const fee = parseFloat(tier.price) * blocks;

  return {
    tier,
    durationMinutes: actualDuration,
    blocks,
    fee: parseFloat(fee.toFixed(2)),
  };
}

// ============================================
// APPLY TEMPLATES
// ============================================

/**
 * Apply standard tier templates to a room
 * @param {string} roomId - Room UUID
 * @returns {Promise<Array>} Created tiers
 */
async function applyTierTemplates(roomId) {
  const tiers = [];

  for (const [key, template] of Object.entries(TIER_TEMPLATES)) {
    for (const schedule of template.schedule) {
      try {
        const tier = await createRentalTier({
          roomId,
          name: template.name,
          slug: `${template.slug}-${schedule.startTime.replace(':', '')}`,
          durationMinutes: template.durationMinutes,
          price: template.price,
          startTime: schedule.startTime,
          endTime: schedule.endTime,
          daysOfWeek: schedule.days,
          suggestedClassPrice: template.suggestedClassPrice,
          description: `${template.name} tier: ${schedule.startTime}-${schedule.endTime}`,
        });
        tiers.push(tier);
      } catch (error) {
        // Skip if tier already exists (unique constraint)
        if (!error.message.includes('unique')) {
          console.error(`Error creating tier ${key}:`, error);
        }
      }
    }
  }

  return tiers;
}

/**
 * Remove all tiers from a room
 * @param {string} roomId - Room UUID
 * @returns {Promise<number>} Number of tiers removed
 */
async function clearRoomTiers(roomId) {
  const result = await db.query(`
    DELETE FROM rental_tiers
    WHERE room_id = $1
      AND NOT EXISTS (
        SELECT 1 FROM classes WHERE coop_rental_tier_id = rental_tiers.id
      )
    RETURNING id
  `, [roomId]);

  // Deactivate tiers that are in use
  await db.query(`
    UPDATE rental_tiers
    SET is_active = false, updated_at = NOW()
    WHERE room_id = $1
      AND EXISTS (
        SELECT 1 FROM classes WHERE coop_rental_tier_id = rental_tiers.id
      )
  `, [roomId]);

  return result.rows.length;
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Templates
  TIER_TEMPLATES,

  // CRUD
  createRentalTier,
  updateRentalTier,
  deleteRentalTier,

  // Get tiers
  getRentalTiers,
  getRentalTiersForRoom,
  getRentalTierById,
  findApplicableTier,

  // Calculate
  calculateRentalFee,

  // Templates
  applyTierTemplates,
  clearRoomTiers,
};
