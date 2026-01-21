// ============================================
// CO-OP CLASSES SERVICE
// Manage co-op class creation and scheduling
// ============================================

const db = require('../../database/connection');
const { calculateRentalFee, findApplicableTier } = require('./rentalTiers');
const { getTeacherActiveAgreement } = require('./agreements');
const { getCoopSettings, calculateMemberPrice } = require('./settings');
const { getRoomById } = require('./rooms');

// ============================================
// CREATE CO-OP CLASS
// ============================================

/**
 * Create a co-op class
 * @param {Object} data - Class data including teacher_id
 * @returns {Promise<Object>} Created class
 */
async function createCoopClass(data) {
  const {
    teacher_id: teacherId,
    class_type_id: classTypeId,
    location_id: locationId,
    room_id: roomId,
    date,
    start_time: startTime,         // Time string "HH:MM" or full datetime
    end_time: endTime,             // Time string "HH:MM" or full datetime
    capacity,
    coop_price: coopPrice,         // Non-member price set by teacher
    visibility = 'public',
    description: notes,
  } = data;

  // Verify teacher has active agreement
  const agreement = await getTeacherActiveAgreement(teacherId);
  if (!agreement) {
    throw new Error('Teacher does not have an active rental agreement');
  }

  // Get room details
  const room = await getRoomById(roomId);
  if (!room) {
    throw new Error('Room not found');
  }
  if (!room.allows_coop) {
    throw new Error('Room does not allow co-op classes');
  }

  // Parse dates and times
  const startDateTime = new Date(`${date}T${startTime}`);
  const endDateTime = new Date(`${date}T${endTime}`);

  if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
    throw new Error('Invalid date or time format');
  }

  if (endDateTime <= startDateTime) {
    throw new Error('End time must be after start time');
  }

  // Check if class is in the future
  if (startDateTime <= new Date()) {
    throw new Error('Class must be scheduled in the future');
  }

  // Get org settings
  const settings = await getCoopSettings();

  // Check advance booking limit
  const roomSettings = room.coop_settings;
  const daysAhead = Math.ceil((startDateTime - new Date()) / (1000 * 60 * 60 * 24));
  if (daysAhead > roomSettings.advance_booking_days) {
    throw new Error(`Cannot book more than ${roomSettings.advance_booking_days} days in advance`);
  }

  // Check minimum notice
  const hoursAhead = (startDateTime - new Date()) / (1000 * 60 * 60);
  if (hoursAhead < roomSettings.min_booking_hours) {
    throw new Error(`Must book at least ${roomSettings.min_booking_hours} hours in advance`);
  }

  // Check weekly hours limit for teacher
  const weeklyHours = await getTeacherWeeklyHours(teacherId, roomId, date);
  const classDuration = (endDateTime - startDateTime) / (1000 * 60 * 60);
  if (weeklyHours + classDuration > roomSettings.max_weekly_hours_per_teacher) {
    throw new Error(`Exceeds weekly limit of ${roomSettings.max_weekly_hours_per_teacher} hours`);
  }

  // Calculate rental fee
  const rental = await calculateRentalFee(roomId, startDateTime, endDateTime);

  // Calculate member price (apply discount)
  const coopMemberPrice = await calculateMemberPrice(coopPrice);

  // Check price limits if enforced
  if (settings.enforce_price_minimums && rental.tier.min_class_price) {
    if (coopPrice < rental.tier.min_class_price) {
      throw new Error(`Price must be at least $${rental.tier.min_class_price}`);
    }
  }
  if (settings.enforce_price_maximums && rental.tier.max_class_price) {
    if (coopPrice > rental.tier.max_class_price) {
      throw new Error(`Price cannot exceed $${rental.tier.max_class_price}`);
    }
  }

  // Check room availability
  const conflict = await checkRoomAvailability(roomId, startDateTime, endDateTime);
  if (conflict) {
    throw new Error('Room is not available at this time');
  }

  // Use provided capacity or room capacity
  const classCapacity = capacity || room.capacity;

  // Create the class
  const result = await db.query(`
    INSERT INTO classes (
      class_type_id, location_id, room_id, teacher_id,
      date, start_time, end_time, capacity, status,
      is_coop, coop_price, coop_member_price, coop_agreement_id,
      coop_rental_tier_id, coop_rental_fee, coop_status, coop_visibility,
      notes
    ) VALUES (
      $1, $2, $3, $4,
      $5, $6, $7, $8, 'scheduled',
      true, $9, $10, $11,
      $12, $13, 'scheduled', $14,
      $15
    )
    RETURNING *
  `, [
    classTypeId, locationId, roomId, teacherId,
    date, startTime, endTime, classCapacity,
    coopPrice, coopMemberPrice, agreement.id,
    rental.tier.id, rental.fee, visibility,
    notes
  ]);

  const coopClass = result.rows[0];

  // Create rental fee transaction (teacher owes studio)
  await createRentalFeeTransaction(coopClass, rental);

  return {
    ...coopClass,
    rental_tier: rental.tier,
  };
}

/**
 * Create rental fee transaction when class is created
 */
async function createRentalFeeTransaction(coopClass, rentalCalculation) {
  await db.query(`
    INSERT INTO rental_transactions (
      teacher_id, agreement_id, class_id,
      transaction_type, amount, status, transaction_date,
      description, metadata
    ) VALUES ($1, $2, $3, 'rental_fee', $4, 'pending', CURRENT_DATE, $5, $6)
  `, [
    coopClass.teacher_id,
    coopClass.coop_agreement_id,
    coopClass.id,
    -rentalCalculation.fee,  // Negative = teacher owes studio
    `Room rental: ${rentalCalculation.tier.name}`,
    JSON.stringify({
      tier_id: rentalCalculation.tier.id,
      tier_name: rentalCalculation.tier.name,
      duration_minutes: rentalCalculation.durationMinutes,
      blocks: rentalCalculation.blocks,
    })
  ]);
}

// ============================================
// AVAILABILITY CHECKING
// ============================================

/**
 * Check room availability for a time slot
 * @param {string} roomId - Room UUID
 * @param {Date} startTime - Start time
 * @param {Date} endTime - End time
 * @param {string} excludeClassId - Exclude this class (for updates)
 * @returns {Promise<Object|null>} Conflicting class or null
 */
async function checkRoomAvailability(roomId, startTime, endTime, excludeClassId = null) {
  const startStr = startTime.toISOString();
  const endStr = endTime.toISOString();
  const dateStr = startTime.toISOString().split('T')[0];

  let query = `
    SELECT id, date, start_time, end_time
    FROM classes
    WHERE room_id = $1
      AND date = $2
      AND status != 'cancelled'
      AND is_cancelled = false
      AND (
        (start_time::time < $4::time AND end_time::time > $3::time)
      )
  `;
  const params = [roomId, dateStr, startTime.toTimeString().slice(0, 8), endTime.toTimeString().slice(0, 8)];

  if (excludeClassId) {
    query += ` AND id != $5`;
    params.push(excludeClassId);
  }

  query += ` LIMIT 1`;

  const result = await db.query(query, params);
  return result.rows[0] || null;
}

/**
 * Get teacher's weekly hours for a room
 */
async function getTeacherWeeklyHours(teacherId, roomId, date) {
  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();
  const weekStart = new Date(targetDate);
  weekStart.setDate(targetDate.getDate() - dayOfWeek);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const result = await db.query(`
    SELECT SUM(
      EXTRACT(EPOCH FROM (end_time::time - start_time::time)) / 3600
    ) as total_hours
    FROM classes
    WHERE teacher_id = $1
      AND room_id = $2
      AND date >= $3
      AND date <= $4
      AND is_coop = true
      AND status != 'cancelled'
      AND is_cancelled = false
  `, [teacherId, roomId, weekStart.toISOString().split('T')[0], weekEnd.toISOString().split('T')[0]]);

  return parseFloat(result.rows[0].total_hours || 0);
}

/**
 * Get available time slots for co-op booking
 * @param {string} roomId - Room UUID
 * @param {string} date - Date string YYYY-MM-DD
 * @param {number} durationMinutes - Class duration (default 90)
 * @returns {Promise<Array>} Available slots with tier info
 */
async function getAvailableSlots(roomId, date, durationMinutes = 90) {
  const room = await getRoomById(roomId);
  if (!room?.allows_coop) {
    return [];
  }

  const { getRentalTiersForRoom } = require('./rentalTiers');
  const tiers = await getRentalTiersForRoom(roomId);

  // Get existing classes for the date
  const existingClasses = await db.query(`
    SELECT start_time, end_time FROM classes
    WHERE room_id = $1
      AND date = $2
      AND status != 'cancelled'
      AND is_cancelled = false
    ORDER BY start_time
  `, [roomId, date]);

  const targetDate = new Date(date);
  const dayOfWeek = targetDate.getDay();
  const bufferMinutes = room.coop_settings.buffer_minutes_between_rentals || 15;

  const slots = [];

  // For each tier, find available slots
  for (const tier of tiers) {
    if (!tier.days_of_week.includes(dayOfWeek)) continue;

    let currentTime = new Date(`${date}T${tier.start_time}`);
    const tierEnd = new Date(`${date}T${tier.end_time}`);

    while (currentTime < tierEnd) {
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);

      if (slotEnd > tierEnd) break;

      // Check if slot conflicts with existing class
      const hasConflict = existingClasses.rows.some(c => {
        const classStart = new Date(`${date}T${c.start_time}`);
        const classEnd = new Date(`${date}T${c.end_time}`);
        // Add buffer
        classStart.setMinutes(classStart.getMinutes() - bufferMinutes);
        classEnd.setMinutes(classEnd.getMinutes() + bufferMinutes);
        return currentTime < classEnd && slotEnd > classStart;
      });

      if (!hasConflict) {
        slots.push({
          startTime: currentTime.toISOString(),
          endTime: slotEnd.toISOString(),
          startTimeLocal: currentTime.toTimeString().slice(0, 5),
          endTimeLocal: slotEnd.toTimeString().slice(0, 5),
          tier: {
            id: tier.id,
            name: tier.name,
            price: parseFloat(tier.price),
            suggestedClassPrice: tier.suggested_class_price ? parseFloat(tier.suggested_class_price) : null,
          },
        });
      }

      // Move to next slot (with buffer)
      currentTime = new Date(slotEnd.getTime() + bufferMinutes * 60 * 1000);
    }
  }

  // Sort by start time
  slots.sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return slots;
}

// ============================================
// UPDATE & CANCEL
// ============================================

/**
 * Update a co-op class
 * @param {string} classId - Class UUID
 * @param {Object} data - Data to update
 * @returns {Promise<Object>} Updated class
 */
async function updateCoopClass(classId, data) {
  // Get existing class
  const existing = await db.query(`
    SELECT * FROM classes WHERE id = $1 AND is_coop = true
  `, [classId]);

  if (existing.rows.length === 0) {
    throw new Error('Co-op class not found');
  }

  const cls = existing.rows[0];

  if (cls.coop_status === 'cancelled' || cls.coop_status === 'completed') {
    throw new Error('Cannot update cancelled or completed class');
  }

  const fields = [];
  const values = [];
  let paramIndex = 1;

  // Only allow certain fields to be updated
  if (data.capacity !== undefined) {
    fields.push(`capacity = $${paramIndex++}`);
    values.push(data.capacity);
  }
  if (data.notes !== undefined) {
    fields.push(`notes = $${paramIndex++}`);
    values.push(data.notes);
  }
  if (data.visibility !== undefined) {
    fields.push(`coop_visibility = $${paramIndex++}`);
    values.push(data.visibility);
  }

  // Price update requires recalculating member price
  if (data.coopPrice !== undefined) {
    const memberPrice = await calculateMemberPrice(data.coopPrice);
    fields.push(`coop_price = $${paramIndex++}`);
    values.push(data.coopPrice);
    fields.push(`coop_member_price = $${paramIndex++}`);
    values.push(memberPrice);
  }

  if (fields.length === 0) {
    return cls;
  }

  fields.push('updated_at = NOW()');
  values.push(classId);

  const result = await db.query(`
    UPDATE classes
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  return result.rows[0];
}

/**
 * Cancel a co-op class
 * @param {string} classId - Class UUID
 * @param {string} cancelledById - User/Teacher ID who cancelled
 * @param {string} reason - Cancellation reason
 * @returns {Promise<Object>} Result with cancellation fee
 */
async function cancelCoopClass(classId, cancelledById, reason) {
  const coopClass = await db.query(`
    SELECT c.*, r.coop_settings as room_settings
    FROM classes c
    JOIN rooms r ON c.room_id = r.id
    WHERE c.id = $1 AND c.is_coop = true
  `, [classId]);

  if (!coopClass.rows[0]) {
    throw new Error('Co-op class not found');
  }

  const cls = coopClass.rows[0];

  if (cls.coop_status === 'cancelled') {
    throw new Error('Class is already cancelled');
  }

  if (cls.coop_status === 'completed') {
    throw new Error('Cannot cancel completed class');
  }

  const roomSettings = cls.room_settings || {};
  const cancellationHours = roomSettings.cancellation_hours || 48;

  // Check cancellation policy
  const classStart = new Date(`${cls.date}T${cls.start_time}`);
  const hoursUntilClass = (classStart - new Date()) / (1000 * 60 * 60);

  let cancellationFee = 0;
  if (hoursUntilClass < cancellationHours && hoursUntilClass > 0) {
    // Late cancellation - charge fee
    const feePercent = roomSettings.cancellation_fee_percent || 50;
    cancellationFee = parseFloat(cls.coop_rental_fee) * (feePercent / 100);
  }

  // Update class status
  await db.query(`
    UPDATE classes
    SET is_cancelled = true,
        coop_status = 'cancelled',
        cancellation_reason = $1,
        cancelled_at = NOW(),
        cancelled_by = $2,
        updated_at = NOW()
    WHERE id = $3
  `, [reason, cancelledById, classId]);

  // Handle rental fee transaction
  if (cancellationFee > 0) {
    // Update to cancellation fee amount
    await db.query(`
      UPDATE rental_transactions
      SET amount = $1,
          description = 'Late cancellation fee',
          updated_at = NOW()
      WHERE class_id = $2 AND transaction_type = 'rental_fee'
    `, [-cancellationFee, classId]);
  } else {
    // Cancel the rental fee transaction
    await db.query(`
      UPDATE rental_transactions
      SET status = 'cancelled',
          updated_at = NOW()
      WHERE class_id = $1 AND transaction_type = 'rental_fee'
    `, [classId]);
  }

  // Cancel and refund any bookings (handled by bookings service)
  const cancelledBookings = await cancelClassBookings(classId);

  return {
    classId,
    cancellationFee,
    isLateCancellation: cancellationFee > 0,
    cancelledBookings: cancelledBookings.length,
  };
}

/**
 * Cancel all bookings for a class
 */
async function cancelClassBookings(classId) {
  const result = await db.query(`
    UPDATE bookings
    SET status = 'cancelled',
        cancelled_at = NOW(),
        updated_at = NOW()
    WHERE class_id = $1
      AND status IN ('booked', 'confirmed')
    RETURNING *
  `, [classId]);

  return result.rows;
}

// ============================================
// GET CLASSES
// ============================================

/**
 * Get teacher's upcoming co-op classes
 * @param {string} teacherId - Teacher UUID
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Classes
 */
async function getTeacherCoopClasses(teacherId, options = {}) {
  const { upcoming = true, limit = 50, offset = 0 } = options;

  const result = await db.query(`
    SELECT c.*,
           ct.name as class_type_name,
           ct.description as class_type_description,
           r.name as room_name,
           l.name as location_name,
           rt.name as tier_name,
           rt.price as tier_price,
           (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status IN ('booked', 'confirmed')) as booking_count
    FROM classes c
    JOIN class_types ct ON c.class_type_id = ct.id
    JOIN rooms r ON c.room_id = r.id
    JOIN locations l ON c.location_id = l.id
    LEFT JOIN rental_tiers rt ON c.coop_rental_tier_id = rt.id
    WHERE c.teacher_id = $1
      AND c.is_coop = true
      ${upcoming ? "AND c.date >= CURRENT_DATE AND c.coop_status = 'scheduled'" : ''}
    ORDER BY c.date ${upcoming ? 'ASC' : 'DESC'}, c.start_time ${upcoming ? 'ASC' : 'DESC'}
    LIMIT $2 OFFSET $3
  `, [teacherId, limit, offset]);

  return result.rows;
}

/**
 * Get co-op class by ID
 * @param {string} classId - Class UUID
 * @returns {Promise<Object|null>} Class details
 */
async function getCoopClassById(classId) {
  const result = await db.query(`
    SELECT c.*,
           ct.name as class_type_name,
           ct.description as class_type_description,
           ct.duration as duration_minutes,
           r.name as room_name,
           r.capacity as room_capacity,
           l.name as location_name,
           l.timezone,
           rt.name as tier_name,
           rt.price as tier_price,
           u.first_name as teacher_first_name,
           u.last_name as teacher_last_name,
           t.photo_url as teacher_photo,
           t.bio as teacher_bio,
           (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status IN ('booked', 'confirmed')) as booking_count,
           (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status = 'waitlist') as waitlist_count
    FROM classes c
    JOIN class_types ct ON c.class_type_id = ct.id
    JOIN rooms r ON c.room_id = r.id
    JOIN locations l ON c.location_id = l.id
    LEFT JOIN rental_tiers rt ON c.coop_rental_tier_id = rt.id
    JOIN teachers t ON c.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE c.id = $1 AND c.is_coop = true
  `, [classId]);

  return result.rows[0] || null;
}

/**
 * Get all co-op classes with filters
 * @param {Object} options - Filter options
 * @returns {Promise<Array>} Classes
 */
async function getCoopClasses(options = {}) {
  const {
    startDate,
    endDate,
    locationId,
    roomId,
    teacherId,
    visibility = 'public',
    limit = 100,
    offset = 0,
  } = options;

  let whereClause = 'c.is_coop = true AND c.coop_status != \'cancelled\'';
  const params = [];
  let paramIndex = 1;

  if (startDate) {
    whereClause += ` AND c.date >= $${paramIndex++}`;
    params.push(startDate);
  }
  if (endDate) {
    whereClause += ` AND c.date <= $${paramIndex++}`;
    params.push(endDate);
  }
  if (locationId) {
    whereClause += ` AND c.location_id = $${paramIndex++}`;
    params.push(locationId);
  }
  if (roomId) {
    whereClause += ` AND c.room_id = $${paramIndex++}`;
    params.push(roomId);
  }
  if (teacherId) {
    whereClause += ` AND c.teacher_id = $${paramIndex++}`;
    params.push(teacherId);
  }
  if (visibility) {
    whereClause += ` AND c.coop_visibility = $${paramIndex++}`;
    params.push(visibility);
  }

  params.push(limit, offset);

  const result = await db.query(`
    SELECT c.*,
           ct.name as class_type_name,
           r.name as room_name,
           l.name as location_name,
           u.first_name as teacher_first_name,
           u.last_name as teacher_last_name,
           t.photo_url as teacher_photo,
           (SELECT COUNT(*) FROM bookings WHERE class_id = c.id AND status IN ('booked', 'confirmed')) as booking_count
    FROM classes c
    JOIN class_types ct ON c.class_type_id = ct.id
    JOIN rooms r ON c.room_id = r.id
    JOIN locations l ON c.location_id = l.id
    JOIN teachers t ON c.teacher_id = t.id
    JOIN users u ON t.user_id = u.id
    WHERE ${whereClause}
    ORDER BY c.date ASC, c.start_time ASC
    LIMIT $${paramIndex++} OFFSET $${paramIndex}
  `, params);

  return result.rows;
}

/**
 * Get class roster
 * @param {string} classId - Class UUID
 * @returns {Promise<Array>} Bookings with user details
 */
async function getClassRoster(classId) {
  const result = await db.query(`
    SELECT b.*,
           u.first_name,
           u.last_name,
           u.email,
           u.phone,
           um.id as membership_id,
           mt.name as membership_name
    FROM bookings b
    JOIN users u ON b.user_id = u.id
    LEFT JOIN user_memberships um ON b.membership_id = um.id
    LEFT JOIN membership_types mt ON um.membership_type_id = mt.id
    WHERE b.class_id = $1
      AND b.status IN ('booked', 'confirmed', 'checked_in', 'attended')
    ORDER BY b.created_at
  `, [classId]);

  return result.rows;
}

// ============================================
// FINALIZE & CHECK-IN
// ============================================

/**
 * Finalize a co-op class (after it completes)
 * @param {string} classId - Class UUID
 * @returns {Promise<Object>} Finalization result
 */
async function finalizeCoopClass(classId) {
  const coopClass = await db.query(`
    SELECT * FROM classes WHERE id = $1 AND is_coop = true
  `, [classId]);

  if (!coopClass.rows[0]) {
    throw new Error('Co-op class not found');
  }

  const cls = coopClass.rows[0];

  if (cls.coop_status === 'cancelled') {
    throw new Error('Cannot finalize cancelled class');
  }

  if (cls.coop_status === 'completed') {
    throw new Error('Class is already finalized');
  }

  // Mark all checked_in bookings as attended
  await db.query(`
    UPDATE bookings
    SET status = 'attended', updated_at = NOW()
    WHERE class_id = $1 AND status = 'checked_in'
  `, [classId]);

  // Mark booked but not checked in as no_show
  await db.query(`
    UPDATE bookings
    SET status = 'no_show', updated_at = NOW()
    WHERE class_id = $1 AND status IN ('booked', 'confirmed')
  `, [classId]);

  // Finalize all pending transactions for this class
  await db.query(`
    UPDATE rental_transactions
    SET status = 'completed', settled_at = NOW(), updated_at = NOW()
    WHERE class_id = $1 AND status = 'pending'
  `, [classId]);

  // Update class status
  await db.query(`
    UPDATE classes
    SET coop_status = 'completed', updated_at = NOW()
    WHERE id = $1
  `, [classId]);

  // Get final stats
  const stats = await db.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'attended') as attended,
      COUNT(*) FILTER (WHERE status = 'no_show') as no_shows,
      COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled
    FROM bookings WHERE class_id = $1
  `, [classId]);

  return {
    classId,
    status: 'completed',
    ...stats.rows[0],
  };
}

/**
 * Check in a student to a co-op class
 * @param {string} classId - Class UUID
 * @param {string} bookingId - Booking UUID
 * @param {string} checkedInBy - User ID who checked in the student
 * @returns {Promise<Object>} Updated booking
 */
async function checkInStudent(classId, bookingId, checkedInBy) {
  const result = await db.query(`
    UPDATE bookings
    SET status = 'checked_in',
        checked_in_at = NOW(),
        checked_in_by = $1,
        updated_at = NOW()
    WHERE id = $2 AND class_id = $3
      AND status IN ('booked', 'confirmed')
    RETURNING *
  `, [checkedInBy, bookingId, classId]);

  if (result.rows.length === 0) {
    throw new Error('Booking not found or already checked in');
  }

  return result.rows[0];
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Create
  createCoopClass,

  // Availability
  checkRoomAvailability,
  getAvailableSlots,
  getTeacherWeeklyHours,

  // Update & Cancel
  updateCoopClass,
  cancelCoopClass,

  // Finalize & Check-in
  finalizeCoopClass,
  checkInStudent,

  // Get
  getTeacherCoopClasses,
  getCoopClassById,
  getCoopClasses,
  getClassRoster,
};
