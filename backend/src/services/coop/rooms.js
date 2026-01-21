// ============================================
// CO-OP ROOMS SERVICE
// Room management for co-op rentals
// ============================================

const db = require('../../database/connection');

// ============================================
// DEFAULT SETTINGS
// ============================================

const DEFAULT_ROOM_COOP_SETTINGS = {
  advance_booking_days: 30,
  min_booking_hours: 24,
  max_weekly_hours_per_teacher: 10,
  cancellation_hours: 48,
  cancellation_fee_percent: 50,
  buffer_minutes_between_rentals: 15,
};

// ============================================
// GET ROOMS
// ============================================

/**
 * Get all rooms available for co-op
 * @returns {Promise<Array>} Rooms with co-op settings
 */
async function getCoopRooms() {
  const result = await db.query(`
    SELECT r.*, l.name as location_name, l.timezone
    FROM rooms r
    JOIN locations l ON r.location_id = l.id
    WHERE r.allows_coop = true
      AND r.is_active = true
      AND l.is_active = true
    ORDER BY l.name, r.sort_order, r.name
  `);

  return result.rows.map(room => ({
    ...room,
    coop_settings: {
      ...DEFAULT_ROOM_COOP_SETTINGS,
      ...room.coop_settings,
    },
  }));
}

/**
 * Get a room by ID
 * @param {string} roomId - Room UUID
 * @returns {Promise<Object|null>} Room with co-op settings
 */
async function getRoomById(roomId) {
  const result = await db.query(`
    SELECT r.*, l.name as location_name, l.timezone
    FROM rooms r
    JOIN locations l ON r.location_id = l.id
    WHERE r.id = $1
  `, [roomId]);

  if (result.rows.length === 0) {
    return null;
  }

  const room = result.rows[0];
  return {
    ...room,
    coop_settings: {
      ...DEFAULT_ROOM_COOP_SETTINGS,
      ...room.coop_settings,
    },
  };
}

/**
 * Get rooms by location
 * @param {string} locationId - Location UUID
 * @returns {Promise<Array>} Rooms at location
 */
async function getRoomsByLocation(locationId) {
  const result = await db.query(`
    SELECT r.*, l.name as location_name, l.timezone
    FROM rooms r
    JOIN locations l ON r.location_id = l.id
    WHERE r.location_id = $1
      AND r.is_active = true
    ORDER BY r.sort_order, r.name
  `, [locationId]);

  return result.rows.map(room => ({
    ...room,
    coop_settings: {
      ...DEFAULT_ROOM_COOP_SETTINGS,
      ...room.coop_settings,
    },
  }));
}

// ============================================
// ROOM MANAGEMENT
// ============================================

/**
 * Create a new room
 * @param {Object} data - Room data
 * @returns {Promise<Object>} Created room
 */
async function createRoom(data) {
  const {
    locationId,
    name,
    description,
    capacity = 20,
    amenities = [],
    photoUrl,
    allowsCoop = false,
    coopSettings = {},
  } = data;

  const result = await db.query(`
    INSERT INTO rooms (
      location_id, name, description, capacity, amenities,
      photo_url, allows_coop, coop_settings
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    RETURNING *
  `, [
    locationId, name, description, capacity, amenities,
    photoUrl, allowsCoop,
    JSON.stringify({ ...DEFAULT_ROOM_COOP_SETTINGS, ...coopSettings })
  ]);

  return result.rows[0];
}

/**
 * Update a room
 * @param {string} roomId - Room UUID
 * @param {Object} data - Room data to update
 * @returns {Promise<Object>} Updated room
 */
async function updateRoom(roomId, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  if (data.name !== undefined) {
    fields.push(`name = $${paramIndex++}`);
    values.push(data.name);
  }
  if (data.description !== undefined) {
    fields.push(`description = $${paramIndex++}`);
    values.push(data.description);
  }
  if (data.capacity !== undefined) {
    fields.push(`capacity = $${paramIndex++}`);
    values.push(data.capacity);
  }
  if (data.amenities !== undefined) {
    fields.push(`amenities = $${paramIndex++}`);
    values.push(data.amenities);
  }
  if (data.photoUrl !== undefined) {
    fields.push(`photo_url = $${paramIndex++}`);
    values.push(data.photoUrl);
  }
  if (data.allowsCoop !== undefined) {
    fields.push(`allows_coop = $${paramIndex++}`);
    values.push(data.allowsCoop);
  }
  if (data.coopSettings !== undefined) {
    fields.push(`coop_settings = $${paramIndex++}`);
    values.push(JSON.stringify({ ...DEFAULT_ROOM_COOP_SETTINGS, ...data.coopSettings }));
  }
  if (data.isActive !== undefined) {
    fields.push(`is_active = $${paramIndex++}`);
    values.push(data.isActive);
  }
  if (data.sortOrder !== undefined) {
    fields.push(`sort_order = $${paramIndex++}`);
    values.push(data.sortOrder);
  }

  if (fields.length === 0) {
    const existing = await getRoomById(roomId);
    return existing;
  }

  fields.push('updated_at = NOW()');
  values.push(roomId);

  const result = await db.query(`
    UPDATE rooms
    SET ${fields.join(', ')}
    WHERE id = $${paramIndex}
    RETURNING *
  `, values);

  return result.rows[0];
}

/**
 * Enable co-op for a room
 * @param {string} roomId - Room UUID
 * @param {Object} settings - Co-op settings override
 * @returns {Promise<Object>} Updated room
 */
async function enableCoopForRoom(roomId, settings = {}) {
  const result = await db.query(`
    UPDATE rooms
    SET allows_coop = true,
        coop_settings = $1,
        updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [JSON.stringify({ ...DEFAULT_ROOM_COOP_SETTINGS, ...settings }), roomId]);

  return result.rows[0];
}

/**
 * Disable co-op for a room
 * @param {string} roomId - Room UUID
 * @returns {Promise<Object>} Updated room
 */
async function disableCoopForRoom(roomId) {
  const result = await db.query(`
    UPDATE rooms
    SET allows_coop = false,
        updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [roomId]);

  return result.rows[0];
}

/**
 * Update room co-op settings
 * @param {string} roomId - Room UUID
 * @param {Object} settings - Settings to update (partial)
 * @returns {Promise<Object>} Updated room
 */
async function updateRoomCoopSettings(roomId, settings) {
  const room = await getRoomById(roomId);
  if (!room) {
    throw new Error('Room not found');
  }

  const updatedSettings = {
    ...room.coop_settings,
    ...settings,
  };

  const result = await db.query(`
    UPDATE rooms
    SET coop_settings = $1, updated_at = NOW()
    WHERE id = $2
    RETURNING *
  `, [JSON.stringify(updatedSettings), roomId]);

  return {
    ...result.rows[0],
    coop_settings: updatedSettings,
  };
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Constants
  DEFAULT_ROOM_COOP_SETTINGS,

  // Get rooms
  getCoopRooms,
  getRoomById,
  getRoomsByLocation,

  // Room management
  createRoom,
  updateRoom,
  enableCoopForRoom,
  disableCoopForRoom,
  updateRoomCoopSettings,
};
